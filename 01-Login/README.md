# Sample 01 - Login

This sample demonstrates how to set up and use the Auth0 SPA SDK to authenticate users via Auth0 Universal Login. It is a minimal single‑page app with a profile screen and simple routing.

## Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Install](#install)
- [Configure Auth0](#configure-auth0)
- [Run](#run)
- [How it Works](#how-it-works)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

## Overview

- Vanilla JavaScript SPA
- Auth0 SPA SDK for login/logout and session handling
- Express server for static hosting

## Prerequisites

- Node.js 16+ and npm
- An Auth0 **Single Page Application**

## Install

After cloning the repository, run:

```bash
npm install
```

## Configure Auth0

Copy [auth_config.json.example](auth_config.json.example) to `auth_config.json` and update the values:

```json
{
  "domain": "YOUR_TENANT.auth0.com",
  "clientId": "YOUR_SPA_CLIENT_ID"
}
```

## Run

Start the app from the terminal:

```bash
npm run dev
```

Open the application in the browser at [http://localhost:3000](http://localhost:3000).

## How it Works

- **Login** uses the Auth0 Universal Login page.
- **Logout** clears the Auth0 session and returns to the SPA root.
- **Route handling** is client‑side, driven by `showContentFromUrl()`.
- **Profile rendering** uses the ID token data returned by Auth0.

Key client logic:

- Auth flows and routing: [public/js/app.js](public/js/app.js)
- UI rendering and profile badges: [public/js/ui.js](public/js/ui.js)

## Project Structure

```
01-Login/
  auth_config.json.example  # Template for Auth0 tenant and client ID
  auth_config.json          # Local config (not committed)
  server.js                 # Express server
  public/
    index.html              # SPA shell
    css/main.css            # Visual styles
    js/app.js               # Auth0 + routing
    js/ui.js                # UI helpers and profile rendering
  bin/www                   # Express server bootstrap
```

## Troubleshooting

- **Login redirects but stays logged out**: verify `domain` and `clientId` in `auth_config.json`.
- **Universal Login error**: confirm allowed callback and logout URLs in Auth0 app settings.
- **Profile doesn’t render**: ensure `updateUI()` runs after successful authentication.

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

[Auth0](auth0.com)

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE.txt) file for more info.
