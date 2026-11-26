"use strict";

/*
 * The page for the geometric Sieve of Eratosthenes: drawing and input only;
 * the marking is in primes-from-triangle-core.js. A canvas draws rows 0..N of
 * the triangle of dots, with row numbers on the left and, if asked, the prime
 * rows shaded. Clicking a dot lights up its siblings, descendants and
 * ancestors (as the check boxes choose); clicking between dots draws the
 * triangle that row hangs on the rows below. Keyboard: the arrow keys move a
 * cursor, Enter picks the dot, T draws its row's triangle.
 */

(function () {
  const Core = PrimesFromTriangleCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const infoEl = document.getElementById("info");
  const rowsIn = document.getElementById("rowsIn");
  const boxes = { primes: document.getElementById("primesBox"), descendants: document.getElementById("descBox"), ancestors: document.getElementById("ancBox"), siblings: document.getElementById("sibBox") };
  const stepBtn = document.getElementById("stepBtn");
  const W = canvas.width, Hc = canvas.height, LABEL = 34, MARGIN = 8;
  let state = Core.start({});
  let marks = Core.marks(state.step), marksFor = state.step;
  let cursor = [4, 2];

  const tok = (st, n, f) => st.getPropertyValue(n).trim() || f;

  /** The last row drawn: rows 0..N, but the triangle only has rows 0..99 (the applet overran it at 100). */
  const lastRow = () => Math.min(state.rows, Core.MAX - 1);

  /** Row height and dot spacing so rows 0..N fit: an equilateral grid. */
  function geometry() {
    const n = lastRow();
    const h = Math.min((Hc - 2 * MARGIN) / (n + 1), (W - LABEL - 2 * MARGIN) / (n * 2 / Math.sqrt(3) + 1));
    const dx = (2 * h) / Math.sqrt(3);
    const cx = LABEL + (W - LABEL) / 2;
    return { h, dx, xy: (r, k) => [cx - (r * dx) / 2 + k * dx, MARGIN + r * h + h / 2] };
  }

  function draw() {
    const st = getComputedStyle(document.documentElement);
    const stage = tok(st, "--stage", "#f3f5f8"), ink = tok(st, "--ink", "#1f2430"), muted = tok(st, "--muted", "#5d6472"), border = tok(st, "--border-strong", "#cdd2da"),
      accent = tok(st, "--accent", "#5b4ee8"), good = tok(st, "--good", "#15803d"), bad = tok(st, "--bad", "#c2362b"), hi = tok(st, "--highlight", "rgba(255,214,10,0.35)"), focus = tok(st, "--focus", "rgba(91,78,232,0.45)");
    if (marksFor !== state.step) { marks = Core.marks(state.step); marksFor = state.step; }
    const { h, xy } = geometry();
    const n = lastRow();
    ctx.fillStyle = stage; ctx.fillRect(0, 0, W, Hc);
    if (state.showPrimes) {
      ctx.fillStyle = hi;
      for (let r = 2; r <= n; r++) if (Core.isPrime(r)) ctx.fillRect(0, MARGIN + r * h, W, h);
    }
    ctx.fillStyle = muted; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.font = `${Math.max(7, Math.min(14, h * 0.75))}px system-ui, sans-serif`;
    const labelEvery = h < 8 ? 5 : 1;
    for (let r = 0; r <= n; r++) if (r % labelEvery === 0) ctx.fillText(String(r), LABEL - 6, MARGIN + r * h + h / 2);

    // The triangle of one step: the frame row picked, else the row just processed.
    const tri = state.frame !== null ? state.frame : state.step > 1 && state.step < Core.MAX - 1 ? state.step : null;
    if (tri !== null && tri >= 1 && tri <= n) {
      const [x1, y] = xy(tri, 0), [x2] = xy(tri, tri), [x3, y3] = xy(2 * tri, tri);
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.lineTo(x3, y3); ctx.closePath(); ctx.stroke();
    }

    const light = Core.highlights(state);
    const colour = { hit: accent, sibling: good, descendant: bad, ancestor: "#d08700" };
    const big = Math.max(1.5, h * 0.3), small = Math.max(1, h * 0.14);
    for (let r = 0; r <= n; r++) for (let k = 0; k <= r; k++) {
      const [x, y] = xy(r, k);
      const l = light.get(`${r},${k}`);
      ctx.beginPath();
      if (l) { ctx.fillStyle = colour[l]; ctx.arc(x, y, big * 1.25, 0, 2 * Math.PI); ctx.fill(); continue; }
      if (marks[r][k]) { ctx.fillStyle = ink; ctx.arc(x, y, big, 0, 2 * Math.PI); ctx.fill(); }
      else { ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.arc(x, y, small, 0, 2 * Math.PI); ctx.stroke(); }
    }
    if (document.activeElement === canvas) {
      const [x, y] = xy(...cursor);
      ctx.strokeStyle = focus; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, Math.max(6, h * 0.5), 0, 2 * Math.PI); ctx.stroke();
    }
  }

  function describeDot(r, k) {
    const g = Core.gcd(r, k);
    const edge = k === 0 || k === r;
    let t = `Dot (${r}, ${k}): ${edge ? "on the edge, marked from the start" : marks[r][k] ? "marked" : "not marked"}, gcd(${r}, ${k}) = ${g}.`;
    if (!edge && r >= 2) t += ` Its top ancestors: ${Core.progenitors(r, k).map((p) => `(${p.join(", ")})`).join(" and ")}.`;
    return t;
  }

  function render() {
    draw();
    const lines = [];
    lines.push(state.step >= Core.MAX - 1 ? "All rows processed: the finished picture." : state.step < 2 ? "Cleared: only the edges are marked. Press One step." : `Rows 2 to ${state.step} processed; the triangle shows row ${state.step}'s step.`);
    if (state.picked) lines.push(describeDot(...state.picked));
    else if (state.frame !== null) lines.push(`Row ${state.frame} turned about its two ends: the triangle down to row ${2 * state.frame}.`);
    if (document.activeElement === canvas && !(state.picked && state.picked.join() === cursor.join())) lines.push(`Cursor: ${describeDot(...cursor)}`);
    infoEl.textContent = lines.join(" ");
    rowsIn.value = String(state.rows);
    boxes.primes.checked = state.showPrimes;
    for (const k of ["descendants", "ancestors", "siblings"]) boxes[k].checked = state.show[k];
    stepBtn.disabled = state.step >= Core.MAX - 1;
    if (window.Track) window.Track.state(state);
  }

  function pointAt(e) {
    const rect = canvas.getBoundingClientRect();
    return [(e.clientX - rect.left) * (W / rect.width), (e.clientY - rect.top) * (Hc / rect.height)];
  }

  canvas.addEventListener("click", (e) => {
    const [px, py] = pointAt(e);
    const { h, dx, xy } = geometry();
    const r = Math.floor((py - MARGIN) / h);
    if (r < 0 || r > lastRow()) return;
    const [x0] = xy(r, 0);
    const k = Math.round((px - x0) / dx);
    const touch = Math.max(dx * 0.5, 8 * (W / canvas.getBoundingClientRect().width) * 0.5);
    if (k >= 0 && k <= r && Math.abs(px - xy(r, k)[0]) <= touch) {
      cursor = [r, k];
      state = { ...state, picked: [r, k], frame: null };
    } else state = { ...state, picked: null, frame: r };
    render();
  });
  canvas.addEventListener("keydown", (e) => {
    let [r, k] = cursor;
    const n = lastRow();
    if (e.key === "ArrowLeft") k--; else if (e.key === "ArrowRight") k++;
    else if (e.key === "ArrowUp") { r--; } else if (e.key === "ArrowDown") { r++; }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); state = { ...state, picked: cursor.slice(), frame: null }; render(); return; }
    else if (e.key === "t" || e.key === "T") { state = { ...state, picked: null, frame: cursor[0] }; render(); return; }
    else return;
    e.preventDefault();
    r = Math.max(0, Math.min(n, r)); k = Math.max(0, Math.min(r, k));
    cursor = [r, k];
    render();
  });
  canvas.addEventListener("focus", render);
  canvas.addEventListener("blur", render);

  rowsIn.addEventListener("change", () => {
    const v = Math.round(Number(rowsIn.value));
    state = { ...state, rows: Number.isFinite(v) ? Math.max(Core.ROWS_MIN, Math.min(Core.ROWS_MAX, v)) : state.rows };
    if (state.picked && state.picked[0] > lastRow()) state = { ...state, picked: null };
    cursor = [Math.min(cursor[0], lastRow()), Math.min(cursor[1], Math.min(cursor[0], lastRow()))];
    render();
  });
  boxes.primes.addEventListener("change", () => { state = { ...state, showPrimes: boxes.primes.checked }; render(); });
  for (const k of ["descendants", "ancestors", "siblings"]) boxes[k].addEventListener("change", () => { state = { ...state, show: { ...state.show, [k]: boxes[k].checked } }; render(); });
  stepBtn.addEventListener("click", () => { state = Core.oneStep(state); render(); });
  document.getElementById("clearBtn").addEventListener("click", () => { state = Core.clear(state); render(); });
  window.addEventListener("themechange", render);
  render();
})();
