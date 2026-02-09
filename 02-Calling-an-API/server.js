require('dotenv').config();
const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const { auth, requiredScopes } = require("express-oauth2-jwt-bearer");
const axios = require('axios');
const { join } = require("path");
const authConfig = require("./auth_config.json");

const app = express();

if (!authConfig.domain || !authConfig.audience) {
  throw "Please make sure that auth_config.json is in place and populated";
}

app.use(morgan("dev"));
app.use(helmet());
app.use(express.static(join(__dirname, "public")));
app.use(express.json());

// Debug middleware to log incoming API requests and Authorization header presence
app.use('/api', (req, res, next) => {
  try {
    console.log(`[API DEBUG] ${req.method} ${req.path} - Authorization header present:`, !!req.headers.authorization);
    if (req.headers.authorization) {
      // don't log full token in case of sensitive logs; show a sample for debugging
      console.log('[API DEBUG] Authorization header sample:', req.headers.authorization.slice(0, 40));
    }
  } catch (ignore) {}
  next();
});

const checkJwt = auth({
  audience: authConfig.audience,
  issuerBaseURL: `https://${authConfig.domain}`,
});

async function getMgmtToken() {
  const response = await axios.post(
    `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
    {
      client_id: process.env.AUTH0_M2M_CLIENT_ID,
      client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
      audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
      grant_type: "client_credentials"
    }
  );
  return response.data.access_token;
}

async function appendOrderToUserMetadata(userId, order) {
  try {
    // 1. Get M2M token
    const mgmtToken = await getMgmtToken();

    // 2. Fetch existing user_metadata
    const userRes = await axios.get(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
      {
        headers: { Authorization: `Bearer ${mgmtToken}` },
      }
    );

    const existingOrders = userRes.data.user_metadata?.order_history || [];

    // 3. Append order
    const updatedOrders = [...existingOrders, order];

    // 4. Update user_metadata
    await axios.patch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
      {
        user_metadata: {
          order_history: updatedOrders,
        },
      },
      {
        headers: { Authorization: `Bearer ${mgmtToken}` },
      }
    );

    console.log(`[M2M] Appended order ${order.id} to user ${userId}`);
  } catch (err) {
    console.error(
      `[M2M] Failed to append order to user ${userId}:`,
      err.message
    );
  }
}


const ordersByUser = {};

// Orders endpoints
const requireCreateOrders = requiredScopes('create:orders');
const requireReadOrders = requiredScopes('read:orders');

app.post('/api/orders', checkJwt, requireCreateOrders, (req, res) => {
  try {
    const payload = req.auth?.payload;

    console.log('[POST /api/orders] Received request');
    console.log('[POST /api/orders] payload:', payload);

    if (!payload) {
      return res.status(401).json({ message: 'Invalid or missing access token' });
    }

    const { sub, exp, permissions = [] } = payload;

    console.log('[POST /api/orders] sub:', sub);
    console.log('[POST /api/orders] exp:', exp);
    console.log('[POST /api/orders] permissions:', permissions);

    if (!sub) {
      return res.status(401).json({ message: 'Token missing subject (sub)' });
    }

    const nowEpoch = Math.floor(Date.now() / 1000);
    if (exp < nowEpoch) {
      return res.status(401).json({ message: 'Access token has expired' });
    }

    if (!permissions.includes('create:orders')) {
      return res.status(403).json({ message: 'Missing create:orders permission' });
    }

    const emailVerified =
      payload['https://pizza-fourty-two.com/email_verified'];

    console.log('[POST /api/orders] emailVerified:', emailVerified);

    if (emailVerified !== true) {
      return res
        .status(403)
        .json({ message: 'Email must be verified before placing an order.' });
    }

    const order = req.body?.order;
    console.log('[POST /api/orders] Received order from client:', JSON.stringify(order, null, 2));

    if (!order || !Array.isArray(order.items)) {
      return res
        .status(400)
        .json({ message: 'Order must include an items array' });
    }

    // Build enriched order record
    const now = new Date();

    const orderRecord = {
      id: Math.random().toString(36).slice(2, 9),

      // Canonical timestamp (good for sorting / storage)
      created_at: now.toISOString(),

      // Friendly display fields
      date: now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      time: now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),

      // Order contents
      items: order.items, // [{ name, quantity }]
    };

    console.log('[POST /api/orders] Created orderRecord:', JSON.stringify(orderRecord, null, 2));

    ordersByUser[sub] = [...(ordersByUser[sub] || []), orderRecord];
    console.log('[POST /api/orders] Stored in ordersByUser[' + sub + '], total orders for user:', ordersByUser[sub].length);
    console.log('[POST /api/orders] All orders for user:', JSON.stringify(ordersByUser[sub], null, 2));

    // Save to Auth0 user metadata (async, non-blocking)
    console.log('[POST /api/orders] Calling appendOrderToUserMetadata...');
    appendOrderToUserMetadata(sub, orderRecord).catch(err =>
      console.error('Error saving order to Auth0 metadata:', err)
    );

    console.log('[POST /api/orders] Returning success response with orderRecord');
    return res.json({ success: true, order: orderRecord });
  } catch (err) {
    console.error('Error creating order:', err);
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/orders', checkJwt, requireReadOrders, async (req, res) => {
  try {
    const payload = req.auth?.payload;
    const userId = payload?.sub;

    console.log('[GET /api/orders] userId:', userId);
    console.log('[GET /api/orders] ordersByUser keys:', Object.keys(ordersByUser));
    console.log('[GET /api/orders] ordersByUser[userId]:', ordersByUser[userId]);

    if (!userId) {
      return res.status(400).json({ message: 'Missing user identifier in token' });
    }

    // Normalize local orders
    const localOrders = (ordersByUser[userId] || []).map(order => ({
      id: order.id,
      created_at: order.created_at,
      date: order.date,
      time: order.time,
      items: order.items,
    }));
    console.log('[GET /api/orders] localOrders:', JSON.stringify(localOrders, null, 2));

    // Fetch Auth0 order history from user_metadata
    let auth0Orders = [];
    try {
      const mgmtToken = await getMgmtToken();
      const userRes = await axios.get(
        `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
        { headers: { Authorization: `Bearer ${mgmtToken}` } }
      );

      auth0Orders = userRes.data.user_metadata?.order_history || [];
      console.log('[GET /api/orders] auth0Orders from metadata:', JSON.stringify(auth0Orders, null, 2));
    } catch (err) {
      console.warn(
        `[GET /api/orders] Failed to fetch Auth0 metadata for ${userId}:`,
        err.message
      );
    }

    // Merge orders (dedupe by id)
    const mergedOrders = [...localOrders];
    console.log('[GET /api/orders] Starting merge with mergedOrders:', JSON.stringify(mergedOrders, null, 2));

    auth0Orders.forEach(order => {
      const normalizedOrder = {
        id: order.id || order.order_id,
        created_at: order.created_at,
        date: order.date,
        time: order.time,
        items: order.items,
      };
      console.log('[GET /api/orders] Processing auth0 order, normalized:', JSON.stringify(normalizedOrder, null, 2));

      if (!mergedOrders.find(o => o.id === normalizedOrder.id)) {
        console.log('[GET /api/orders] Adding new order to merged:', normalizedOrder.id);
        mergedOrders.push(normalizedOrder);
      }
    });

    // Optional: newest first
    mergedOrders.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    
    // Filter out orders without items
    const filteredOrders = mergedOrders.filter(order => order.items && Array.isArray(order.items) && order.items.length > 0);
    console.log('[GET /api/orders] After filtering out empty orders:', JSON.stringify(filteredOrders, null, 2));
    
    // Add order numbers (oldest = #1, newest = highest number)
    const ordersWithNumbers = filteredOrders.reverse().map((order, index) => ({
      ...order,
      order_number: index + 1
    })).reverse(); // reverse back to newest first
    
    console.log('[GET /api/orders] Final ordersWithNumbers:', JSON.stringify(ordersWithNumbers, null, 2));

    return res.json({ success: true, orders: ordersWithNumbers });
  } catch (err) {
    console.error('Error getting orders:', err);
    return res.status(500).json({ message: err.message });
  }
});


app.get("/api/external", checkJwt, (req, res) => {
  res.send({
    msg: "Your access token was successfully validated!"
  });
});

app.get("/auth_config.json", (req, res) => {
  res.sendFile(join(__dirname, "auth_config.json"));
});

app.get("/*", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

app.use(function(err, req, res, next) {
  // Log error info for debugging token validation issues
  try {
    console.error('[API ERROR] name=%s message=%s', err && err.name, err && err.message);
  } catch (ignore) {}

  if (err && err.name === "UnauthorizedError") {
    return res.status(401).send({ msg: "Invalid token" });
  }

  next(err, req, res);
});

process.on("SIGINT", function() {
  process.exit();
});

module.exports = app;
