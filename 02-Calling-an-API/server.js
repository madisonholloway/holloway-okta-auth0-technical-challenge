/**
 * Express API server for the “Calling an API” sample.
 *
 * Responsibilities:
 * - Serve the SPA assets
 * - Validate access tokens with Auth0
 * - Provide protected order endpoints
 * - Optionally persist order history to Auth0 user metadata
 */
require('dotenv').config();
const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const { auth, requiredScopes } = require("express-oauth2-jwt-bearer");
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { join } = require("path");
const authConfig = require("./auth_config.json");

const app = express();

if (!authConfig.domain || !authConfig.audience) {
  throw new Error("Please make sure that auth_config.json is in place and populated");
}

app.use(morgan("dev"));
app.use(helmet());
app.use(express.static(join(__dirname, "public")));
app.use(express.json());

const checkJwt = auth({
  audience: authConfig.audience,
  issuerBaseURL: `https://${authConfig.domain}`,
});

/**
 * Retrieves a Management API token using the M2M client credentials flow.
 * Requires AUTH0_DOMAIN, AUTH0_M2M_CLIENT_ID, and AUTH0_M2M_CLIENT_SECRET.
 * @returns {Promise<string>} Access token for Auth0 Management API
 */
async function getMgmtToken() {
  try {
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
  } catch (err) {
    // Log only error message to avoid exposing credentials
    console.error('Failed to retrieve Management API token:', err.message);
    throw err;
  }
}

/**
 * Appends a new order record to Auth0 user_metadata.order_history.
 * This runs asynchronously and does not block the API response.
 * @param {string} userId Auth0 user ID (sub)
 * @param {object} order Order record to append
 */
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

  } catch (err) {
    console.error(
      `[M2M] Failed to append order to user.`,
      err.message
    );
  }
}


// In-memory order cache by user ID (reset on server restart)
const ordersByUser = {};

// Orders endpoints
const requireCreateOrders = requiredScopes('create:orders');
const requireReadOrders = requiredScopes('read:orders');

/**
 * Create a new order.
 * Requires create:orders scope and verified email claim.
 */
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

    const nowEpoch = Math.floor(Date.now() / 1000);
    if (exp < nowEpoch) {
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

    if (!order || !Array.isArray(order.items)) {
      return res
        .status(400)
        .json({ message: 'Order must include an items array' });
    }

    // Build enriched order record
    const now = new Date();

    const orderRecord = {
      id: uuidv4(),

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

    ordersByUser[sub] = [...(ordersByUser[sub] || []), orderRecord];

    // Save to Auth0 user metadata (async, non-blocking)
    appendOrderToUserMetadata(sub, orderRecord).catch(err =>
      console.error('Error saving order to Auth0 metadata', err)
    );
    return res.json({ success: true, order: orderRecord });
  } catch (err) {
    console.error('Error creating order:', err);
    return res.status(500).json({ message: err.message });
  }
});

/**
 * Fetch order history for the authenticated user.
 * Requires read:orders scope.
 */
app.get('/api/orders', checkJwt, requireReadOrders, async (req, res) => {
  try {
    const payload = req.auth?.payload;
    const userId = payload?.sub;

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
    // Fetch Auth0 order history from user_metadata
    let auth0Orders = [];
    try {
      const mgmtToken = await getMgmtToken();
      const userRes = await axios.get(
        `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
        { headers: { Authorization: `Bearer ${mgmtToken}` } }
      );

      auth0Orders = userRes.data.user_metadata?.order_history || [];
    } catch (err) {
      console.warn('[GET /api/orders] Failed to fetch Auth0 metadata');
    }

    // Merge orders (dedupe by id)
    const mergedOrders = [...localOrders];

    auth0Orders.forEach(order => {
      const normalizedOrder = {
        id: order.id || order.order_id,
        created_at: order.created_at,
        date: order.date,
        time: order.time,
        items: order.items,
      };
      if (!mergedOrders.find(o => o.id === normalizedOrder.id)) {
        mergedOrders.push(normalizedOrder);
      }
    });

    // Optional: newest first
    mergedOrders.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    
    // Filter out orders without items
    const filteredOrders = mergedOrders.filter(order => order.items && Array.isArray(order.items) && order.items.length > 0);
    // Add order numbers (oldest = #1, newest = highest number)
    const ordersWithNumbers = filteredOrders.reverse().map((order, index) => ({
      ...order,
      order_number: index + 1
    })).reverse(); // reverse back to newest first

    return res.json({ success: true, orders: ordersWithNumbers });
  } catch (err) {
    console.error('Error getting orders');
    return res.status(500).json({ message: err.message });
  }
});


/**
 * Example protected endpoint used to validate token handling.
 */
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

  next(err);
});

process.on("SIGINT", function() {
  process.exit();
});

module.exports = app;
