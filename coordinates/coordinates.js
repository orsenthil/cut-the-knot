"use strict";

/*
 * The page for Coordinates: drawing and input only; the arithmetic lives in
 * coordinates-core.js. One 360 by 360 canvas shows the axes with a tick and a
 * number at every unit, and two red handles: the origin and the unit point
 * (1, 0). Drag them with a pointer, or focus the canvas and press O, U or C to
 * choose the origin, the unit point or the cursor and move with the arrow
 * keys. The cursor reads the coordinates of the lattice point nearest to it,
 * as a pair or in complex form. Three number boxes set the origin and the unit
 * without a pointer.
 */

(function () {
  const Core = CoordinatesCore;
  const board = document.getElementById("board");
  const ctx = board.getContext("2d");
  const statusEl = document.getElementById("status");
  const readoutEl = document.getElementById("reading");
  const gridBox = document.getElementById("gridBox");
  const traceBox = document.getElementById("traceBox");
  const formatSel = document.getElementById("formatSel");
  const oxIn = document.getElementById("oxIn");
  const oyIn = document.getElementById("oyIn");
  const unitIn = document.getElementById("unitIn");
  const resetBtn = document.getElementById("resetBtn");
  const N = Core.SIZE;
  const RED = "#d4565a";

  let state = Core.start();
  let cursor = null; // pixel position of the cursor, or null
  let selected = "origin"; // for the keyboard
  let dragging = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const colour = (styles, name, fallback) => styles.getPropertyValue(name).trim() || fallback;

  function line(x1, y1, x2, y2, c, w) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function handle(p, name, active, ink) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = RED;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = active ? ink : "transparent";
    ctx.stroke();
  }

  function draw() {
    const styles = getComputedStyle(document.documentElement);
    const stage = colour(styles, "--stage", "#f3f5f8");
    const ink = colour(styles, "--ink", "#1f2430");
    const muted = colour(styles, "--muted", "#5d6472");
    const accent = colour(styles, "--accent", "#5b4ee8");
    ctx.clearRect(0, 0, N, N);
    ctx.fillStyle = stage;
    ctx.fillRect(0, 0, N, N);
    const { ox, oy, unit } = state;
    const r = Core.latticeRange(state);

    if (state.grid) {
      ctx.fillStyle = muted;
      for (let x = r.xmin; x <= r.xmax; x++) for (let y = r.ymin; y <= r.ymax; y++) {
        const p = Core.pixelOf(state, x, y);
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      }
    }
    line(0, oy, N, oy, ink, 1.5);
    line(ox, 0, ox, N, ink, 1.5);

    // Ticks and numbers at every unit (thinned when the unit is short, so the numbers stay readable).
    const every = Math.max(1, Math.ceil(26 / unit));
    ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = muted;
    for (let x = r.xmin; x <= r.xmax; x++) {
      const p = Core.pixelOf(state, x, 0);
      line(p.x, oy - 3, p.x, oy + 3, ink, 1);
      if (x !== 0 && x % every === 0) { ctx.textAlign = "center"; ctx.textBaseline = oy > N - 16 ? "bottom" : "top"; ctx.fillText(String(x), p.x, oy > N - 16 ? oy - 6 : oy + 5); }
    }
    for (let y = r.ymin; y <= r.ymax; y++) {
      const p = Core.pixelOf(state, 0, y);
      line(ox - 3, p.y, ox + 3, p.y, ink, 1);
      if (y !== 0 && y % every === 0) { ctx.textAlign = ox > N - 24 ? "right" : "left"; ctx.textBaseline = "middle"; ctx.fillText(String(y), ox > N - 24 ? ox - 6 : ox + 6, p.y); }
    }
    ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText("x", N - 4, Math.max(14, Math.min(N - 4, oy - 4)));
    ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("y", Math.max(2, Math.min(N - 12, ox + 5)), 3);

    // The cursor: the lattice point it reads.
    if (cursor) {
      const q = Core.modelCoordinates(state, cursor.x, cursor.y);
      const p = Core.pixelOf(state, q.x, q.y);
      ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 2 * Math.PI); ctx.stroke();
      line(cursor.x - 6, cursor.y, cursor.x + 6, cursor.y, accent, 1);
      line(cursor.x, cursor.y - 6, cursor.x, cursor.y + 6, accent, 1);
      if (state.trace) {
        const text = Core.reading(state, cursor.x, cursor.y);
        ctx.font = "bold 14px ui-sans-serif, system-ui, sans-serif";
        const w = ctx.measureText(text).width;
        const tx = Math.max(2, Math.min(N - w - 2, cursor.x - w / 2));
        const ty = cursor.y > 24 ? cursor.y - 10 : cursor.y + 24;
        ctx.fillStyle = stage; ctx.globalAlpha = 0.85; ctx.fillRect(tx - 2, ty - 15, w + 4, 18); ctx.globalAlpha = 1;
        ctx.fillStyle = accent; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(text, tx, ty);
      }
    }
    handle({ x: ox, y: oy }, "origin", selected === "origin", ink);
    handle(Core.pixelOf(state, 1, 0), "unit", selected === "unit", ink);
  }

  function updateText() {
    oxIn.value = String(state.ox);
    oyIn.value = String(state.oy);
    unitIn.value = String(state.unit);
    gridBox.checked = state.grid;
    traceBox.checked = state.trace;
    formatSel.value = state.format;
    readoutEl.textContent = cursor
      ? `Nearest lattice point: ${Core.reading(state, cursor.x, cursor.y)} (${state.format === "complex" ? "complex form" : "ordered pair"}).`
      : "Move the pointer over the board, or focus it and press C, to read a coordinate.";
  }

  function render() {
    draw();
    updateText();
    if (window.Track) window.Track.state(state);
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render();
    say(note || `Origin at pixel (${state.ox}, ${state.oy}); one unit is ${state.unit} pixels.`, Core.result(state));
    return true;
  }

  function toBoard(e) {
    const rect = board.getBoundingClientRect();
    return { x: Math.round(((e.clientX - rect.left) * N) / rect.width), y: Math.round(((e.clientY - rect.top) * N) / rect.height) };
  }

  board.addEventListener("pointerdown", (e) => {
    const p = toBoard(e);
    const u = Core.pixelOf(state, 1, 0);
    const reach = 14 * (N / board.getBoundingClientRect().width);
    const dOrigin = Math.hypot(p.x - state.ox, p.y - state.oy), dUnit = Math.hypot(p.x - u.x, p.y - u.y);
    if (Math.min(dOrigin, dUnit) > reach) return;
    dragging = dUnit < dOrigin ? "unit" : "origin";
    selected = dragging;
    board.setPointerCapture(e.pointerId);
    board.focus();
    e.preventDefault();
    render();
  });
  board.addEventListener("pointermove", (e) => {
    const p = toBoard(e);
    if (dragging === "origin") apply({ type: "origin", x: p.x, y: p.y });
    else if (dragging === "unit") apply({ type: "unit", x: p.x });
    else { cursor = p; draw(); updateText(); }
  });
  const stop = () => { dragging = null; };
  board.addEventListener("pointerup", stop);
  board.addEventListener("pointercancel", stop);
  board.addEventListener("pointerleave", () => { if (!dragging && state.trace === false) { cursor = null; draw(); updateText(); } });

  board.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "o" || k === "u" || k === "c") {
      selected = k === "o" ? "origin" : k === "u" ? "unit" : "cursor";
      if (selected === "cursor" && !cursor) cursor = { x: state.ox, y: state.oy };
      render();
      say(selected === "cursor" ? "Cursor selected. Arrow keys move it." : (selected === "origin" ? "Origin selected." : "Unit point selected.") + " Arrow keys move it.");
      e.preventDefault();
      return;
    }
    const d = { arrowleft: [-10, 0], arrowright: [10, 0], arrowup: [0, -10], arrowdown: [0, 10] }[k];
    if (!d) return;
    e.preventDefault();
    if (selected === "origin") apply({ type: "origin", x: state.ox + d[0], y: state.oy + d[1] });
    else if (selected === "unit") { if (!apply({ type: "unit", x: state.ox + state.unit + d[0] })) say("The unit cannot be shorter than " + Core.MIN_UNIT + " pixels."); }
    else {
      cursor = { x: Math.max(0, Math.min(N, (cursor ? cursor.x : state.ox) + d[0])), y: Math.max(0, Math.min(N, (cursor ? cursor.y : state.oy) + d[1])) };
      render();
      say(`The cursor reads ${Core.reading(state, cursor.x, cursor.y)}.`);
    }
  });

  gridBox.addEventListener("change", () => apply({ type: "grid", value: gridBox.checked }, gridBox.checked ? "Grid shown." : "Grid hidden."));
  traceBox.addEventListener("change", () => apply({ type: "trace", value: traceBox.checked }, traceBox.checked ? "The reading follows the cursor." : "The reading is shown below only."));
  formatSel.addEventListener("change", () => apply({ type: "format", value: formatSel.value }, formatSel.value === "complex" ? "Readings are in complex form." : "Readings are ordered pairs."));
  const typed = (fn) => (e) => { if (!fn(Number(e.target.value))) say("That value is not allowed."); updateText(); };
  oxIn.addEventListener("change", typed((v) => apply({ type: "origin", x: v, y: state.oy })));
  oyIn.addEventListener("change", typed((v) => apply({ type: "origin", x: state.ox, y: v })));
  unitIn.addEventListener("change", typed((v) => apply({ type: "unit", x: state.ox + v })));
  resetBtn.addEventListener("click", () => { cursor = null; selected = "origin"; apply({ type: "reset" }); say("Back to the opening picture."); });
  window.addEventListener("themechange", draw);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);

  render();
})();
