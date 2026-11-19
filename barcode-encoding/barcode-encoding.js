"use strict";

/*
 * Rendering and input for the Barcode Encoding demo. All the tables, the bar
 * patterns and the state transitions live in barcode-encoding-core.js; this
 * file only draws them and listens to the controls.
 *
 * The play area has three parts: a strip of buttons, one per digit of the
 * code (the keyboard cursor), a canvas with the complete 95-module barcode,
 * and a zoomed canvas with the seven bars of the highlighted digit. Changing
 * any digit, mode or selection redraws all three and writes a sentence into
 * #status that says, in words, what changed.
 */
(() => {
  const Core = BarcodeEncodingCore;

  const stripEl = document.getElementById("digitStrip");
  const codeText = document.getElementById("codeText");
  const barcodeCanvas = document.getElementById("barcodeCanvas");
  const zoomCanvas = document.getElementById("zoomCanvas");
  const barcodeBox = document.getElementById("barcodeBox");
  const zoomBox = document.getElementById("zoomBox");
  const patternText = document.getElementById("patternText");
  const statusEl = document.getElementById("status");

  const modeUpc = document.getElementById("modeUpc");
  const modeEan = document.getElementById("modeEan");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const decBtn = document.getElementById("decBtn");
  const incBtn = document.getElementById("incBtn");
  const newBtn = document.getElementById("newBtn");

  let state = null;
  let change = "Opened the demonstration";

  /** One line under the game. "done" is how a demo is recorded as explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Design tokens are read at draw time, so a theme flip needs no reload. */
  let tokens = {};
  function refreshTokens() {
    const cs = getComputedStyle(document.documentElement);
    tokens = {
      ink: cs.getPropertyValue("--ink").trim(),
      accent: cs.getPropertyValue("--accent").trim(),
      muted: cs.getPropertyValue("--muted").trim(),
      stage: cs.getPropertyValue("--stage").trim(),
      border: cs.getPropertyValue("--border").trim(),
      highlight: cs.getPropertyValue("--highlight").trim(),
    };
  }

  function sizeCanvas(canvas, box, height) {
    const cssWidth = Math.max(220, Math.round(box.getBoundingClientRect().width));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, cssWidth, height };
  }

  /* A "generalized bar" is a run of equal colours. Say it out loud. */
  function runWords(pattern) {
    return Core.runs(pattern)
      .map((r) => `${r.color === 1 ? "black" : "white"} ${r.length}`)
      .join(", ");
  }

  function parityWords(system) {
    return Array.from({ length: 6 }, (_, i) => (Core.getLeftParity(system, i + 1) ? "odd" : "even")).join(", ");
  }

  function describe() {
    const code = state.digits.join("");
    const encoded = Core.encode(state);
    const i = state.cursor;
    const digit = state.digits[i];
    let detail;
    if (state.mode === "EAN-13" && i === 0) {
      detail = `Digit 1 is the system digit. It has no bars of its own; it makes the next six digits use ${parityWords(digit)} parity.`;
    } else {
      const digitSegs = encoded.segments.filter((s) => s.kind === "digit");
      const seg = digitSegs[state.mode === "EAN-13" ? i - 1 : i];
      detail = `Digit ${i + 1} is ${digit}, ${seg.parity} parity: ${runWords(seg.bits)}.`;
    }
    return `${change}. ${state.mode} code ${code}: ${encoded.bits.length} bars. ${detail}`;
  }

  function buildStrip() {
    stripEl.replaceChildren();
    state.digits.forEach((value, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "digit-cell" + (i === state.cursor ? " selected" : "");
      btn.textContent = String(value);
      const systemNote = state.mode === "EAN-13" && i === 0 ? ", the system digit" : "";
      btn.setAttribute("aria-label", `Digit ${i + 1}${systemNote}: ${value}`);
      btn.setAttribute("aria-pressed", i === state.cursor ? "true" : "false");
      btn.addEventListener("click", () => selectDigit(i));
      stripEl.appendChild(btn);
    });
  }

  function drawBarcode() {
    const { ctx, cssWidth, height } = sizeCanvas(barcodeCanvas, barcodeBox, 116);
    const encoded = Core.encode(state);
    const bits = encoded.bits;
    const m = cssWidth / bits.length; // one module, scaled to fit the panel
    ctx.fillStyle = tokens.stage;
    ctx.fillRect(0, 0, cssWidth, height);

    const barTop = 10;
    const barHeight = height - 32;
    const guards = isGuard(encoded);
    bits.forEach((bit, j) => {
      if (!bit) return;
      // Guards are drawn in the accent colour so the three marker groups read
      // as markers; the digit bars use the ordinary ink colour.
      ctx.fillStyle = guards[j] ? tokens.accent : tokens.ink;
      ctx.fillRect(j * m, barTop, Math.max(1, m - 0.15), barHeight);
    });

    // A thin accent rule under each guard, with a plain-language label that
    // stays inside the canvas at the left and right edges.
    ctx.fillStyle = tokens.accent;
    ctx.font = "0.72rem system-ui, sans-serif";
    let offset = 0;
    for (const s of encoded.segments) {
      if (s.kind === "guard") {
        const left = offset * m;
        const width = s.bits.length * m;
        ctx.fillRect(left, height - 12, width, 2);
        ctx.textAlign = s.which === "start" ? "left" : s.which === "end" ? "right" : "center";
        ctx.fillText(s.which, s.which === "start" ? left : s.which === "end" ? left + width : left + width / 2, height - 2);
      }
      offset += s.bits.length;
    }
    barcodeCanvas.setAttribute(
      "aria-label",
      `Barcode for ${state.mode} code ${state.digits.join("")}: ${bits.length} modules, with start, middle and end guard bars.`,
    );
  }

  // Guard membership as a mask over module indices, built once per draw.
  function isGuard(encoded) {
    const mask = [];
    let offset = 0;
    for (const s of encoded.segments) {
      for (let j = 0; j < s.bits.length; j++) mask[offset + j] = s.kind === "guard";
      offset += s.bits.length;
    }
    return mask;
  }

  function drawZoom() {
    const { ctx, cssWidth, height } = sizeCanvas(zoomCanvas, zoomBox, 96);
    const encoded = Core.encode(state);
    const digitSegs = encoded.segments.filter((s) => s.kind === "digit");
    // The EAN-13 system digit draws no bars: show the first digit it affects.
    const segIndex = state.mode === "EAN-13" ? Math.max(0, state.cursor - 1) : state.cursor;
    const seg = digitSegs[segIndex];
    const m = cssWidth / 7;
    ctx.fillStyle = tokens.stage;
    ctx.fillRect(0, 0, cssWidth, height);
    seg.bits.forEach((bit, j) => {
      ctx.fillStyle = bit ? tokens.ink : tokens.stage;
      ctx.fillRect(j * m + 1, 8, Math.max(1, m - 2), height - 22);
    });
    ctx.strokeStyle = tokens.border;
    ctx.lineWidth = 1;
    for (let j = 0; j <= 7; j++) {
      ctx.beginPath();
      ctx.moveTo(j * m, 8);
      ctx.lineTo(j * m, height - 14);
      ctx.stroke();
    }
    zoomCanvas.setAttribute(
      "aria-label",
      state.mode === "EAN-13" && state.cursor === 0
        ? `The system digit draws no bars. It sets the parity of digits 2 to 7: ${parityWords(state.digits[0])}. The first digit affected has bars ${runWords(seg.bits)}.`
        : `Seven bars of digit ${state.digits[state.cursor]}: ${runWords(seg.bits)}.`,
    );
    patternText.textContent = state.mode === "EAN-13" && state.cursor === 0
      ? `The system digit picks the parity of digits 2–7: ${parityWords(state.digits[0])}.`
      : `Digit ${state.cursor + 1} (${seg.parity} parity): ${runWords(seg.bits)} — four bars of alternating colour.`;
  }

  /** Redraw the canvases and the text without changing the last message. */
  function redraw() {
    refreshTokens();
    drawBarcode();
    drawZoom();
    codeText.textContent = state.digits.join(" ");
  }

  /** Full refresh: controls, position, status line and the saved position. */
  function render() {
    buildStrip();
    modeUpc.setAttribute("aria-pressed", state.mode === "UPC-A" ? "true" : "false");
    modeEan.setAttribute("aria-pressed", state.mode === "EAN-13" ? "true" : "false");
    redraw();
    say(describe(), "done");
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
    stripEl.querySelector(".selected").focus();
  }

  function selectDigit(i) {
    const before = state.cursor;
    state = Core.moveCursor(state, i - before);
    change = i === before
      ? `Digit ${i + 1} was already selected`
      : `Selected digit ${i + 1}`;
    render();
  }

  function selectRelative(delta) {
    const before = state.cursor;
    state = Core.moveCursor(state, delta);
    change = state.cursor === before
      ? `Already at ${before === 0 ? "the first" : "the last"} digit`
      : `Selected digit ${state.cursor + 1}`;
    render();
  }

  function changeDigit(delta) {
    const before = state.digits[state.cursor];
    state = Core.stepDigit(state, delta);
    const after = state.digits[state.cursor];
    change = after === before
      ? `Digit ${state.cursor + 1} stays at ${before}, ${delta < 0 ? "the smallest" : "the largest"} value`
      : `Changed digit ${state.cursor + 1} from ${before} to ${after}`;
    render();
  }

  function setMode(mode) {
    const from = state.mode;
    state = Core.setMode(state, mode);
    if (from === mode) {
      change = `Already using ${mode}`;
    } else if (mode === "EAN-13") {
      change = "Switched to EAN-13 and prepended a 0 system digit";
    } else {
      change = "Switched to UPC-A and dropped the leading system digit; the left six use odd parity again";
    }
    render();
  }

  function newCode() {
    const len = state.mode === "EAN-13" ? 13 : 12;
    const prefix = Array.from({ length: len - 1 }, () => Math.floor(Math.random() * 10));
    const code = prefix.concat(Core.checkDigit(prefix, state.mode));
    state = Core.withDigits(state, code);
    change = `Made a new valid ${state.mode} code ${code.join("")}`;
    render();
  }

  modeUpc.addEventListener("click", () => setMode("UPC-A"));
  modeEan.addEventListener("click", () => setMode("EAN-13"));
  prevBtn.addEventListener("click", () => selectRelative(-1));
  nextBtn.addEventListener("click", () => selectRelative(1));
  decBtn.addEventListener("click", () => changeDigit(-1));
  incBtn.addEventListener("click", () => changeDigit(1));
  newBtn.addEventListener("click", newCode);

  stripEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); selectRelative(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); selectRelative(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); changeDigit(1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); changeDigit(-1); }
    else if (e.key === "Home") { e.preventDefault(); selectDigit(0); }
    else if (e.key === "End") { e.preventDefault(); selectDigit(state.digits.length - 1); }
  });

  window.addEventListener("themechange", redraw);
  window.addEventListener("resize", redraw);

  state = Core.start({});
  render();
})();
