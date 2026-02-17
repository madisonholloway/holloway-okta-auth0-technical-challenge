// The Auth0 client, initialized in configureClient()
let auth0Client = null;

/**
 * Starts the authentication flow using Auth0 Universal Login.
 * @param {string} [targetUrl] Optional SPA route to return to after login
 */
const login = async (targetUrl) => {
  try {
    console.log("Logging in", targetUrl);

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
 * Initializes the Auth0 client using SPA SDK.
 * Audience and scopes are configured for the Orders API.
 */
const configureClient = async () => {
  const response = await fetchAuthConfig();
  const config = await response.json();

  auth0Client = await auth0.createAuth0Client({
    domain: config.domain,
    clientId: config.clientId,
    authorizationParams: {
      audience: config.audience,
      scope: "openid profile email read:orders create:orders"
    }
  });
};

/**
 * Checks authentication state before executing `fn`.
 * If unauthenticated, triggers login with a return URL.
 * @param {Function} fn Function to execute if the user is logged in
 * @param {string} targetUrl Route to return to after login
 */
const requireAuth = async (fn, targetUrl) => {
  const isAuthenticated = await auth0Client.isAuthenticated();

  if (isAuthenticated) {
    return fn();
  }

  return login(targetUrl);
};

/**
 * Calls the protected API endpoint with an access token.
 */
const callApi = async () => {
  try {
    const token = await auth0Client.getTokenSilently();

    const response = await fetch("/api/external", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const responseData = await response.json();
    const responseElement = document.getElementById("api-call-result");

    responseElement.innerText = JSON.stringify(responseData, {}, 2);

    document.querySelectorAll("pre code").forEach(hljs.highlightBlock);

    eachElement(".result-block", (c) => c.classList.add("show"));
  } catch (e) {
    console.error(e);
  }
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
    } else if (e.target.getAttribute("id") === "call-api") {
      e.preventDefault();
      callApi();
    } else if (e.target && e.target.closest && e.target.closest('#pizza-grid')) {
      const el = e.target;

      if (el.classList.contains('btn-incr') || el.classList.contains('btn-decr')) {
        e.preventDefault();
        const input = el.closest('.input-group').querySelector('.pizza-qty');
        const step = el.classList.contains('btn-incr') ? 1 : -1;
        let val = parseInt(input.value || '0', 10) + step;
        if (val < 0) val = 0;
        input.value = val;
        updateTotalPizzas();
      }

      if (el.getAttribute('id') === 'place-order') {
        e.preventDefault();
        requireAuth(() => placeOrder(), '/');
      }
    } else if (e.target && e.target.getAttribute && e.target.getAttribute('id') === 'refresh-orders') {
      e.preventDefault();
      requireAuth(() => window.fetchOrders && window.fetchOrders(), '/order-history');
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

  // Pizza UI helpers
  /**
   * Updates total quantity and button state for the pizza order UI.
   */
  const updateTotalPizzas = () => {
    const total = Array.from(document.querySelectorAll('.pizza-qty')).reduce((s, input) => s + Math.max(0, parseInt(input.value || '0', 10)), 0);
    const totalEl = document.getElementById('total-pizzas');
    const placeBtn = document.getElementById('place-order');
    if (totalEl) totalEl.innerText = total;
    if (placeBtn) placeBtn.disabled = total < 1; // enable when at least 1 pizza is selected
  };

  // Error display helpers
  /**
   * Displays an error modal with a provided message.
   * @param {string} msg Error message to render
   */
  const showError = (msg) => {
    const modalHeader = document.getElementById('alertModalHeader');
    const modalTitle = document.getElementById('alertModalLabel');
    const modalBody = document.getElementById('alertModalBody');
    
    if (modalHeader) modalHeader.style.backgroundColor = '#f8d7da';
    if (modalHeader) modalHeader.style.borderColor = '#f5c6cb';
    if (modalTitle) modalTitle.textContent = 'Error';
    if (modalTitle) modalTitle.style.color = '#721c24';
    if (modalBody) modalBody.innerHTML = `<p style="color: #721c24;">${String(msg)}</p>`;
    
    $('#alertModal').modal('show');
  };

  /**
   * Hides the modal dialog (error or success).
   */
  const clearError = () => {
    $('#alertModal').modal('hide');
  };

  /**
   * Displays a success modal with a provided message.
   * @param {string} msg Success message to render
   */
  const showSuccess = (msg) => {
    const modalHeader = document.getElementById('alertModalHeader');
    const modalTitle = document.getElementById('alertModalLabel');
    const modalBody = document.getElementById('alertModalBody');
    
    if (modalHeader) modalHeader.style.backgroundColor = '#d4edda';
    if (modalHeader) modalHeader.style.borderColor = '#c3e6cb';
    if (modalTitle) modalTitle.textContent = 'Success';
    if (modalTitle) modalTitle.style.color = '#155724';
    if (modalBody) modalBody.innerHTML = `<p style="color: #155724;">${String(msg)}</p>`;
    
    $('#alertModal').modal('show');
  };

  /**
   * Hides the modal dialog (success).
   */
  const clearSuccess = () => {
    $('#alertModal').modal('hide');
  };

  Array.from(document.querySelectorAll('.pizza-qty')).forEach((input) => {
    input.addEventListener('change', updateTotalPizzas);
    input.addEventListener('input', updateTotalPizzas);
  });

  // Ensure initial total and button state
  updateTotalPizzas();

  // Attach click handler to Place order button (outside the grid)
  const placeBtnEl = document.getElementById('place-order');
  if (placeBtnEl) {
    placeBtnEl.addEventListener('click', (e) => {
      e.preventDefault();
      requireAuth(() => placeOrder(), '/');
    });
  }

  /**
   * Returns selected pizza items with quantities.
   * @returns {{name: string, quantity: number}[]}
   */
  const getSelectedPizzas = () => {
    return Array.from(document.querySelectorAll('.pizza-qty')).map(input => ({ name: input.dataset.pizza, quantity: Math.max(0, parseInt(input.value || '0', 10)) })).filter(i=>i.quantity>0);
  };

  /**
   * Places a pizza order via the protected API.
   */
  const placeOrder = async () => {
    try {
      const items = getSelectedPizzas();
      if (items.length === 0) return;

      clearError();
      clearSuccess();

      const token = await auth0Client.getTokenSilently();

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ order: { items } })
      });

      if (!response.ok) {
        let errMsg = response.statusText || 'Error placing order';
        try {
          const errBody = await response.json();
          if (errBody && errBody.message) errMsg = errBody.message;
        } catch (_) {}
        showError(errMsg);
        return;
      }

      const responseData = await response.json();
      clearError();
      showSuccess('Your pizza order has been placed successfully!');
      const responseElement = document.getElementById('api-call-result');

      if (responseElement) responseElement.innerText = JSON.stringify(responseData, null, 2);
      document.querySelectorAll('pre code').forEach(hljs.highlightBlock);
      eachElement('.result-block', (c) => c.classList.add('show'));

      // Reset quantities
      Array.from(document.querySelectorAll('.pizza-qty')).forEach(i => i.value = 0);
      updateTotalPizzas();
    } catch (e) {
      console.error(e);
      showError(e && e.message ? e.message : 'Network error when placing order');
    }
  };

  /**
   * Fetches and renders order history from the protected API.
   */
  window.fetchOrders = async function() {
    try {
      clearError();
      clearSuccess();
      const token = await auth0Client.getTokenSilently();
      const resp = await fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) {
        let errMsg = resp.statusText || 'Error fetching orders';
        try {
          const eb = await resp.json();
          if (eb && eb.message) errMsg = eb.message;
        } catch (_) {}
        showError(errMsg);
        return;
      }
      const data = await resp.json();
      const codeElement = document.getElementById('orders-json');
      if (codeElement) codeElement.innerText = JSON.stringify(data, null, 2);
      document.querySelectorAll('pre code').forEach(hljs.highlightBlock);
      const el = document.getElementById('orders-list');
      if (el) {
        // Handle both array and object responses
        let orders = Array.isArray(data) ? data : (data && data.orders ? data.orders : []);
        
        if (!orders || orders.length === 0) {
          el.innerHTML = '<p class="text-muted">No orders yet.</p>';
        } else {
          el.innerHTML = orders.map(order => {
            const orderNumber = order.order_number || '?';
            const dateTime = order.date && order.time ? `${order.date}, ${order.time}` : 'Unknown date';
            const itemsList = order.items && order.items.length > 0 
              ? order.items.map(item => `${item.quantity} x ${item.name}`).join('<br>')
              : 'No items';
            return `
              <div class="card mb-3">
                <div class="card-body">
                  <h6 class="card-title order-number"><strong>Order #${orderNumber}: ${dateTime}</strong></h6>
                  <p class="card-text">${itemsList}</p>
                </div>
              </div>
            `;
          }).join('');
        }
      }
      eachElement('.result-block', (c) => c.classList.add('show'));
    } catch (err) {
      console.error('Error fetching orders:', err);
      showError(err && err.message ? err.message : 'Network error when fetching orders');
    }
  };


  const query = window.location.search;
  const shouldParseResult = query.includes("code=") && query.includes("state=");

  if (shouldParseResult) {
    try {
      const result = await auth0Client.handleRedirectCallback();

      if (result.appState && result.appState.targetUrl) {
        showContentFromUrl(result.appState.targetUrl);
      }

      console.log("Logged in!");
    } catch (err) {
      console.log("Error parsing redirect:", err);
    }

    window.history.replaceState({}, document.title, "/");
  }

  updateUI();
};
