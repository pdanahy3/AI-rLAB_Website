/**
 * Loads data/publications.json and renders the Publications list.
 * Edit citations and DOIs in that UTF-8 text file, then commit and push.
 */

(function () {
  const listRoot = document.getElementById("publications-list");
  if (!listRoot) return;

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

  /** Accepts bare DOI, doi:10..., or https://doi.org/... */
  function normalizeDoi(input) {
    if (!input || typeof input !== "string") return null;
    let s = input.trim();
    s = s.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
    s = s.replace(/^doi:\s*/i, "");
    s = s.trim();
    return s || null;
  }

  function doiResolverUrl(doi) {
    const d = normalizeDoi(doi);
    if (!d) return null;
    return "https://doi.org/" + encodeURI(d);
  }

  function sortItems(items) {
    return [...items].sort(function (a, b) {
      const ya = Number(a.year);
      const yb = Number(b.year);
      const na = Number.isFinite(ya) ? ya : -1;
      const nb = Number.isFinite(yb) ? yb : -1;
      if (nb !== na) return nb - na;
      return String(a.citation || "").localeCompare(String(b.citation || ""));
    });
  }

  function renderItem(item) {
    const article = document.createElement("article");
    article.className = "pub-item";

    const cite = document.createElement("p");
    cite.className = "pub-item__citation";
    cite.textContent =
      typeof item.citation === "string" && item.citation.trim()
        ? item.citation.trim()
        : "(Missing citation.)";
    article.appendChild(cite);

    const doiHref = item.doi ? doiResolverUrl(item.doi) : null;
    const extraUrl = safeHttpUrl(item.url);

    if (doiHref || extraUrl) {
      const links = document.createElement("div");
      links.className = "pub-item__links";

      if (doiHref) {
        const a = document.createElement("a");
        a.href = doiHref;
        a.textContent = "DOI";
        a.rel = "noopener noreferrer";
        a.target = "_blank";
        links.appendChild(a);
      }

      if (extraUrl) {
        if (doiHref) links.appendChild(document.createTextNode(" "));
        const a = document.createElement("a");
        a.href = extraUrl;
        a.textContent =
          typeof item.urlLabel === "string" && item.urlLabel.trim()
            ? item.urlLabel.trim()
            : "Link";
        a.rel = "noopener noreferrer";
        a.target = "_blank";
        links.appendChild(a);
      }

      article.appendChild(links);
    }

    return article;
  }

  function showStatus(message, isError) {
    listRoot.innerHTML = "";
    const p = document.createElement("p");
    p.className =
      "news-feed__status" +
      (isError ? " news-feed__status--error" : "");
    p.textContent = message;
    listRoot.appendChild(p);
  }

  fetch("data/publications.json", { credentials: "same-origin" })
    .then(function (res) {
      if (!res.ok) throw new Error("Could not load publications data.");
      return res.json();
    })
    .then(function (data) {
      const items = data && Array.isArray(data.items) ? data.items : [];
      listRoot.innerHTML = "";

      if (items.length === 0) {
        showStatus(
          "No publications listed yet. Add entries to data/publications.json."
        );
        return;
      }

      const wrap = document.createElement("div");
      wrap.className = "pub-list";

      let lastYear = null;
      sortItems(items).forEach(function (item) {
        const y = Number(item.year);
        if (Number.isFinite(y) && y !== lastYear) {
          const heading = document.createElement("h2");
          heading.className = "pub-list__year";
          heading.textContent = String(y);
          wrap.appendChild(heading);
          lastYear = y;
        }
        wrap.appendChild(renderItem(item));
      });
      listRoot.appendChild(wrap);
    })
    .catch(function () {
      showStatus(
        "Publications could not be loaded. Use a local server or GitHub Pages (fetch does not work from file://).",
        true
      );
    });
})();
