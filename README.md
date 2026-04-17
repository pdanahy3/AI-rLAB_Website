# AI-rLAB Website

Static research lab site intended for **GitHub Pages** (HTML, CSS, and JavaScript only).

## Repository layout

| Path | Purpose |
|------|---------|
| `index.html` | Landing page |
| `css/styles.css` | Site styles |
| `js/main.js` | Small shared behaviors (e.g. footer year) |
| `assets/images/` | Images, icons, and other raster assets |

**Landing image:** add a file named `landing-hero.jpg` under `assets/images/`, or change the `src` (and `alt`) on the `<img>` in `index.html` to match your filename.

## Enable GitHub Pages

1. Push this repository to GitHub.
2. In the repo on GitHub: **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose branch **`main`** (or your default branch) and folder **`/ (root)`**, then save.
5. After a short build, the site URL appears on the same page (for a project site it is typically `https://<user-or-org>.github.io/<repo-name>/`).

Use **relative** URLs in HTML (as in this template) so assets load correctly on GitHub Pages.

## Policies for content upload

These guidelines keep the site maintainable, accessible, and legally clear. Adjust roles (e.g. PI, lab manager) to match your lab.

### Who may add or change content

- **Published site (`main`):** only designated maintainers (e.g. PI-approved web maintainer) merge changes, or use a process your lab agrees on (e.g. pull request + review).
- **Drafts:** use a separate branch or fork and open a pull request; avoid committing large binary files directly to `main` without need.

### Images and media

- **Formats:** prefer **WebP** or **JPEG** for photos, **PNG** or **SVG** for logos and diagrams with sharp edges. Avoid huge uncompressed TIFFs on the web branch.
- **Size:** keep hero/landing images roughly **under 1–2 MB** when possible; compress before commit (e.g. quality ~80–85 for JPEG). Very large files slow the site and clutter git history.
- **Naming:** use lowercase, hyphens, and short descriptive names (e.g. `landing-hero.jpg`, `team-2026-photo.jpg`). No spaces or exotic characters.
- **Location:** put images in `assets/images/` unless you introduce a documented subfolder (e.g. `assets/images/people/`).

### Accessibility and descriptions

- Every meaningful image needs accurate **`alt` text** in HTML (empty `alt=""` only for decorative images).
- If text appears inside an image, repeat that information (or a summary) in the page or caption so screen readers and search engines can use it.

### Rights and privacy

- Upload only media you **have permission** to publish (copyright, model releases for identifiable people, institutional photo policies).
- Do not post **private data**, grades, internal IDs, or unpublished sensitive research details without explicit approval.
- When in doubt, ask the PI or your institution’s communications office.

### HTML and structure

- Prefer semantic HTML (`<main>`, headings in order, labels on forms when you add them).
- Keep **one primary `h1`** per page.
- New pages: add files next to `index.html` or in a clear subfolder; link them from the nav in `index.html` and match existing patterns for CSS/JS paths.

### What not to commit

- Secrets (API keys, passwords, private keys).
- Personal or student information that should not be public.
- Generated or vendor `node_modules` unless you deliberately adopt a build step (this template does not require Node).

---

To replace the placeholder landing experience, add `assets/images/landing-hero.jpg` and update the `alt` attribute in `index.html` to describe the image for accessibility.
