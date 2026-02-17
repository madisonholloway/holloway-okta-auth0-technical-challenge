# Vercel Deployment Guide

## Single Vercel Project Setup

This repository is configured to deploy as a single Vercel project with both sample applications:
- **01-Login**: Simple authentication example (served at `/01-login/`)
- **02-Calling-an-API**: Full SPA with API backend and protected endpoints (served at the root `/`)

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
vercel --prod
```

The root `vercel.json` configuration handles:
- Building the Node.js server (`02-Calling-an-API/server.js`) with `@vercel/node` runtime
- Building static files from both `01-Login/public/**` and `02-Calling-an-API/public/**`
- Routing `/api/*` requests to the Express backend
- Serving static assets directly from the filesystem
- Routing unmatched paths to the backend server (which serves the SPA and handles client-side routing)

### 3. Project Structure

```
├── vercel.json                          # Single root configuration for Vercel
├── 01-Login/                            # Deployed at /01-login/
│   ├── public/                          # Simple login SPA (static files)
│   ├── auth_config.json                 # Auth0 config for login example
│   └── ...
└── 02-Calling-an-API/
    ├── server.js                        # Express backend (Node.js runtime - deployed)
    ├── public/                          # Full SPA with API calls (served at /)
    ├── auth_config.json                 # Auth0 config for API example
    └── ...
```

The deployed application:
- **Root path (`/`)**: Serves 02-Calling-an-API SPA with API backend and protected endpoints
- **Static assets**: Served from both `01-Login/public/` and `02-Calling-an-API/public/`
- **API endpoints**: Available at `/api/*` (02-Calling-an-API only)

### 4. Verify Deployment

After deployment, verify both applications work:

**02-Calling-an-API (root `/`):**
1. Navigate to your Vercel URL - you should see the pizza ordering app
2. Click the profile button and authenticate with Auth0
3. Place an order - verify it persists via the API
4. Check the order history tab (requires `read:orders` permission)
5. Test permission errors by using a user without proper scopes

**01-Login (reference at `/01-login/`):**
1. Navigate to `https://your-project.vercel.app/01-login/`
2. Verify the simpler login-only example loads and works

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

**SPA routing issues:**
- The `vercel.json` routes all unmatched paths to `/02-Calling-an-API/server.js`
- Express serves the `public/index.html` file for SPA client-side routing
- Filesystem handler in `vercel.json` ensures static assets are served before rewrites

**Local development issues:**
- Ensure `auth_config.json` exists in `02-Calling-an-API/` folder or set environment variables
- The server will try to load from `auth_config.json` first, then fall back to environment variables

**CORS or Auth0 errors:**
- Update your Auth0 application settings:
  - Applications → Settings → Allowed Callback URLs: `https://your-project.vercel.app`
  - Applications → Settings → Allowed Logout URLs: `https://your-project.vercel.app`
  - Applications → Settings → Allowed Web Origins: `https://your-project.vercel.app`
