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

    // 3. Merge new order
    const updatedOrders = [...existingOrders, {
      order_id: order.id,
      created_at: order.created_at,
    }];

    // 4. Update user_metadata
    await axios.patch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
      { user_metadata: { order_history: updatedOrders } },
      { headers: { Authorization: `Bearer ${mgmtToken}` } }
    );

    console.log(`[M2M] Appended order ${order.id} to user ${userId}`);
  } catch (err) {
    console.error(`[M2M] Failed to append order to user ${userId}:`, err.message);
    // You can decide: fail the request or just log for audit
    // return err;
  }
}


const ordersByUser = {};

// Orders endpoints
const requireCreateOrders = requiredScopes('create:orders');
const requireReadOrders = requiredScopes('read:orders');

app.post('/api/orders', checkJwt, requireCreateOrders, (req, res) => {
  try {
    const payload = req.auth?.payload;

    if (!payload) {
      return res.status(401).json({ message: 'Invalid or missing access token' });
    }

    const { sub, exp, permissions = [] } = payload;

    if (!sub) {
      return res.status(401).json({ message: 'Token missing subject (sub)' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (exp < now) {
      return res.status(401).json({ message: 'Access token has expired' });
    }

    if (!permissions.includes('create:orders')) {
      return res.status(403).json({ message: 'Missing create:orders permission' });
    }

    const emailVerified =
      payload['https://pizza-fourty-two.com/email_verified'];

    if (emailVerified !== true) {
      return res
        .status(403)
        .json({ message: 'Email must be verified before placing an order.' });
    }

    const order = req.body?.order;
    if (!order) {
      return res.status(400).json({ message: 'Missing order payload' });
    }

    const orderRecord = {
      id: Math.random().toString(36).slice(2, 9),
      created_at: new Date().toISOString(),
      ...order,
    };

    ordersByUser[sub] = [...(ordersByUser[sub] || []), orderRecord];

    // Call M2M helper to append order to Auth0
    appendOrderToUserMetadata(sub, orderRecord)
      .catch(err => console.error('Error saving order to Auth0 metadata:', err));

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

    if (!userId) {
      return res.status(400).json({ message: 'Missing user identifier in token' });
    }

    // Get local orders
    const localOrders = ordersByUser[userId] || [];

    // Fetch Auth0 order history from user_metadata
    let auth0Orders = [];
    try {
      const mgmtToken = await getMgmtToken();
      const userRes = await axios.get(
        `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
        { headers: { Authorization: `Bearer ${mgmtToken}` } }
      );
      console.log(`[GET /api/orders] Fetched Auth0 metadata for ${userId}:`, userRes.data);
      auth0Orders = userRes.data.user_metadata?.order_history || [];
    } catch (err) {
      console.warn(`[GET /api/orders] Failed to fetch Auth0 metadata for ${userId}:`, err.message);
      // continue with local orders if M2M call fails
    }

    // Merge orders (optional: remove duplicates based on order_id)
    const mergedOrders = [...localOrders];
    auth0Orders.forEach(order => {
      if (!mergedOrders.find(o => o.id === order.order_id)) {
        mergedOrders.push({ id: order.order_id, created_at: order.created_at });
      }
    });

    return res.json({ success: true, orders: mergedOrders });
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
