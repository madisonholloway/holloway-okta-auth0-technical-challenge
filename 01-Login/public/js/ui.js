// URL mapping, from hash to a function that responds to that URL action
const router = {
  "/": () => showContent("content-home"),
  "/profile": () =>
    requireAuth(() => showContent("content-profile"), "/profile"),
  "/login": () => login()
};

//Declare helper functions

/**
 * Iterates over the elements matching 'selector' and passes them
 * to 'fn'
 * @param {*} selector The CSS selector to find
 * @param {*} fn The function to execute for every element
 */
const eachElement = (selector, fn) => {
  for (let e of document.querySelectorAll(selector)) {
    fn(e);
  }
};

/**
 * Tries to display a content panel that is referenced
 * by the specified route URL. These are matched using the
 * router, defined above.
 * @param {*} url The route URL
 */
const showContentFromUrl = (url) => {
  if (router[url]) {
    router[url]();
    return true;
  }

  return false;
};

/**
 * Returns true if `element` is a hyperlink that can be considered a link to another SPA route
 * @param {*} element The element to check
 */
const isRouteLink = (element) =>
  element.tagName === "A" && element.classList.contains("route-link");

/**
 * Displays a content panel specified by the given element id.
 * All the panels that participate in this flow should have the 'page' class applied,
 * so that it can be correctly hidden before the requested content is shown.
 * @param {*} id The id of the content to show
 */
const showContent = (id) => {
  eachElement(".page", (p) => p.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
};

const normalizePizzaName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const applySuggestion = (favorite) => {
  const suggestionEl = document.getElementById("pizza-suggestion");
  if (!suggestionEl) return;

  if (!favorite) {
    suggestionEl.innerHTML = "";
    return;
  }

  const favoriteKey = normalizePizzaName(favorite);
  const suggestions = {
    "meat lovers": "Buffalo",
    "buffalo": "Meat Lovers",
    "cheese": "Margherita",
    "margherita": "Prosciutto & Arugula",
    "prosciutto and arugula": "Margherita",
    "gluten free": "Prosciutto & Arugula"
  };

  const suggestion = suggestions[favoriteKey];
  suggestionEl.innerHTML = suggestion
    ? `<p><strong style="text-decoration: underline;">Craving something new?</strong> Since ${favorite} is your go-to, we think you'll love the bold flavor of our ${suggestion} Pizza.</p>`
    : "";
};

const applyFavoriteBadge = (favorite) => {
  document.querySelectorAll(".favorite-badge").forEach((el) => el.remove());
  document.querySelectorAll("#pizza-grid h5[data-pizza]").forEach((title) => {
    title.classList.remove("has-favorite");
  });
  if (!favorite) return;

  const favoriteName = normalizePizzaName(favorite);
  const titles = document.querySelectorAll("#pizza-grid h5[data-pizza]");

  titles.forEach((title) => {
    const pizzaName = normalizePizzaName(title.dataset.pizza || title.textContent);
    if (pizzaName === favoriteName) {
      title.classList.add("has-favorite");
      const badge = document.createElement("span");
      badge.className = "favorite-badge";
      badge.innerHTML = '<i class="fas fa-heart"></i> Personal Favorite';
      title.appendChild(badge);
    }
  });
};

/**
 * Updates the user interface
 */
const updateUI = async () => {
  try {
    const isAuthenticated = await auth0Client.isAuthenticated();

    if (isAuthenticated) {
      const user = await auth0Client.getUser();

      document.getElementById("profile-data").innerText = JSON.stringify(
        user,
        null,
        2
      );

      document.querySelectorAll("pre code").forEach(hljs.highlightBlock);

      eachElement(".profile-image", (e) => (e.src = user.picture));
      eachElement(".user-name", (e) => (e.innerText = user.name));
      eachElement(".user-email", (e) => (e.innerText = "Email Address: " + user.email));
      
      // Add email verification badge
      const badgeContainer = document.getElementById("email-verification-badge");
      if (badgeContainer) {
        const isVerified = user.email_verified === true;
        const badgeClass = isVerified ? 'badge-verified' : 'badge-unverified';
        const badgeText = isVerified ? 'VERIFIED' : 'UNVERIFIED';
        badgeContainer.innerHTML = `<span class="${badgeClass}">${badgeText}</span>`;
      }
      
      // Add loyalty tier badge
      const loyaltyContainer = document.getElementById("loyalty-tier-badge");
      if (loyaltyContainer) {
        const loyaltyTier = user['https://pizza42/loyaltyTier'] || 'bronze';
        const loyaltyClass = `loyalty-badge loyalty-${loyaltyTier}`;
        loyaltyContainer.innerHTML = `<span class="${loyaltyClass}"><i class="fas fa-star"></i> ${loyaltyTier.charAt(0).toUpperCase() + loyaltyTier.slice(1)}</span>`;
      }

      const couponContainer = document.getElementById("coupon-badge");
      if (couponContainer) {
        const couponCode =
          user['https://pizza42/loyaltyPromotionCoupon'] ||
          user.loyaltyPromotionCoupon ||
          user.coupon ||
          user.couponCode;
        couponContainer.innerHTML = couponCode
          ? `<span class="coupon-badge"><i class="fas fa-tag"></i> ${couponCode}</span>`
          : "";
      }

      const favoritePizza =
        user['https://pizza42/favoritePizza'] ||
        user.favoritePizza ||
        user.favorite_pizza ||
        user.favorite_pizza_name ||
        user.favoritePizzaName;
      applyFavoriteBadge(favoritePizza);
      applySuggestion(favoritePizza);
      
      eachElement(".auth-invisible", (e) => e.classList.add("hidden"));
      eachElement(".auth-visible", (e) => e.classList.remove("hidden"));
    } else {
      eachElement(".auth-invisible", (e) => e.classList.remove("hidden"));
      eachElement(".auth-visible", (e) => e.classList.add("hidden"));
      applyFavoriteBadge(null);
      applySuggestion(null);
      const couponContainer = document.getElementById("coupon-badge");
      if (couponContainer) couponContainer.innerHTML = "";
    }
  } catch (err) {
    console.log("Error updating UI!", err);
    return;
  }

  console.log("UI updated");
};

window.onpopstate = (e) => {
  if (e.state && e.state.url && router[e.state.url]) {
    showContentFromUrl(e.state.url);
  }
};
