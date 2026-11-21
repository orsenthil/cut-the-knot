"use strict";

/*
 * The page for the Futurama theorem game: drawing and input only; the rules are in futurama-core.js.
 * The N people stand in a ring (body = place, mind = the coloured letter inside); X and Y are the two clean
 * extras. Press one body, then another, to swap their minds; every swap must involve X or Y and no pair may
 * swap twice. Put every mind back in its own body.
 */

(function () {
  const Core = FuturamaCore;
  const svg = document.getElementById("ring");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn");
  const backBtn = document.getElementById("backBtn"), resetBtn = document.getElementById("resetBtn"), solveBtn = document.getElementById("solveBtn");
  const logEl = document.getElementById("log");
  const SVGNS = "http://www.w3.org/2000/svg";
  const fresh = () => (Date.now() % 1000003) + 1;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let state = Core.start({ seed: fresh() });
  let first = -1, cur = 0, focusCur = false, timer = null;

  const name = (i) => (i === state.n ? "X" : i === state.n + 1 ? "Y" : String.fromCharCode(65 + i));
  const hue = (i) => (i >= state.n ? (i === state.n ? 0 : 300) : (i * 360) / state.n);
  const el = (n, a, t) => { const e = document.createElementNS(SVGNS, n); for (const k in a) e.setAttribute(k, a[k]); if (t !== undefined) e.textContent = t; return e; };
  function say(text, kind) { statusEl.textContent = text; statusEl.classList.remove("win", "lose", "done"); if (kind) statusEl.classList.add(kind); }

  function pos(i) {
    const n = state.n;
    if (i < n) { const a = (2 * Math.PI * i) / n - Math.PI / 2; return [200 + 140 * Math.cos(a), 170 + 140 * Math.sin(a)]; }
    return [i === n ? 150 : 250, 372];
  }

  function render() {
    svg.textContent = "";
    const total = state.n + 2, r = Math.max(15, Math.min(26, (Math.PI * 140) / state.n - 4));
    for (let i = 0; i < total; i++) {
      const [x, y] = pos(i), mind = state.perm[i], home = mind === i;
      const g = el("g", { class: "body" + (first === i ? " sel" : "") + (home ? " home" : ""), tabindex: i === cur ? "0" : "-1", role: "button", "data-i": i });
      g.setAttribute("aria-label", `Body ${name(i)} holds the mind of ${name(mind)}${home ? ", which is its own" : ""}${first === i ? ", selected" : ""}. Press to swap minds.`);
      g.appendChild(el("ellipse", { cx: x, cy: y, rx: r, ry: r * 0.9, class: "oval" }));
      g.appendChild(el("text", { x, y: y + 5, "text-anchor": "middle", class: "mind", fill: `hsl(${hue(mind)}, 70%, 45%)` }, name(mind)));
      g.appendChild(el("text", { x, y: y + r + 13, "text-anchor": "middle", class: "own" }, name(i)));
      svg.appendChild(g);
    }
    logEl.textContent = state.stack.length ? "Swaps: " + state.stack.map(([a, b]) => `${name(a)}↔${name(b)}`).join(", ") : "No swaps yet.";
    nIn.value = String(state.n);
    const locked = timer !== null;
    backBtn.disabled = locked || !state.stack.length; nIn.disabled = locked; resetBtn.disabled = locked;
    solveBtn.disabled = locked || state.n > 7 || Core.straight(state);
    if (focusCur) { const g = svg.querySelector(`g.body[data-i="${cur}"]`); if (g) g.focus(); focusCur = false; }
    if (window.Track) window.Track.state(state);
  }

  function announce(msg) { say(msg || (Core.result(state) ? Core.MESSAGES.done : ""), Core.result(state)); }

  function press(i) {
    cur = i; focusCur = true;
    if (first < 0) { first = i; render(); say(`${name(i)} selected: now press the body to swap with.`); return; }
    if (first === i) { first = -1; render(); say("Selection cancelled."); return; }
    const a = first; first = -1;
    const next = Core.move(state, { type: "swap", i: a, j: i });
    if (!next) { render(); return; }
    state = next; render(); announce(state.message);
  }

  svg.addEventListener("click", (e) => { const g = e.target.closest("g.body"); if (g && !timer) press(Number(g.dataset.i)); });
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest("g.body"); if (!g) return;
    const i = Number(g.dataset.i), t = state.n + 2;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!timer) press(i); }
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); cur = (i + 1) % t; focusCur = true; render(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); cur = (i + t - 1) % t; focusCur = true; render(); }
  });
  backBtn.addEventListener("click", () => { const n = Core.move(state, { type: "back" }); if (n) { state = n; first = -1; render(); say("Last swap taken back."); } });
  resetBtn.addEventListener("click", () => { state = Core.move(state, { type: "reset", seed: fresh() }); first = -1; render(); say("A new mix-up."); });
  nIn.addEventListener("change", () => { const n = Core.move(state, { type: "n", value: nIn.value, seed: fresh() }); if (!n) { say(`The number of people is a whole number from ${Core.MIN_N} to ${Core.MAX_N}.`); nIn.value = String(state.n); } else { state = n; first = -1; cur = 0; render(); say(`${state.n} people.`); } });
  solveBtn.addEventListener("click", () => {
    say("Searching…");
    setTimeout(() => {
      const sol = Core.solve(state, 3000000);
      if (!sol) { say("No way found in time."); return; }
      if (reduced) { for (const [i, j] of sol) state = Core.move(state, { type: "swap", i, j }); render(); announce(); return; }
      let k = 0; timer = setInterval(() => { if (k >= sol.length) { clearInterval(timer); timer = null; render(); announce(); return; } state = Core.move(state, { type: "swap", i: sol[k][0], j: sol[k][1] }); k++; render(); }, 450);
      render();
    }, 20);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && timer) { clearInterval(timer); timer = null; render(); } });
  render();
})();
