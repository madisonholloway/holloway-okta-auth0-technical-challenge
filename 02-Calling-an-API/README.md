# Sample 02 - Calling an API

This app demonstrates how to log in using the Auth0 Universal Page and call a backend API using an access token. It includes a pizza ordering UI, authenticated profile view, and order-history calls secured by OAuth scopes.

## Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Install](#install)
- [Configure Auth0](#configure-auth0)
- [Environment Variables](#environment-variables)
- [Run](#run)
- [How it Works](#how-it-works)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

## Overview

- Single Page App (SPA) built with vanilla JavaScript and Bootstrap.
- Auth0 SPA SDK for login/logout, token retrieval, and session handling.
- Express server that validates JWTs and exposes protected API routes.
- Order history stored in memory and optionally mirrored to Auth0 user metadata.

## Prerequisites

- Node.js 16+ and npm
- An Auth0 tenant with:
	- A **Single Page Application**
	- An **API** (audience)
	- An optional **Machine-to-Machine** app for writing user metadata

## Install

After cloning the repository, run:

```bash
npm install
```

## Configure Auth0

Edit [auth_config.json](auth_config.json) in this folder:

```json
{
	"domain": "YOUR_TENANT.auth0.com",
	"clientId": "YOUR_SPA_CLIENT_ID",
	"audience": "YOUR_API_AUDIENCE"
}
```

Make sure the API has scopes enabled for:

- `read:orders`
- `create:orders`

The SPA requests these scopes during login in [public/js/app.js](public/js/app.js).

## Environment Variables

Create a `.env` file in this folder for Auth0 Management API access (optional but recommended if you want orders persisted in user metadata):

```
AUTH0_DOMAIN=YOUR_TENANT.auth0.com
AUTH0_M2M_CLIENT_ID=YOUR_M2M_CLIENT_ID
AUTH0_M2M_CLIENT_SECRET=YOUR_M2M_CLIENT_SECRET
```

These values are used in [server.js](server.js) to call the Auth0 Management API.

## Run

To start the app from the terminal, run:

```bash
npm run dev
```

Open the application in the browser at [http://localhost:3000](http://localhost:3000).

## How it Works

- **Login** uses the Auth0 Universal Login page.
- **Token retrieval** uses `getTokenSilently()` to call API endpoints.
- **Protected API routes** validate JWTs and enforce required scopes.
- **Order history** is stored in memory and merged with Auth0 user metadata if configured.

Key client logic:

- Authentication & routing: [public/js/app.js](public/js/app.js)
- UI rendering & profile badges: [public/js/ui.js](public/js/ui.js)

## API Endpoints

All endpoints require a valid access token issued for the configured audience.

- `GET /api/external`
	- Validates the access token and returns a success message.

- `POST /api/orders`
	- Requires scope `create:orders`.
	- Validates `email_verified` claim before accepting the order.
	- Stores orders in memory and asynchronously appends to Auth0 user metadata.

- `GET /api/orders`
	- Requires scope `read:orders`.
	- Returns merged order history from memory and Auth0 user metadata.

## Project Structure

```
02-Calling-an-API/
	auth_config.json         # Auth0 tenant, client ID, API audience
	server.js                 # Express API + Auth0 JWT validation
	public/
		index.html              # SPA shell
		css/main.css            # Visual styles
		js/app.js               # Auth0 + SPA routing + API calls
		js/ui.js                # UI helpers and profile rendering
	bin/www                   # Express server bootstrap
```

## Troubleshooting

- **Login succeeds but API calls fail**: verify `audience` and scopes match your API configuration.
- **403 on order creation**: ensure the user’s `email_verified` claim is `true`.
- **Orders not persisted in Auth0**: verify `.env` values and M2M app permissions for `update:users` and `read:users`.
- **CORS issues**: ensure your Auth0 application settings include the correct callback and logout URLs.

## Frequently Asked Questions

We are compiling a list of questions and answers regarding the new JavaScript SDK - if you're having issues running the sample applications, [check the FAQ](https://github.com/auth0/auth0-spa-js/blob/master/FAQ.md)!

## What is Auth0?

Auth0 helps you to:

- Add authentication with [multiple authentication sources](https://docs.auth0.com/identityproviders), either social like **Google, Facebook, Microsoft Account, LinkedIn, GitHub, Twitter, Box, Salesforce, among others**, or enterprise identity systems like **Windows Azure AD, Google Apps, Active Directory, ADFS or any SAML Identity Provider**.
- Add authentication through more traditional **[username/password databases](https://docs.auth0.com/mysql-connection-tutorial)**.
- Add support for **[linking different user accounts](https://docs.auth0.com/link-accounts)** with the same user.
- Support for generating signed [Json Web Tokens](https://docs.auth0.com/jwt) to call your APIs and **flow the user identity** securely.
- Analytics of how, when and where users are logging in.
- Pull data from other sources and add it to the user profile, through [JavaScript rules](https://docs.auth0.com/rules).

## Create a free Auth0 account

1. Go to [Auth0](https://auth0.com/signup) and click Sign Up.
2. Use Google, GitHub or Microsoft Account to login.

## Issue Reporting

If you have found a bug or if you have a feature request, please report them at this repository issues section. Please do not report security vulnerabilities on the public GitHub issue tracker. The [Responsible Disclosure Program](https://auth0.com/whitehat) details the procedure for disclosing security issues.

## Author

[Auth0](https://auth0.com)

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE.txt) file for more info.
