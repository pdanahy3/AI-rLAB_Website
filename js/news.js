/**
 * Loads data/news.json and renders the News page feed.
 * Add or edit entries in data/news.json (commit and push to publish).
 */

(function () {
  const TYPE_LABELS = {
    paper: "Paper",
    conference: "Conference",
    exhibition: "Exhibition",
    talk: "Talk",
    award: "Award",
    other: "News",
  };

  const feedRoot = document.getElementById("news-feed");
  if (!feedRoot) return;

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

  function formatDisplayDate(iso) {
    if (!iso || typeof iso !== "string") return "";
    const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function sortItems(items) {
    return [...items].sort((a, b) => {
      const da = String(a.date || "");
      const db = String(b.date || "");
      return db.localeCompare(da);
    });
  }

  function normalizeLinks(item) {
    const out = [];
    if (Array.isArray(item.links)) {
      item.links.forEach(function (L) {
        if (!L || typeof L !== "object") return;
        const href = safeHttpUrl(L.url);
        if (!href) return;
        const label =
          typeof L.label === "string" && L.label.trim() ? L.label.trim() : href;
        out.push({ href: href, label: label });
      });
    }
    const single = safeHttpUrl(item.url);
    if (single) {
      const label =
        typeof item.urlLabel === "string" && item.urlLabel.trim()
          ? item.urlLabel.trim()
          : "Link";
      out.push({ href: single, label: label });
    }
    return out;
  }

  function renderPost(item) {
    const article = document.createElement("article");
    article.className = "news-post";

    const typeKey =
      typeof item.type === "string" ? item.type.toLowerCase() : "other";
    const typeLabel = TYPE_LABELS[typeKey] || TYPE_LABELS.other;

    const meta = document.createElement("p");
    meta.className = "news-post__meta";

    const time = document.createElement("time");
    time.dateTime = String(item.date || "");
    time.textContent = formatDisplayDate(item.date);

    const typeSpan = document.createElement("span");
    typeSpan.className = "news-post__type";
    typeSpan.textContent = typeLabel;

    meta.appendChild(time);
    meta.appendChild(document.createTextNode(" · "));
    meta.appendChild(typeSpan);

    const title = document.createElement("h2");
    title.className = "news-post__title";
    title.textContent =
      typeof item.title === "string" ? item.title : "Untitled";

    article.appendChild(meta);
    article.appendChild(title);

    if (typeof item.summary === "string" && item.summary.trim()) {
      const p = document.createElement("p");
      p.className = "news-post__summary";
      p.textContent = item.summary.trim();
      article.appendChild(p);
    }

    const links = normalizeLinks(item);
    if (links.length > 0) {
      const nav = document.createElement("div");
      nav.className = "news-post__links";
      links.forEach(function (L, i) {
        if (i > 0) nav.appendChild(document.createTextNode(" "));
        const a = document.createElement("a");
        a.href = L.href;
        a.textContent = L.label;
        a.rel = "noopener noreferrer";
        a.target = "_blank";
        nav.appendChild(a);
      });
      article.appendChild(nav);
    }

    return article;
  }

  function showStatus(message, isError) {
    feedRoot.innerHTML = "";
    const p = document.createElement("p");
    p.className = "news-feed__status" + (isError ? " news-feed__status--error" : "");
    p.textContent = message;
    feedRoot.appendChild(p);
  }

  fetch("data/news.json", { credentials: "same-origin" })
    .then(function (res) {
      if (!res.ok) throw new Error("Could not load news data.");
      return res.json();
    })
    .then(function (data) {
      const items = data && Array.isArray(data.items) ? data.items : [];
      feedRoot.innerHTML = "";

      if (items.length === 0) {
        showStatus("No news posts yet. Add entries to data/news.json.");
        return;
      }

      const list = document.createElement("div");
      list.className = "news-feed__list";
      sortItems(items).forEach(function (item) {
        list.appendChild(renderPost(item));
      });
      feedRoot.appendChild(list);
    })
    .catch(function () {
      showStatus(
        "News could not be loaded. If you opened this file from disk, use a local server or view the site on GitHub Pages.",
        true
      );
    });
})();
