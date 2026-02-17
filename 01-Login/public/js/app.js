// The Auth0 client, initialized in configureClient()
let auth0Client = null;

/**
 * Starts the authentication flow using Auth0 Universal Login.
 * @param {string} [targetUrl] Optional SPA route to return to after login
 */
const login = async (targetUrl) => {
  try {
    console.log("Logging in");

    const options = {
      authorizationParams: {
        redirect_uri: window.location.origin
      }
    };

    if (targetUrl) {
      options.appState = { targetUrl };
    }

    await auth0Client.loginWithRedirect(options);
  } catch (err) {
    console.log("Log in failed", err);
  }
};

/**
 * Executes the logout flow and returns to the SPA root.
 */
const logout = async () => {
  try {
    console.log("Logging out");
    await auth0Client.logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  } catch (err) {
    console.log("Log out failed", err);
  }
};

/**
 * Retrieves the auth configuration from the server.
 * @returns {Promise<Response>} Fetch response for auth_config.json
 */
const fetchAuthConfig = () => fetch("/auth_config.json");

/**
 * Initializes the Auth0 SPA SDK client.
 *
 * WHAT IT DOES:
 * - Fetches Auth0 configuration from the backend.
 * - Creates an Auth0 client instance.
 * - Configures audience and scopes for the Orders API.
 *
 * WHY IT'S IMPORTANT:
 * - Defines which API this SPA can access (audience).
 * - Defines what actions are allowed (scopes).
 *
 * SECURITY VALUE:
 * Scopes like:
 *   read:orders
 *   create:orders
 * enforce least-privilege access.
 *
 * PIZZA 42 CONTEXT:
 * Customers can only perform actions explicitly granted —
 * like placing or viewing their own orders.
 */
const configureClient = async () => {
  const response = await fetchAuthConfig();
  const config = await response.json();

  auth0Client = await auth0.createAuth0Client({
    domain: config.domain,
    clientId: config.clientId
  });
};

/**
 * Ensures a user is authenticated before executing protected logic.
 *
 * WHAT IT DOES:
 * - Checks if the user is logged in.
 * - If authenticated → executes provided function.
 * - If not → redirects to login.
 *
 * WHY IT'S IMPORTANT:
 * - Protects sensitive actions from unauthenticated access.
 * - Centralizes authentication checks.
 *
 * PIZZA 42 CONTEXT:
 * Prevents anonymous users from:
 * - Placing pizza orders
 * - Viewing order history
 *
 * This enforces business rules at the UI layer.
 */
const requireAuth = async (fn, targetUrl) => {
  const isAuthenticated = await auth0Client.isAuthenticated();

  if (isAuthenticated) {
    return fn();
  }

  return login(targetUrl);
};

// Will run when page finishes loading
window.onload = async () => {
  await configureClient();

  // If unable to parse the history hash, default to the root URL
  if (!showContentFromUrl(window.location.pathname)) {
    showContentFromUrl("/");
    window.history.replaceState({ url: "/" }, {}, "/");
  }

  const bodyElement = document.getElementsByTagName("body")[0];

  // Listen out for clicks on any hyperlink that navigates to a #/ URL
  bodyElement.addEventListener("click", (e) => {
    if (isRouteLink(e.target)) {
      const url = e.target.getAttribute("href");

      if (showContentFromUrl(url)) {
        e.preventDefault();
        window.history.pushState({ url }, {}, url);
      }
    }
  });

  const isAuthenticated = await auth0Client.isAuthenticated();

  if (isAuthenticated) {
    console.log("User is authenticated");
    window.history.replaceState({}, document.title, window.location.pathname);
    updateUI();
    return;
  }

  console.log("User not authenticated");

  const query = window.location.search;
  const shouldParseResult = query.includes("code=") && query.includes("state=");

  if (shouldParseResult) {
    try {
      const result = await auth0Client.handleRedirectCallback();

      if (result.appState && result.appState.targetUrl) {
        showContentFromUrl(result.appState.targetUrl);
      }
    } catch (err) {
      console.error("Error parsing redirect:", err);
    }

    window.history.replaceState({}, document.title, "/");
  }

  updateUI();
};
