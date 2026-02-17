# Vercel Deployment Guide

## Single Vercel Project Setup

This repository is configured to deploy as a single Vercel project with both the SPA and API in one deployment.

## Setup Instructions

### 1. Environment Variables

Configure the following environment variables in your Vercel project settings:

**In Vercel Dashboard:**
1. Go to your project → Settings → Environment Variables
2. Add the following variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `AUTH0_DOMAIN` | `pizza-fourty-two.us.auth0.com` | Your Auth0 tenant domain |
| `AUTH0_M2M_CLIENT_ID` | Your M2M Client ID | Machine-to-Machine client ID for Auth0 Management API |
| `AUTH0_M2M_CLIENT_SECRET` | Your M2M Client Secret | Machine-to-Machine client secret (keep this secure) |

**Important:** 
- Treat `AUTH0_M2M_CLIENT_SECRET` as a secret - never commit it to your repository
- The `.env` file is ignored by Git (see `.gitignore`)
- Set these variables in Vercel's dashboard, not in vercel.json

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
├── 01-Login/
│   ├── public/                          # Static SPA files (served by Vercel)
│   ├── auth_config.json                 # Auth0 config for login app
│   └── ...
└── 02-Calling-an-API/
    ├── server.js                        # Express backend (Node.js runtime)
    ├── public/                          # Static SPA files served by Express
    ├── auth_config.json                 # Auth0 config for API app
    └── ...
```

### 4. Verify Deployment

After deployment, verify:
1. Login app loads at your Vercel URL (e.g., `https://your-project.vercel.app/`)
2. Auth0 login works
3. Protected API endpoints (`/api/orders`) work with proper permissions
4. Order history loads and displays correctly

## Troubleshooting

**"Missing environment variables" error:**
- Ensure all three environment variables are set in Vercel project settings
- Redeploy after adding variables: `vercel --prod`

**"401 Unauthorized" on API calls:**
- Verify `AUTH0_DOMAIN`, `AUTH0_M2M_CLIENT_ID`, and `AUTH0_M2M_CLIENT_SECRET` are correct
- Check that your Auth0 M2M application has permissions to call the Management API

**SPA routing issues:**
- The `vercel.json` routes all unmatched paths to `/02-Calling-an-API/server.js`
- Express serves the `public/index.html` file for SPA client-side routing
- Verify that static files are being served correctly

**CORS or Auth0 errors:**
- Update your Auth0 application settings:
  - Applications → Settings → Allowed Callback URLs: `https://your-project.vercel.app`
  - Applications → Settings → Allowed Logout URLs: `https://your-project.vercel.app`
  - Applications → Settings → Allowed Web Origins: `https://your-project.vercel.app`
