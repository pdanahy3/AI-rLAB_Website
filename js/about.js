/**
 * Loads data/about.json and fills the About page intro and prose.
 * Supports:
 *   - introTitle, introAffiliation, sections[{ heading, paragraphs }]
 *   - legacy: lede, paragraphs (flat list of <p> only)
 */

(function () {
  const introRoot = document.getElementById("about-intro");
  const proseRoot = document.getElementById("about-prose");
  if (!proseRoot) return;

  let idleScrollBound = false;

  function showProseError(message, isError) {
    proseRoot.innerHTML = "";
    const p = document.createElement("p");
    p.className =
      "news-feed__status" + (isError ? " news-feed__status--error" : "");
    p.textContent = message;
    proseRoot.appendChild(p);
  }

  function fillIntro(data) {
    if (!introRoot) return;
    introRoot.innerHTML = "";
    const title =
      typeof data.introTitle === "string" ? data.introTitle.trim() : "";
    const aff =
      typeof data.introAffiliation === "string"
        ? data.introAffiliation.trim()
        : "";

    if (title) {
      const p = document.createElement("p");
      p.className = "lede about-page__lede about-intro__title";
      p.textContent = title;
      introRoot.appendChild(p);
    }
    if (aff) {
      const p = document.createElement("p");
      p.className = "about-intro__affiliation";
      p.textContent = aff;
      introRoot.appendChild(p);
    }

    if (!title && !aff && typeof data.lede === "string" && data.lede.trim()) {
      const p = document.createElement("p");
      p.className = "lede about-page__lede";
      p.textContent = data.lede.trim();
      introRoot.appendChild(p);
    }
  }

  function appendParagraphs(container, list) {
    if (!Array.isArray(list)) return;
    list.forEach(function (text) {
      if (typeof text !== "string" || !text.trim()) return;
      const p = document.createElement("p");
      p.textContent = text.trim();
      container.appendChild(p);
    });
  }

  /**
   * After a quiet period, slowly scroll the left about column (desktop two-column
   * layout only). Any interaction resets the timer and stops auto-scroll.
   */
  function bindAboutLeftIdleScroll() {
    if (idleScrollBound) return;
    if (!document.body.classList.contains("page-about")) return;
    if (!document.querySelector(".about-columns__pane--left")) return;
    idleScrollBound = true;

    const IDLE_MS = 4500;
    const SPEED = 0.32;
    const mq = window.matchMedia("(min-width: 901px)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    let idleTimer = null;
    let rafId = 0;
    let programmatic = false;

    function getPane() {
      return document.querySelector(".about-columns__pane--left");
    }

    function stopAutoScroll() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    function tick() {
      const pane = getPane();
      if (!pane || !mq.matches || reduce.matches) {
        rafId = 0;
        return;
      }
      const max = pane.scrollHeight - pane.clientHeight;
      if (max <= 1) {
        rafId = 0;
        return;
      }

      programmatic = true;
      if (pane.scrollTop >= max - 0.75) {
        pane.scrollTop = 0;
      } else {
        pane.scrollTop += SPEED;
      }
      queueMicrotask(function () {
        programmatic = false;
      });

      rafId = requestAnimationFrame(tick);
    }

    function startAutoScroll() {
      stopAutoScroll();
      if (!mq.matches || reduce.matches) return;
      const pane = getPane();
      if (!pane) return;
      if (pane.scrollHeight - pane.clientHeight <= 1) return;
      rafId = requestAnimationFrame(tick);
    }

    function scheduleIdle() {
      clearTimeout(idleTimer);
      stopAutoScroll();
      idleTimer = setTimeout(function () {
        idleTimer = null;
        startAutoScroll();
      }, IDLE_MS);
    }

    function onPaneScroll() {
      if (programmatic) return;
      scheduleIdle();
    }

    function onActivity() {
      scheduleIdle();
    }

    const pane = getPane();
    if (pane) {
      pane.addEventListener("scroll", onPaneScroll, { passive: true });
    }

    ["mousemove", "mousedown", "keydown", "touchstart", "wheel"].forEach(
      function (ev) {
        window.addEventListener(ev, onActivity, { passive: true });
      }
    );

    mq.addEventListener("change", function () {
      if (!mq.matches) {
        clearTimeout(idleTimer);
        stopAutoScroll();
      } else {
        scheduleIdle();
      }
    });

    reduce.addEventListener("change", function () {
      if (reduce.matches) {
        clearTimeout(idleTimer);
        stopAutoScroll();
      } else {
        scheduleIdle();
      }
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        clearTimeout(idleTimer);
        stopAutoScroll();
      } else {
        scheduleIdle();
      }
    });

    scheduleIdle();
  }

  fetch("data/about.json", { credentials: "same-origin" })
    .then(function (res) {
      if (!res.ok) throw new Error("Could not load about data.");
      return res.json();
    })
    .then(function (data) {
      fillIntro(data);
      proseRoot.innerHTML = "";

      const sections =
        data && Array.isArray(data.sections) ? data.sections : null;

      if (sections && sections.length > 0) {
        sections.forEach(function (sec) {
          if (!sec || typeof sec !== "object") return;
          const h =
            typeof sec.heading === "string" ? sec.heading.trim() : "";
          if (h) {
            const h2 = document.createElement("h2");
            h2.className = "about-prose__section-title";
            h2.textContent = h;
            proseRoot.appendChild(h2);
          }
          appendParagraphs(
            proseRoot,
            Array.isArray(sec.paragraphs) ? sec.paragraphs : []
          );
        });
        return;
      }

      const paras =
        data && Array.isArray(data.paragraphs) ? data.paragraphs : [];
      if (paras.length === 0) {
        showProseError(
          'No about text yet. Add a "sections" or "paragraphs" array in data/about.json.',
          false
        );
        return;
      }
      appendParagraphs(proseRoot, paras);
    })
    .catch(function () {
      if (introRoot) introRoot.innerHTML = "";
      showProseError(
        "About content could not be loaded. Use a local server or GitHub Pages (fetch does not work from file://).",
        true
      );
    })
    .finally(function () {
      requestAnimationFrame(function () {
        bindAboutLeftIdleScroll();
      });
    });
})();
