"use strict";

/*
 * The page for the Delian construction: drawing and input only; the geometry is
 * in delian-core.js. An SVG draws the reader's construction as the applet does:
 * the right triangle ABC, the point D, the square-root-of-2 arc, the Golden
 * Triangle BFD, the N radials from A, and the parallels that carry the
 * intersections down to AB. A table and a small bar chart set the points the
 * construction gives on AB against the 2^(k/N) the reader claims.
 */

(function () {
  const Core = DelianCore;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.getElementById("figure");
  const bars = document.getElementById("bars");
  const body = document.getElementById("rows");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn");
  const less = document.getElementById("nLess");
  const more = document.getElementById("nMore");
  const showArc = document.getElementById("arcBox");
  const summary = document.getElementById("summary");

  let state = Core.start();

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const el = (name, attrs, text) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    return n;
  };

  // The picture is drawn in the construction's own units: B at the origin, y up, drawn with y down.
  const X = (p) => p[0], Y = (p) => -p[1];
  const seg = (p, q, cls, extra) => svg.appendChild(el("line", { x1: X(p), y1: Y(p), x2: X(q), y2: Y(q), class: cls, ...(extra || {}) }));
  const dot = (p, cls, r) => svg.appendChild(el("circle", { cx: X(p), cy: Y(p), r: r || 0.022, class: cls }));
  const label = (p, text, dx, dy, cls) => svg.appendChild(el("text", { x: X(p) + dx, y: Y(p) + dy, class: cls || "pt" }, text));

  function drawFigure() {
    const c = Core.construct(state.n);
    svg.textContent = "";
    svg.setAttribute("viewBox", "-1.35 -2.25 1.95 2.55");
    // The triangle, the golden triangle and the compass arc.
    seg(c.A, c.B, "tri"); seg(c.B, c.C, "tri"); seg(c.C, c.A, "tri");
    seg(c.B, c.F, "gold"); seg(c.D, c.F, "gold"); seg(c.F, c.X, "gold thin");
    if (showArc.checked) {
      seg(c.D, c.E, "aux"); seg(c.A, c.E, "aux");
      const r = Math.SQRT2;
      svg.appendChild(el("path", { d: `M ${X(c.E)} ${Y(c.E)} A ${r} ${r} 0 0 1 ${X(c.X)} ${Y(c.X)}`, class: "aux" }));
      dot(c.E, "aux-dot");
    }
    // Radials, intersections and the parallels down to AB.
    c.divisions.forEach((d) => {
      if (d.i > 0) seg(c.A, d.P, "radial");
      if (d.i > 0) {
        seg(d.Q, d.S, "par"); seg(d.R, d.T, "par");
        dot(d.Q, "xdot", 0.016); dot(d.R, "xdot", 0.016);
      }
    });
    // The points on AB: the construction's (filled) and the reader's claim 2^(k/N) (rings).
    const rows = Core.positions(state.n);
    rows.forEach((r) => {
      dot([0, 2 - r.got], "got", 0.026);
      svg.appendChild(el("circle", { cx: 0.06, cy: -(2 - r.claimed), r: 0.02, class: "claim" }));
    });
    label(c.A, "A", 0.03, -0.03); label(c.B, "B", 0.03, 0.09); label(c.C, "C", -0.08, 0.09); label(c.D, "D", 0.03, 0.02);
    label(c.F, "F", -0.08, 0.0); label(c.X, "x", 0.04, 0.04, "pt small");
  }

  function drawBars(rows) {
    bars.textContent = "";
    const inner = rows.slice(1, -1);
    if (!inner.length) return;
    const max = Math.max(...inner.map((r) => Math.abs(r.error)), 1e-9);
    const w = 20, h = 80;
    bars.setAttribute("viewBox", `0 0 ${inner.length * w + 10} ${h + 22}`);
    bars.appendChild(el("line", { x1: 0, x2: inner.length * w + 10, y1: h / 2, y2: h / 2, class: "axis" }));
    inner.forEach((r, i) => {
      const bh = (Math.abs(r.error) / max) * (h / 2 - 4);
      bars.appendChild(el("rect", { x: 5 + i * w + 3, y: r.error >= 0 ? h / 2 - bh : h / 2, width: w - 6, height: Math.max(bh, 0.5), class: r.error >= 0 ? "pos" : "neg" }));
      bars.appendChild(el("text", { x: 5 + i * w + w / 2, y: h + 12, class: "bn" }, String(r.k)));
    });
  }

  function updateTable() {
    const rows = Core.positions(state.n);
    body.textContent = "";
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      const exact = Math.abs(r.error) < 1e-12;
      const cells = [String(r.k), r.got.toFixed(5), r.claimed.toFixed(5), exact ? "0" : (r.error * 1000).toFixed(3)];
      cells.forEach((t, i) => { const td = document.createElement(i ? "td" : "th"); if (!i) td.scope = "row"; td.textContent = t; tr.appendChild(td); });
      if (exact) tr.className = "exact";
      body.appendChild(tr);
    });
    drawBars(rows);
    const w = Core.worst(state.n);
    const exactCount = rows.filter((r) => Math.abs(r.error) < 1e-12).length;
    summary.textContent = state.n === 2
      ? "With N = 2 the single mean proportional is √2, and the construction gets it exactly."
      : `N = ${state.n}: only ${exactCount} of the ${rows.length} points (${exactCount === 2 ? "the two ends" : "the two ends and the middle"}) are exactly right. The worst is k = ${w.k}: ${w.got.toFixed(5)} instead of ${w.claimed.toFixed(5)} (${(Math.abs(w.relativeError) * 100).toFixed(3)}% out).`;
  }

  function render() {
    drawFigure();
    updateTable();
    nIn.value = String(state.n);
    less.disabled = state.n <= Core.MIN_N;
    more.disabled = state.n >= Core.MAX_N;
    if (window.Track) window.Track.state(state);
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render();
    const kind = Core.result(state);
    say(kind ? `N = ${state.n}: ${summary.textContent} Where does the reasoning go wrong?` : note || summary.textContent, kind);
    return true;
  }

  less.addEventListener("click", () => apply({ type: "n", dir: -1 }));
  more.addEventListener("click", () => apply({ type: "n", dir: 1 }));
  nIn.addEventListener("change", () => { if (!apply({ type: "n", value: Math.trunc(Number(nIn.value)) })) { say("N is a whole number from 2 to 20."); nIn.value = String(state.n); } });
  showArc.addEventListener("change", () => { drawFigure(); say(showArc.checked ? "The compass arc is drawn: AE = √2, carried to AB at x." : "The compass arc is hidden."); });
  document.getElementById("resetBtn").addEventListener("click", () => { state = { ...Core.start(), explored: false }; render(); say(""); });
  window.addEventListener("themechange", render);

  render();
})();
