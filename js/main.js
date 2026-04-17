/**
 * AI-rLAB — minimal site behavior for GitHub Pages.
 */

(function () {
  const yearEl = document.querySelector("[data-year]");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const heroImg = document.querySelector(".hero__image");
  if (heroImg) {
    heroImg.addEventListener("error", () => {
      heroImg.hidden = true;
    });
  }
})();
