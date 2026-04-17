/**
 * After scroll idle: persistent canvas — bold Safiro stamps random subword
 * fragments (BPE / WordPiece / SentencePiece-style tokenizer pieces). Gaussian
 * jitter around the cursor (document coordinates — stamps scroll with the page).
 * Scrolling stops new stamps and erodes existing ones
 * in very small bursts (many scrolls to clear); each erosion scroll adds +2s
 * to the next idle delay before the effect can start again. Eroded stamps
 * linger as light “burn-in” (soft plate + CSS blur on residue canvas) and fade over 20–40s.
 * Tuned for lighter CPU/GPU: lower caps, DPR cap, debounced resize, throttled residue paint.
 */
(function () {
  const IDLE_BASE_MS = 2000;
  /** Added to idle delay on each scroll that erodes stamps (not on normal page scroll). */
  const IDLE_PENALTY_MS = 200;
  const ERODE_FRAC = 0.022;
  const ERODE_MIN = 50;
  const ERODE_MAX = 72;
  const RESIDUE_FADE_MIN_MS = 2000;
  const RESIDUE_FADE_MAX_MS = 4000;
  /**
   * Representative subword units: space-prefixed GPT/BPE chunks, ## WordPiece
   * suffixes, SentencePiece ▁ word pieces, and common byte-pair merges.
   */
  const TOKENS = [
    " the",
    " a",
    " to",
    " of",
    " and",
    " in",
    " is",
    " that",
    " it",
    " for",
    " you",
    " with",
    " on",
    " as",
    " are",
    " be",
    " at",
    " or",
    " was",
    " an",
    " this",
    " have",
    " from",
    " not",
    " by",
    " but",
    " they",
    " we",
    " their",
    " can",
    " will",
    " one",
    " all",
    " would",
    " there",
    " what",
    " about",
    " out",
    " up",
    " who",
    " when",
    " which",
    " re",
    " un",
    " de",
    " pre",
    " pro",
    " com",
    " inter",
    " over",
    " under",
    "ing",
    "tion",
    "ment",
    "ness",
    "able",
    "ible",
    "ally",
    "ious",
    "ical",
    "ance",
    "ence",
    "ative",
    "ization",
    "ification",
    "ology",
    "ography",
    "ed",
    "ly",
    "es",
    "er",
    "est",
    "'s",
    "n't",
    "'re",
    "'ve",
    "'ll",
    "th",
    "ch",
    "ck",
    "qu",
    "str",
    "ght",
    "ough",
    "##ing",
    "##ed",
    "##er",
    "##ly",
    "##s",
    "##tion",
    "##ment",
    "##ness",
    "##able",
    "##less",
    "##ful",
    "##ity",
    "##ism",
    "##ist",
    "▁the",
    "▁and",
    "▁to",
    "▁of",
    "▁in",
    "▁is",
    "▁that",
    "▁for",
    "▁with",
    "▁on",
    "▁as",
    "▁at",
    "▁be",
    "▁by",
    "▁an",
    "▁or",
    "▁from",
    "▁have",
    "▁not",
    "▁was",
    "▁are",
    "▁this",
    "▁but",
    "▁they",
    "▁we",
    "▁can",
    "▁it",
    "Ġthe",
    "Ġand",
    "Ġto",
    "Ġof",
    "Ġin",
    "Ġa",
    "Ġis",
    "Ġthat",
    "Ġfor",
    "Ġ(",
    "Ġ)",
    "Ġ\"",
    "Ġ,",
    "Ġ.",
  ];
  const MAX_STAMPS = 4200;
  /** Cap fading residue glyphs — large lists + blur were the main jank source. */
  const MAX_RESIDUE_STAMPS = 480;
  const STAMP_SIZE_PX = 168;
  const FONT = `700 ${STAMP_SIZE_PX}px "Safiro", "Iowan Old Style", Palatino, Georgia, serif`;
  const SPACING = 34;
  const GAUSSIAN_SIGMA_FRAC = 0.09;
  const AUTO_BURST_CHANCE = 0.1;
  const EXTRA_BURST_CHANCE = 0.06;
  /** Canvas resolution cap (full-document layers are expensive at 2× DPR). */
  const CANVAS_DPR_CAP = 1.25;
  const RESIDUE_MIN_FRAME_MS = 45;
  const RESIZE_DEBOUNCE_MS = 140;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  let canvas;
  let ctx;
  let rafId = 0;
  let idleTimer = 0;
  let running = false;
  /** True after scroll: no new stamps; stamps removed in batches per scroll. */
  let eroding = false;
  /** Cumulative extra ms before the effect can start again after dismissals. */
  let idleExtraMs = 0;
  /** @type {{ x: number; y: number; text: string; angle: number }[]} */
  let stamps = [];
  let cssW = docScrollWidth();
  let cssH = docScrollHeight();

  let targetX = window.scrollX + window.innerWidth / 2;
  let targetY = window.scrollY + window.innerHeight / 2;

  let cursorAnchorX = -1;
  let cursorAnchorY = -1;

  let burstTicker = 0;

  let resizeHandlerBound = false;

  /** Shared absolute mount sized to document; holds stamp + residue canvases. */
  let idleMount = null;
  let docResizeObs = null;
  let residueCanvas = null;
  let residueCtx = null;
  let residueRafId = 0;
  /** @type {{ x: number; y: number; text: string; angle: number; fadeStart: number; fadeMs: number }[]} */
  let residueStamps = [];
  let residueCssW = 0;
  let residueCssH = 0;
  let resizeDebounceTimer = 0;
  let lastResiduePaint = 0;
  let stampScrollRedrawRaf = 0;

  function letterColor() {
    return document.body.classList.contains("page-home") ? "#ffffff" : "#000000";
  }

  function randomToken() {
    return TOKENS[(Math.random() * TOKENS.length) | 0];
  }

  /** Standard normal N(0,1) via Box–Muller. */
  function gaussian01() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function gaussianSigma(w, h) {
    return Math.max(48, Math.min(w, h) * GAUSSIAN_SIGMA_FRAC);
  }

  function docScrollWidth() {
    return Math.max(
      document.documentElement.scrollWidth || 0,
      document.body.scrollWidth || 0,
      window.innerWidth
    );
  }

  function docScrollHeight() {
    return Math.max(
      document.documentElement.scrollHeight || 0,
      document.body.scrollHeight || 0,
      window.innerHeight
    );
  }

  function updateIdleMountSize() {
    if (!idleMount) return;
    idleMount.style.width = docScrollWidth() + "px";
    idleMount.style.height = docScrollHeight() + "px";
  }

  function ensureIdleMount() {
    if (idleMount) {
      updateIdleMountSize();
      return;
    }
    idleMount = document.createElement("div");
    idleMount.id = "idle-letters-mount";
    idleMount.setAttribute("aria-hidden", "true");
    idleMount.style.cssText =
      "position:absolute;top:0;left:0;width:100%;pointer-events:none;z-index:9996;";
    updateIdleMountSize();
    document.body.appendChild(idleMount);
  }

  function maybeRemoveIdleMount() {
    if (idleMount && idleMount.childElementCount === 0) {
      idleMount.remove();
      idleMount = null;
    }
  }

  function getNavBottomPx() {
    const el = document.querySelector(".site-header");
    if (!el) return 0;
    return Math.ceil(el.getBoundingClientRect().bottom);
  }

  function navExclusionPad() {
    return STAMP_SIZE_PX * 0.55;
  }

  /** Document Y would render under the sticky header in the current viewport. */
  function isBlockedByNavDoc(docY) {
    const navBottom = getNavBottomPx();
    if (navBottom <= 0) return false;
    const screenY = docY - window.scrollY;
    return screenY < navBottom + navExclusionPad();
  }

  function clampStamp(x, y, w, h) {
    const pad = STAMP_SIZE_PX;
    const navBottom = getNavBottomPx();
    const sy = window.scrollY;
    const minDocY =
      navBottom > 0 ? sy + navBottom + navExclusionPad() : -pad;
    return {
      x: Math.max(-pad, Math.min(w + pad, x)),
      y: Math.max(minDocY, Math.min(h + pad, y)),
    };
  }

  function drawWithNavClip(surfaceCtx, drawFn) {
    if (!surfaceCtx) return;
    const w = docScrollWidth();
    const h = docScrollHeight();
    const navBottom = getNavBottomPx();
    const clipTop = window.scrollY + navBottom;
    if (navBottom <= 0 || clipTop >= h - 4) {
      drawFn();
      return;
    }
    surfaceCtx.save();
    surfaceCtx.beginPath();
    surfaceCtx.rect(0, clipTop, w, h - clipTop);
    surfaceCtx.clip();
    drawFn();
    surfaceCtx.restore();
  }

  function drawStampsClipped(drawFn) {
    drawWithNavClip(ctx, drawFn);
  }

  function drawStampAt(x, y, text, angle) {
    if (!ctx) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = 1;
    ctx.fillStyle = letterColor();
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function redrawAllStamps() {
    if (!ctx) return;
    const w = docScrollWidth();
    const h = docScrollHeight();
    ctx.clearRect(0, 0, w, h);
    ctx.font = FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    drawStampsClipped(() => {
      for (let i = 0; i < stamps.length; i++) {
        const s = stamps[i];
        drawStampAt(s.x, s.y, s.text, s.angle);
      }
    });
  }

  function placeStamp(x, y) {
    if (!ctx || stamps.length >= MAX_STAMPS) return;
    if (isBlockedByNavDoc(y)) return;
    const text = randomToken();
    const angle = (Math.random() - 0.5) * 0.55;
    stamps.push({ x, y, text, angle });
    ctx.font = FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    drawStampsClipped(() => {
      drawStampAt(x, y, text, angle);
    });
  }

  /** Stamp at (cx, cy) + independent Gaussians with mean 0, std σ. */
  function placeStampGaussian(cx, cy, sigma, w, h) {
    if (stamps.length >= MAX_STAMPS) return;
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = cx + gaussian01() * sigma;
      const y = cy + gaussian01() * sigma;
      const p = clampStamp(x, y, w, h);
      if (!isBlockedByNavDoc(p.y)) {
        placeStamp(p.x, p.y);
        return;
      }
    }
  }

  function tryCursorStampPath(anchorX, anchorY, x, y, sigma, w, h) {
    if (stamps.length >= MAX_STAMPS) return { ax: anchorX, ay: anchorY };
    if (anchorX < 0) {
      placeStampGaussian(x, y, sigma, w, h);
      return { ax: x, ay: y };
    }
    const d = Math.hypot(x - anchorX, y - anchorY);
    if (d >= SPACING) {
      placeStampGaussian(x, y, sigma, w, h);
      return { ax: x, ay: y };
    }
    return { ax: anchorX, ay: anchorY };
  }

  function onWindowResize() {
    window.clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = window.setTimeout(() => {
      resizeDebounceTimer = 0;
      resizeCanvas();
      resizeResidueCanvas();
    }, RESIZE_DEBOUNCE_MS);
  }

  function scheduleStampScrollRedraw() {
    if (!running && !eroding) return;
    if (stampScrollRedrawRaf) return;
    stampScrollRedrawRaf = window.requestAnimationFrame(() => {
      stampScrollRedrawRaf = 0;
      if (running || eroding) {
        redrawAllStamps();
      }
    });
  }

  function cancelStampScrollRedraw() {
    if (stampScrollRedrawRaf) {
      window.cancelAnimationFrame(stampScrollRedrawRaf);
      stampScrollRedrawRaf = 0;
    }
  }

  function bindResize() {
    if (resizeHandlerBound) return;
    resizeHandlerBound = true;
    window.addEventListener("resize", onWindowResize);
    if (typeof ResizeObserver !== "undefined") {
      docResizeObs = new ResizeObserver(() => {
        onWindowResize();
      });
      docResizeObs.observe(document.documentElement);
    }
  }

  function unbindResize() {
    if (!resizeHandlerBound) return;
    resizeHandlerBound = false;
    window.removeEventListener("resize", onWindowResize);
    if (docResizeObs) {
      docResizeObs.disconnect();
      docResizeObs = null;
    }
  }

  function maybeUnbindResize() {
    if (!idleMount) {
      unbindResize();
    }
  }

  function scaleEffectState(sx, sy) {
    targetX *= sx;
    targetY *= sy;
    if (cursorAnchorX >= 0) {
      cursorAnchorX *= sx;
      cursorAnchorY *= sy;
    }
    for (let i = 0; i < stamps.length; i++) {
      stamps[i].x *= sx;
      stamps[i].y *= sy;
    }
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    updateIdleMountSize();
    const dpr = Math.min(window.devicePixelRatio || 1, CANVAS_DPR_CAP);
    const w = docScrollWidth();
    const h = docScrollHeight();
    const hadStamps = (running || eroding) && stamps.length > 0;
    if (hadStamps && (w !== cssW || h !== cssH)) {
      const sx = w / cssW;
      const sy = h / cssH;
      scaleEffectState(sx, sy);
    }
    cssW = w;
    cssH = h;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (hadStamps) {
      redrawAllStamps();
    }
  }

  function ensureCanvas() {
    if (canvas) return;
    ensureIdleMount();
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;";
    idleMount.appendChild(canvas);
    ctx = canvas.getContext("2d");
    bindResize();
    cssW = docScrollWidth();
    cssH = docScrollHeight();
    resizeCanvas();
  }

  function teardownCanvas() {
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
    canvas = null;
    ctx = null;
    maybeRemoveIdleMount();
    maybeUnbindResize();
  }

  function parseCssRgb(str) {
    const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return [+m[1], +m[2], +m[3]];
    return [255, 255, 255];
  }

  function pageBgRgb() {
    return parseCssRgb(window.getComputedStyle(document.body).backgroundColor);
  }

  function stampRgb() {
    return document.body.classList.contains("page-home")
      ? [255, 255, 255]
      : [0, 0, 0];
  }

  function mixRgb(a, b, t) {
    t = Math.min(1, Math.max(0, t));
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ];
  }

  function ensureResidueLayer() {
    if (residueCanvas) return;
    ensureIdleMount();
    residueCanvas = document.createElement("canvas");
    residueCanvas.setAttribute("aria-hidden", "true");
    residueCanvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;display:block;" +
      "filter:blur(1.1px);";
    if (canvas && canvas.parentNode === idleMount) {
      idleMount.insertBefore(residueCanvas, canvas);
    } else {
      idleMount.appendChild(residueCanvas);
    }
    residueCtx = residueCanvas.getContext("2d");
    residueCssW = docScrollWidth();
    residueCssH = docScrollHeight();
    bindResize();
    resizeResidueCanvas();
  }

  function resizeResidueCanvas() {
    if (!residueCtx || !residueCanvas) return;
    updateIdleMountSize();
    const dpr = Math.min(window.devicePixelRatio || 1, CANVAS_DPR_CAP);
    const w = docScrollWidth();
    const h = docScrollHeight();
    const scale =
      residueCssW > 0 &&
      residueCssH > 0 &&
      residueStamps.length > 0 &&
      (w !== residueCssW || h !== residueCssH);
    if (scale) {
      const sx = w / residueCssW;
      const sy = h / residueCssH;
      for (let i = 0; i < residueStamps.length; i++) {
        residueStamps[i].x *= sx;
        residueStamps[i].y *= sy;
      }
    }
    residueCssW = w;
    residueCssH = h;
    residueCanvas.width = Math.floor(w * dpr);
    residueCanvas.height = Math.floor(h * dpr);
    residueCanvas.style.width = w + "px";
    residueCanvas.style.height = h + "px";
    residueCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function teardownResidueLayer() {
    if (residueRafId) {
      window.cancelAnimationFrame(residueRafId);
      residueRafId = 0;
    }
    lastResiduePaint = 0;
    residueStamps = [];
    if (residueCanvas && residueCanvas.parentNode) {
      residueCanvas.parentNode.removeChild(residueCanvas);
    }
    residueCanvas = null;
    residueCtx = null;
    residueCssW = 0;
    residueCssH = 0;
    maybeRemoveIdleMount();
    maybeUnbindResize();
  }

  function residueTick(ts) {
    if (!residueCtx) {
      residueRafId = 0;
      return;
    }
    const now = ts !== undefined ? ts : performance.now();
    if (now - lastResiduePaint < RESIDUE_MIN_FRAME_MS) {
      residueRafId = window.requestAnimationFrame(residueTick);
      return;
    }
    lastResiduePaint = now;
    const w = docScrollWidth();
    const h = docScrollHeight();
    for (let i = residueStamps.length - 1; i >= 0; i--) {
      if (now - residueStamps[i].fadeStart >= residueStamps[i].fadeMs) {
        residueStamps.splice(i, 1);
      }
    }
    if (residueStamps.length === 0) {
      residueRafId = 0;
      teardownResidueLayer();
      return;
    }
    residueCtx.clearRect(0, 0, w, h);
    const bg = pageBgRgb();
    const ink = stampRgb();
    const isHome = document.body.classList.contains("page-home");
    drawWithNavClip(residueCtx, () => {
      residueCtx.font = FONT;
      residueCtx.textBaseline = "middle";
      residueCtx.textAlign = "center";
      residueCtx.filter = "none";
      for (let i = 0; i < residueStamps.length; i++) {
        const r = residueStamps[i];
        const t = (now - r.fadeStart) / r.fadeMs;
        if (t >= 1) continue;
        const opacity = (1 - t) * 0.38;
        const colorMix = 0.18 + t * 0.78;
        const rgb = mixRgb(ink, bg, colorMix);
        const tw = Math.max(
          STAMP_SIZE_PX * 0.3 * r.text.length,
          STAMP_SIZE_PX * 0.52
        );
        const th = STAMP_SIZE_PX * 0.76;
        const rr = 10;

        residueCtx.save();
        residueCtx.translate(r.x, r.y);
        residueCtx.rotate(r.angle);
        residueCtx.globalCompositeOperation = "source-over";
        residueCtx.globalAlpha = opacity * 0.72;
        residueCtx.fillStyle = isHome
          ? "rgba(255,255,255,0.1)"
          : "rgba(255,255,255,0.14)";
        residueCtx.beginPath();
        if (typeof residueCtx.roundRect === "function") {
          residueCtx.roundRect(-tw / 2, -th / 2, tw, th, rr);
        } else {
          residueCtx.rect(-tw / 2, -th / 2, tw, th);
        }
        residueCtx.fill();
        residueCtx.globalAlpha = opacity * 0.42;
        residueCtx.strokeStyle = isHome
          ? "rgba(255,255,255,0.26)"
          : "rgba(0,0,0,0.12)";
        residueCtx.lineWidth = 1;
        residueCtx.stroke();
        residueCtx.globalAlpha = opacity;
        residueCtx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        residueCtx.fillText(r.text, 0, 0);
        residueCtx.restore();
      }
    });
    residueRafId = window.requestAnimationFrame(residueTick);
  }

  function tick() {
    if (!running || eroding || !ctx) return;
    const w = docScrollWidth();
    const h = docScrollHeight();
    const sigma = gaussianSigma(w, h);

    const c = tryCursorStampPath(
      cursorAnchorX,
      cursorAnchorY,
      targetX,
      targetY,
      sigma,
      w,
      h
    );
    cursorAnchorX = c.ax;
    cursorAnchorY = c.ay;

    burstTicker++;
    if (
      stamps.length < MAX_STAMPS &&
      (burstTicker & 1) === 0 &&
      Math.random() < AUTO_BURST_CHANCE
    ) {
      placeStampGaussian(targetX, targetY, sigma, w, h);
    }
    if (
      stamps.length < MAX_STAMPS &&
      (burstTicker & 1) === 0 &&
      Math.random() < EXTRA_BURST_CHANCE
    ) {
      placeStampGaussian(targetX, targetY, sigma * 0.72, w, h);
    }
    if (
      stamps.length < MAX_STAMPS &&
      burstTicker % 3 === 0 &&
      Math.random() < 0.2
    ) {
      placeStampGaussian(targetX, targetY, sigma * 1.05, w, h);
    }

    rafId = window.requestAnimationFrame(tick);
  }

  function resetEffectState() {
    stamps = [];
    cursorAnchorX = -1;
    cursorAnchorY = -1;
    burstTicker = 0;
    cssW = docScrollWidth();
    cssH = docScrollHeight();
    targetX = window.scrollX + window.innerWidth / 2;
    targetY = window.scrollY + window.innerHeight / 2;
  }

  function beginErosion() {
    if (eroding) return;
    eroding = true;
    running = false;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function erodeFromScroll() {
    if (!ctx || stamps.length === 0) {
      finishErosion();
      return;
    }
    idleExtraMs += IDLE_PENALTY_MS;
    let n = Math.max(
      ERODE_MIN,
      Math.floor(stamps.length * ERODE_FRAC) + ((Math.random() * 6) | 0)
    );
    n = Math.min(n, ERODE_MAX, stamps.length);
    const removed = [];
    const t0 = performance.now();
    const span = RESIDUE_FADE_MAX_MS - RESIDUE_FADE_MIN_MS;
    for (let i = 0; i < n; i++) {
      const idx = (Math.random() * stamps.length) | 0;
      removed.push({
        x: stamps[idx].x,
        y: stamps[idx].y,
        text: stamps[idx].text,
        angle: stamps[idx].angle,
        fadeStart: t0,
        fadeMs: RESIDUE_FADE_MIN_MS + Math.random() * span,
      });
      stamps[idx] = stamps[stamps.length - 1];
      stamps.pop();
    }
    if (removed.length > 0) {
      residueStamps.push(...removed);
      const over = residueStamps.length - MAX_RESIDUE_STAMPS;
      if (over > 0) {
        residueStamps.splice(0, over);
      }
      ensureResidueLayer();
      if (!residueRafId) {
        residueRafId = window.requestAnimationFrame(residueTick);
      }
    }
    redrawAllStamps();
    if (stamps.length === 0) {
      finishErosion();
    }
  }

  function finishErosion() {
    eroding = false;
    running = false;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    stamps = [];
    teardownCanvas();
    scheduleIdle();
  }

  function startEffect() {
    if (running || eroding) return;
    cancelStampScrollRedraw();
    window.clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = 0;
    teardownResidueLayer();
    running = true;
    ensureCanvas();
    resetEffectState();
    if (ctx) {
      const cw = docScrollWidth();
      const ch = docScrollHeight();
      ctx.clearRect(0, 0, cw, ch);
    }
    rafId = window.requestAnimationFrame(tick);
  }

  function stopEffect() {
    running = false;
    eroding = false;
    cancelStampScrollRedraw();
    window.clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = 0;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    stamps = [];
    teardownCanvas();
    teardownResidueLayer();
  }

  function scheduleIdle() {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(
      startEffect,
      IDLE_BASE_MS + idleExtraMs
    );
  }

  function onScrollActivity() {
    if (running || eroding) {
      scheduleStampScrollRedraw();
    }
    if (eroding) {
      erodeFromScroll();
      return;
    }
    if (running) {
      beginErosion();
      erodeFromScroll();
      return;
    }
    scheduleIdle();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.clearTimeout(idleTimer);
      stopEffect();
    } else {
      scheduleIdle();
    }
  });

  window.addEventListener(
    "mousemove",
    (e) => {
      targetX = e.pageX ?? e.clientX + window.scrollX;
      targetY = e.pageY ?? e.clientY + window.scrollY;
    },
    { passive: true }
  );
  window.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches && e.touches[0]) {
        const t = e.touches[0];
        targetX = t.pageX ?? t.clientX + window.scrollX;
        targetY = t.pageY ?? t.clientY + window.scrollY;
      }
    },
    { passive: true }
  );
  window.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches && e.touches[0]) {
        const t = e.touches[0];
        targetX = t.pageX ?? t.clientX + window.scrollX;
        targetY = t.pageY ?? t.clientY + window.scrollY;
      }
    },
    { passive: true }
  );
  window.addEventListener(
    "scroll",
    () => {
      onScrollActivity();
    },
    { passive: true, capture: true }
  );

  scheduleIdle();
})();
