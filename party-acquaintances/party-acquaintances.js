"use strict";

/*
 * The page for Party Acquaintances: drawing and input only; the rules are
 * in party-acquaintances-core.js. An SVG shows the N people round a circle
 * and the lines drawn so far, red or blue. Click (or Enter on) one person,
 * then another, to join them. When a red group of #Red people or a blue
 * group of #Blue people appears, it is drawn thick and the drawing ends.
 */

(function () {
  const Core = PartyAcquaintancesCore;
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn"), redIn = document.getElementById("redIn"), blueIn = document.getElementById("blueIn");
  const autoBox = document.getElementById("autoBox");
  const removeBtn = document.getElementById("removeBtn");
  const NS = "http://www.w3.org/2000/svg";
  const CX = 200, CY = 200, RAD = 160;

  let state = Core.start();
  let picked = null, refocus = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }
  function el(name, attrs, cls, text) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const pos = (i) => { const t = (2 * Math.PI * i) / state.n - Math.PI / 2; return [CX + RAD * Math.cos(t), CY + RAD * Math.sin(t)]; };

  function render() {
    svg.textContent = "";
    const ck = Core.check(state);
    const thick = new Set();
    for (const [set, colour] of [...ck.red.map((x) => [x, "red"]), ...ck.blue.map((x) => [x, "blue"])])
      for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) thick.add(`${set[i]}-${set[j]}-${colour}`);
    for (const [a, b, red] of state.edges) {
      const [x1, y1] = pos(a), [x2, y2] = pos(b);
      const k = `${Math.min(a, b)}-${Math.max(a, b)}-${red ? "red" : "blue"}`;
      svg.appendChild(el("line", { x1, y1, x2, y2 }, `edge ${red ? "red" : "blue"}${thick.has(k) ? " clique" : ""}`));
    }
    for (let i = 0; i < state.n; i++) {
      const [x, y] = pos(i);
      const g = el("g", { tabindex: "0", role: "button", transform: `translate(${x},${y})` }, `node${picked === i ? " picked" : ""}`);
      g.dataset.i = String(i);
      g.setAttribute("aria-label", `Person ${i + 1}${picked === i ? ", picked" : ""}`);
      g.appendChild(el("circle", { r: state.n > 12 ? 13 : 17 }));
      g.appendChild(el("text", { y: 5 }, "", String(i + 1)));
      svg.appendChild(g);
    }
    if (refocus !== null) { const f = svg.querySelector(`.node[data-i="${refocus}"]`); if (f) f.focus(); refocus = null; }
    removeBtn.disabled = !state.edges.length;
    const total = (state.n * (state.n - 1)) / 2;
    const list = (sets) => sets.map((s) => s.map((i) => i + 1).join("-")).join(", ");
    if (ck.red.length || ck.blue.length) {
      const parts = [];
      if (ck.red.length) parts.push(`${state.nRed} people who all know each other (red): ${list(ck.red)}`);
      if (ck.blue.length) parts.push(`${state.nBlue} mutual strangers (blue): ${list(ck.blue)}`);
      say(`Found ${parts.join("; and ")}.`, "done");
    } else if (ck.complete) say(`All ${total} lines drawn and no red group of ${state.nRed} or blue group of ${state.nBlue}: so R(${state.nRed}, ${state.nBlue}) > ${state.n}.`, "done");
    else say(`${state.edges.length} of ${total} lines. ${picked !== null ? `Person ${picked + 1} picked: now pick another.` : `Next line: ${state.autoColor ? (state.nextRed ? "red" : "blue") : state.useRed ? "red" : "blue"}.`}`);
    if (window.Track) window.Track.state({ n: state.n, nRed: state.nRed, nBlue: state.nBlue, autoColor: state.autoColor, useRed: state.useRed, nextRed: state.nextRed, edges: state.edges });
  }

  function pick(i) {
    if (picked === null || picked === i) { picked = picked === i ? null : i; refocus = i; render(); return; }
    const s = Core.draw(state, picked, i);
    if (s) state = s;
    picked = null; refocus = i;
    render();
  }
  svg.addEventListener("click", (e) => { const g = e.target.closest(".node"); if (g) pick(Number(g.dataset.i)); });
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest && e.target.closest(".node");
    if (!g) return;
    const i = Number(g.dataset.i);
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(i); }
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); refocus = (i + 1) % state.n; render(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); refocus = (i + state.n - 1) % state.n; render(); }
  });

  function reset() {
    state = Core.start({ n: nIn.value, nRed: redIn.value, nBlue: blueIn.value, autoColor: autoBox.checked, useRed: document.querySelector('input[name="colour"]:checked').value === "red" });
    nIn.value = String(state.n); redIn.value = String(state.nRed); blueIn.value = String(state.nBlue);
    redIn.max = blueIn.max = String(Math.min(5, state.n - 1));
    picked = null;
    render();
  }
  [nIn, redIn, blueIn].forEach((x) => x.addEventListener("change", reset));
  document.getElementById("resetBtn").addEventListener("click", reset);
  removeBtn.addEventListener("click", () => { const s = Core.removeLast(state); if (s) { state = s; render(); } });
  autoBox.addEventListener("change", () => {
    document.querySelectorAll('input[name="colour"]').forEach((r) => (r.disabled = autoBox.checked));
    state = { ...state, autoColor: autoBox.checked };
    render();
  });
  document.querySelectorAll('input[name="colour"]').forEach((r) => r.addEventListener("change", () => { state = { ...state, useRed: r.value === "red" }; render(); }));

  render();
})();
