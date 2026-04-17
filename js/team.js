/**
 * Loads data/team.json and renders the team directory on the About page.
 * Headshots: assets/images/team/<photo> — square crop, grayscale via CSS.
 * Custom bio toggle (no <details>). Scrolling the team column closes any open
 * bio; opening a bio scrolls it into view in the column.
 */

(function () {
  const root = document.getElementById("team-directory");
  if (!root) return;

  const PHOTO_BASE = "assets/images/team/";
  const PLACEHOLDER = "headshot-placeholder.svg";

  /** While true, scroll events will not auto-close panels (programmatic scroll). */
  let suppressScrollClose = false;

  function safeHttpUrl(href) {
    if (!href || typeof href !== "string") return null;
    try {
      const u = new URL(href.trim(), "https://example.org");
      if (u.protocol === "https:" || u.protocol === "http:") return u.href;
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  function safePhotoFilename(name) {
    if (!name || typeof name !== "string") return null;
    const s = name.trim();
    if (!s || s.includes("/") || s.includes("\\") || s.includes(".."))
      return null;
    if (!/^[a-zA-Z0-9._-]+$/.test(s)) return null;
    return s;
  }

  function sortItems(items) {
    return [...items].sort(function (a, b) {
      const oa = Number(a.order);
      const ob = Number(b.order);
      const na = Number.isFinite(oa) ? oa : 999;
      const nb = Number.isFinite(ob) ? ob : 999;
      if (na !== nb) return na - nb;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  const SCROLL_CLOSE_MS = 720;
  const PANEL_SCROLL_CLOSING = "team-member__panel--scroll-closing";
  const scrollCloseTimers = new WeakMap();
  const scrollCloseEndHandlers = new WeakMap();

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function cancelPanelScrollClose(panel) {
    const t = scrollCloseTimers.get(panel);
    if (t != null) clearTimeout(t);
    scrollCloseTimers.delete(panel);
    const onEnd = scrollCloseEndHandlers.get(panel);
    if (onEnd) {
      panel.removeEventListener("transitionend", onEnd);
      scrollCloseEndHandlers.delete(panel);
    }
    panel.classList.remove(PANEL_SCROLL_CLOSING);
    panel.style.maxHeight = "";
    panel.style.overflow = "";
  }

  function anyPanelOpen(sectionRoot) {
    const panels = sectionRoot.querySelectorAll(
      ".team-member--interactive .team-member__panel"
    );
    for (let i = 0; i < panels.length; i++) {
      const p = panels[i];
      if (!p.hidden && !p.classList.contains(PANEL_SCROLL_CLOSING)) {
        return true;
      }
    }
    return false;
  }

  function collapseAllInteractivePanels(sectionRoot) {
    sectionRoot
      .querySelectorAll(".team-member--interactive .team-member__panel")
      .forEach(function (el) {
        cancelPanelScrollClose(el);
        el.hidden = true;
      });
    sectionRoot
      .querySelectorAll(".team-member--interactive .team-member__header")
      .forEach(function (el) {
        el.setAttribute("aria-expanded", "false");
      });
  }

  /** Animated collapse when the user scrolls the team column (not for toroidal setup). */
  function collapseInteractivePanelsFromScroll(sectionRoot) {
    const openPanels = sectionRoot.querySelectorAll(
      ".team-member--interactive .team-member__panel:not([hidden])"
    );
    if (!openPanels.length) return;

    sectionRoot
      .querySelectorAll(".team-member--interactive .team-member__header")
      .forEach(function (el) {
        el.setAttribute("aria-expanded", "false");
      });

    if (prefersReducedMotion()) {
      openPanels.forEach(function (panel) {
        cancelPanelScrollClose(panel);
        panel.hidden = true;
      });
      return;
    }

    openPanels.forEach(function (panel) {
      if (panel.classList.contains(PANEL_SCROLL_CLOSING)) return;

      let didFinish = false;

      function finish() {
        if (didFinish) return;
        didFinish = true;
        const t = scrollCloseTimers.get(panel);
        if (t != null) clearTimeout(t);
        scrollCloseTimers.delete(panel);
        panel.removeEventListener("transitionend", onEnd);
        scrollCloseEndHandlers.delete(panel);
        panel.classList.remove(PANEL_SCROLL_CLOSING);
        panel.style.maxHeight = "";
        panel.style.overflow = "";
        panel.hidden = true;
      }

      function onEnd(ev) {
        if (ev.target !== panel) return;
        if (ev.propertyName !== "max-height") return;
        finish();
      }

      scrollCloseEndHandlers.set(panel, onEnd);
      const fallbackTimer = setTimeout(finish, SCROLL_CLOSE_MS + 80);
      scrollCloseTimers.set(panel, fallbackTimer);
      panel.addEventListener("transitionend", onEnd);
      panel.style.overflow = "hidden";
      panel.style.maxHeight = panel.scrollHeight + "px";
      requestAnimationFrame(function () {
        panel.classList.add(PANEL_SCROLL_CLOSING);
      });
    });
  }

  /** Scroll host so `el` (panel) is fully visible with padding. */
  function scrollPanelIntoHostColumn(scrollHost, el) {
    const pad = 12;
    const hostRect = scrollHost.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    let delta = 0;
    if (elRect.top < hostRect.top + pad) {
      delta = elRect.top - hostRect.top - pad;
    } else if (elRect.bottom > hostRect.bottom - pad) {
      delta = elRect.bottom - hostRect.bottom + pad;
    }
    if (delta !== 0) {
      scrollHost.scrollTop += delta;
    }
  }

  function bindTeamPanelToggles(hostRoot) {
    function toggleFromHeader(header) {
      const card = header.closest(".team-member--interactive");
      if (!card) return;
      const panel = card.querySelector(".team-member__panel");
      if (!panel) return;
      cancelPanelScrollClose(panel);
      const opening = panel.hidden;
      panel.hidden = !opening;
      header.setAttribute("aria-expanded", opening ? "true" : "false");

      if (opening) {
        const scrollHost = hostRoot.closest(".about-team-scroll");
        if (scrollHost) {
          suppressScrollClose = true;
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              if (!panel.hidden) {
                scrollPanelIntoHostColumn(scrollHost, panel);
              }
              setTimeout(function () {
                suppressScrollClose = false;
              }, 120);
            });
          });
        }
      }
    }

    hostRoot.addEventListener("click", function (ev) {
      if (ev.target.closest("a")) return;
      const header = ev.target.closest(".team-member__header");
      if (!header || !header.closest(".team-member--interactive")) return;
      toggleFromHeader(header);
    });

    hostRoot.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      const header = ev.target.closest(".team-member__header");
      if (!header || !header.closest(".team-member--interactive")) return;
      ev.preventDefault();
      toggleFromHeader(header);
    });
  }

  function renderMember(item) {
    const displayName =
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim()
        : "Name";

    const roleText =
      typeof item.role === "string" && item.role.trim()
        ? item.role.trim()
        : "";

    const bioText =
      typeof item.bio === "string" && item.bio.trim()
        ? item.bio.trim()
        : "";

    const url = safeHttpUrl(item.website);
    const hasPanel = !!(bioText || url);

    function photoWrapEl() {
      const photoWrap = document.createElement("span");
      photoWrap.className = "team-member__photo-wrap";
      const img = document.createElement("img");
      img.className = "team-member__photo";
      const photoFile = safePhotoFilename(item.photo);
      img.src = PHOTO_BASE + (photoFile || PLACEHOLDER);
      img.width = 120;
      img.height = 120;
      img.loading = "lazy";
      img.decoding = "async";
      img.alt = "Headshot: " + displayName;
      let photoFallback = false;
      img.addEventListener("error", function () {
        if (!photoFallback) {
          photoFallback = true;
          img.src = PHOTO_BASE + PLACEHOLDER;
        }
      });
      photoWrap.appendChild(img);
      return photoWrap;
    }

    if (!hasPanel) {
      const article = document.createElement("article");
      article.className = "team-member";

      const layout = document.createElement("div");
      layout.className = "team-member__layout";
      layout.appendChild(photoWrapEl());

      const body = document.createElement("div");
      body.className = "team-member__body";

      const name = document.createElement("h3");
      name.className = "team-member__name";
      name.textContent = displayName;
      body.appendChild(name);

      if (roleText) {
        const role = document.createElement("p");
        role.className = "team-member__role";
        role.textContent = roleText;
        body.appendChild(role);
      }

      layout.appendChild(body);
      article.appendChild(layout);
      return article;
    }

    const card = document.createElement("div");
    card.className = "team-member team-member--interactive";

    const header = document.createElement("div");
    header.className = "team-member__header team-member__layout";
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", "false");

    header.appendChild(photoWrapEl());

    const headBody = document.createElement("span");
    headBody.className = "team-member__body";

    const nameStrong = document.createElement("strong");
    nameStrong.className = "team-member__name";
    nameStrong.textContent = displayName;
    headBody.appendChild(nameStrong);

    if (roleText) {
      const roleSpan = document.createElement("span");
      roleSpan.className = "team-member__role";
      roleSpan.textContent = roleText;
      headBody.appendChild(roleSpan);
    }

    header.appendChild(headBody);
    card.appendChild(header);

    const panel = document.createElement("div");
    panel.className = "team-member__panel";
    panel.hidden = true;

    if (bioText) {
      const p = document.createElement("p");
      p.className = "team-member__bio";
      p.textContent = bioText;
      panel.appendChild(p);
    }

    if (url) {
      const div = document.createElement("div");
      div.className = "team-member__links";
      const a = document.createElement("a");
      a.href = url;
      a.textContent =
        typeof item.websiteLabel === "string" && item.websiteLabel.trim()
          ? item.websiteLabel.trim()
          : "Website";
      a.rel = "noopener noreferrer";
      a.target = "_blank";
      div.appendChild(a);
      panel.appendChild(div);
    }

    card.appendChild(panel);
    return card;
  }

  function showStatus(message, isError) {
    root.innerHTML = "";
    const p = document.createElement("p");
    p.className =
      "news-feed__status" +
      (isError ? " news-feed__status--error" : "");
    p.textContent = message;
    root.appendChild(p);
  }

  function setupToroidalTeamScroll(scrollHost, sectionRoot) {
    const mq = window.matchMedia("(min-width: 901px)");
    let removeListeners = null;

    function stripExtraLists() {
      const lists = sectionRoot.querySelectorAll(".team-list");
      for (let i = 1; i < lists.length; i++) {
        lists[i].remove();
      }
    }

    function enable() {
      if (removeListeners) {
        removeListeners();
        removeListeners = null;
      }
      stripExtraLists();
      scrollHost.scrollTop = 0;

      const list = sectionRoot.querySelector(".team-list");
      if (!list) return;

      const buffer = 40;
      let rafId = 0;

      function getStride() {
        if (!mq.matches) return 0;
        const lists = sectionRoot.querySelectorAll(".team-list");
        if (lists.length < 2) {
          return list.offsetHeight;
        }
        return lists[1].offsetTop - lists[0].offsetTop;
      }

      function syncLoop() {
        if (!mq.matches) return;
        const stride = getStride();
        if (stride <= 0) return;
        const t = scrollHost.scrollTop;
        if (t >= 2 * stride - buffer) {
          scrollHost.scrollTop = t - stride;
        } else if (t <= buffer) {
          scrollHost.scrollTop = t + stride;
        }
      }

      function onHostScroll() {
        if (rafId) return;
        rafId = requestAnimationFrame(function () {
          rafId = 0;
          if (!suppressScrollClose && anyPanelOpen(sectionRoot)) {
            collapseInteractivePanelsFromScroll(sectionRoot);
          }
          syncLoop();
        });
      }

      function recenterAfterMeasure() {
        if (!mq.matches) return;
        const stride = getStride();
        if (stride > 0) {
          scrollHost.scrollTop = stride;
        }
      }

      scrollHost.addEventListener("scroll", onHostScroll, { passive: true });

      if (mq.matches) {
        sectionRoot.appendChild(list.cloneNode(true));
        sectionRoot.appendChild(list.cloneNode(true));
        collapseAllInteractivePanels(sectionRoot);
        requestAnimationFrame(function () {
          requestAnimationFrame(recenterAfterMeasure);
        });
      }

      removeListeners = function () {
        scrollHost.removeEventListener("scroll", onHostScroll);
      };
    }

    enable();
    mq.addEventListener("change", enable);
  }

  bindTeamPanelToggles(root);

  fetch("data/team.json", { credentials: "same-origin" })
    .then(function (res) {
      if (!res.ok) throw new Error("Could not load team data.");
      return res.json();
    })
    .then(function (data) {
      const items = data && Array.isArray(data.items) ? data.items : [];
      root.innerHTML = "";

      if (items.length === 0) {
        showStatus(
          "No team members listed yet. Add entries to data/team.json."
        );
        return;
      }

      const wrap = document.createElement("div");
      wrap.className = "team-list";
      sortItems(items).forEach(function (item) {
        wrap.appendChild(renderMember(item));
      });
      root.appendChild(wrap);

      const scrollHost = root.closest(".about-team-scroll");
      if (scrollHost) {
        setupToroidalTeamScroll(scrollHost, root);
      }
    })
    .catch(function () {
      showStatus(
        "Team directory could not be loaded. Use a local server or GitHub Pages.",
        true
      );
    });
})();
