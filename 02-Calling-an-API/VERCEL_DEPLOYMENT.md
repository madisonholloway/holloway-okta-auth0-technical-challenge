# Vercel Deployment Guide

## Single Vercel Project Setup

This repository is configured to deploy as a single Vercel project. The **02-Calling-an-API** sample (SPA with API backend) is served at the root of your deployed application.

**Note:** This deployment serves the more complete "Calling an API" example. The simpler "Login" example (01-Login) is available locally for development/reference but is not deployed.

## Setup Instructions

### 1. Environment Variables

Configure the following environment variables in your Vercel project settings:

**In Vercel Dashboard:**
1. Go to your project → Settings → Environment Variables
2. Add the following variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `AUTH0_DOMAIN` | `YOUR_TENANT.auth0.com` | Your Auth0 tenant domain (e.g., `pizza-fourty-two.us.auth0.com`) |
| `AUTH0_AUDIENCE` | `https://YOUR_API_IDENTIFIER/` | Your Auth0 API identifier/audience (e.g., `https://holloway-pizza-42-api.com/`) |
| `AUTH0_M2M_CLIENT_ID` | Your M2M Client ID | Machine-to-Machine client ID for Auth0 Management API |
| `AUTH0_M2M_CLIENT_SECRET` | Your M2M Client Secret | Machine-to-Machine client secret (keep this secure) |

**Important:** 
- Treat `AUTH0_M2M_CLIENT_SECRET` as a secret - never commit it to your repository
- The `.env` and `auth_config.json` files are ignored by Git (see `.gitignore`)
- Set these variables in Vercel's dashboard, not in vercel.json
- The server will read from environment variables in production; `auth_config.json` is only used for local development

### 1.5 Local Development

For local development, you can use either:
- **Environment variables** (same as above, in `.env` file)
- **auth_config.json** file with the same values:
  ```json
  {
    "domain": "YOUR_TENANT.auth0.com",
    "clientId": "your-spa-client-id",
    "audience": "https://YOUR_API_IDENTIFIER/"
  }
  ```

### 2. Deploy

From the root directory:

```bash
vercel
```

The root `vercel.json` configuration handles:
- Building the Node.js server (`02-Calling-an-API/server.js`) with `@vercel/node` runtime
- Building static files from `01-Login/public/**`
- Routing `/api/*` requests to the Express backend
- Routing all other requests to the backend server (which serves the SPA and handles client-side routing)

### 3. Project Structure

```
├── vercel.json                          # Single root configuration for Vercel
├── 01-Login/                            # (Local development only - not deployed)
│   ├── public/                          # Simpler login example
│   └── ...
└── 02-Calling-an-API/
    ├── server.js                        # Express backend (Node.js runtime - deployed)
    ├── public/                          # Static SPA files served at / (deployed)
    ├── auth_config.json                 # Auth0 config for deployed app
    └── ...
```

The deployed application:
- Serves static assets from `02-Calling-an-API/public/` at the root
- Provides API endpoints at `/api/*`
- Handles SPA client-side routing for all unmatched paths
**SPA loads** - Navigate to your Vercel URL (e.g., `https://your-project.vercel.app/`) - you should see the pizza ordering app
2. **Auth0 login works** - Click the profile button and authenticate
3. **Protected API endpoints work** - Place an order and verify it persists
4. **Order history loads** - Check the order history tab (requires `read:orders` permission)
5. **Permission errors display correctly** - Test with a user without proper scopes to see specific permission error messages
1. Login app loads at your Vercel URL (e.g., `https://your-project.vercel.app/`)
2. Auth0 login works
3. Protected API endpoints (`/api/orders`) work with proper permissions
4. Order history loads and displays correctly

## Troubleshooting

**"Please configure Auth0 credentials" error:**
- Ensure all four environment variables are set in Vercel project settings:
  - `AUTH0_DOMAIN`
  - `AUTH0_AUDIENCE`
  - `AUTH0_M2M_CLIENT_ID`
  - `AUTH0_M2M_CLIENT_SECRET`
- Redeploy after adding variables: `vercel --prod`

**"401 Unauthorized" on API calls:**
- Verify `AUTH0_DOMAIN`, `AUTH0_M2M_CLIENT_ID`, and `AUTH0_M2M_CLIENT_SECRET` are correct
- Check that your Auth0 M2M application has permissions to call the Management API


**Local development issues:**
- Ensure `auth_config.json` exists in `02-Calling-an-API/` folder or set environment variables
- The server will try to load from `auth_config.json` first, then fall back to environment variables
**SPA routing issues:**
- The `vercel.json` routes all unmatched paths to `/02-Calling-an-API/server.js`
- Express serves the `public/index.html` file for SPA client-side routing
- Verify that static files are being served correctly

**CORS or Auth0 errors:**
- Update your Auth0 application settings:
  - Applications → Settings → Allowed Callback URLs: `https://your-project.vercel.app`
  - Applications → Settings → Allowed Logout URLs: `https://your-project.vercel.app`
  - Applications → Settings → Allowed Web Origins: `https://your-project.vercel.app`
