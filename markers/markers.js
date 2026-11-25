"use strict";

/*
 * The page for Fair Division: Method of Markers: drawing and input only. One
 * SVG: the goods as a bar at the top (pieces in their owners' colours, the
 * leftover in black) and a line for each player with draggable marker bars.
 * Arrow keys move a focused marker. The rules are in markers-core.js.
 */

(function () {
  const Core = MarkersCore;
  const svg = document.getElementById("board");
  const roundsEl = document.getElementById("rounds");
  const statusEl = document.getElementById("status");
  const nEl = document.getElementById("n");
  const nOut = document.getElementById("nOut");
  const NS = "http://www.w3.org/2000/svg";
  const COLOURS = ["#8f86ff", "#3fb27f", "#f0b247", "#ec7a66", "#4aa3df", "#c77dd6", "#8ab33f", "#e07fa0", "#41b6b6", "#b58a5a"];
  const X0 = 36, VW = 460, ROW = 34, TOP = 18;

  let state = null, drag = null, focusKey = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function render() {
    const n = state.n, d = Core.divide(state), H = TOP + 40 + n * ROW;
    nOut.textContent = n;
    svg.setAttribute("viewBox", `0 0 ${VW} ${H}`);
    svg.textContent = "";
    // the goods
    el("rect", { x: X0, y: TOP, width: state.rail, height: 22, class: "left" }, svg);
    for (const a of d.awards) if (a.to > a.from) {
      el("rect", { x: X0 + a.from, y: TOP, width: a.to - a.from, height: 22, fill: COLOURS[a.player], class: "goods" }, svg);
      if (a.to - a.from > 16) { const t = el("text", { x: X0 + (a.from + a.to) / 2, y: TOP + 15, "text-anchor": "middle", class: "on-colour" }, svg); t.textContent = a.player + 1; }
    }
    // the players
    for (let p = 0; p < n; p++) {
      const y = TOP + 40 + p * ROW, win = d.awards.find((a) => a.player === p);
      const lab = el("text", { x: 2, y: y + 5 }, svg); lab.textContent = "P" + (p + 1);
      el("rect", { x: X0, y: y - 2, width: state.rail, height: 4, rx: 2, class: "track" }, svg);
      if (win) el("rect", { x: X0 + win.from, y: y - 6, width: Math.max(win.to - win.from, 1), height: 12, rx: 3, fill: COLOURS[p], class: "piece" }, svg);
      state.markers[p].forEach((x, j) => {
        el("rect", { x: X0 + x - 16, y: y - 17, width: 32, height: 34, class: "hit", "data-p": p, "data-j": j }, svg);
        const h = el("rect", { x: X0 + x - 4, y: y - 12, width: 8, height: 24, rx: 3, class: "handle", tabindex: 0, role: "slider", "aria-valuemin": 0, "aria-valuemax": state.rail, "aria-valuenow": x,
          "aria-label": `Player ${p + 1}, marker ${j + 1}`, "data-p": p, "data-j": j }, svg);
        if (focusKey === p + "," + j) h.focus();
      });
    }
    // the rounds
    roundsEl.textContent = "";
    d.awards.forEach((a, i) => {
      const li = document.createElement("li");
      li.textContent = `Player ${a.player + 1} gets ${a.from} to ${a.to}` + (i === n - 1 ? " (the last one left)" : "");
      roundsEl.appendChild(li);
    });
    const left = Core.leftover(d);
    say(`Everyone gets a piece they accept. ${left} of ${state.rail} units (${Math.round((100 * left) / state.rail)}%) are left over.`, "done");
    if (window.Track) window.Track.state({ n, markers: state.markers, leftover: left });
  }

  const toPos = (e) => { const r = svg.getBoundingClientRect(); return ((e.clientX - r.left) * VW) / r.width - X0; };

  svg.addEventListener("pointerdown", (e) => {
    const t = e.target;
    if (t.classList && (t.classList.contains("handle") || t.classList.contains("hit"))) {
      drag = { p: Number(t.dataset.p), j: Number(t.dataset.j) };
      focusKey = drag.p + "," + drag.j;
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const next = Core.move(state, drag.p, drag.j, toPos(e));
    if (next) { state = next; render(); }
  });
  const release = () => { drag = null; };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);
  svg.addEventListener("keydown", (e) => {
    const t = e.target;
    if (!t.classList || !t.classList.contains("handle")) return;
    const p = Number(t.dataset.p), j = Number(t.dataset.j), step = e.shiftKey ? 10 : 1;
    const dir = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[e.key];
    if (dir === undefined) return;
    e.preventDefault();
    const next = Core.move(state, p, j, state.markers[p][j] + dir);
    focusKey = p + "," + j;
    if (next) { state = next; render(); }
  });

  function newGame() {
    state = Core.start({ n: nEl.value });
    nEl.value = state.n; focusKey = null;
    render();
  }
  nEl.addEventListener("input", newGame);
  document.getElementById("newBtn").addEventListener("click", newGame);
  window.addEventListener("themechange", render);
  newGame();
})();
