"use strict";

/*
 * The page for Flipping Items Simultaneously II: drawing and input only; the rules are in
 * flip-them-ii-core.js. An SVG ring of circles, red or blue, with an arrow pointing at the one that
 * must end up blue: press a circle and it and the next M - 1 circles clockwise change colour. The
 * arrow keys move round the ring; Enter or Space presses. The Solution helper marks the circles of the
 * page's invariant (when M divides N). "Show a solution" plays out a way to the target when there is one.
 */

(function () {
  const Core = FlipThemIICore;
  const svg = document.getElementById("ring");
  const statusEl = document.getElementById("status");
  const mIn = document.getElementById("mIn"), nIn = document.getElementById("nIn");
  const helperBox = document.getElementById("helperBox");
  const resetBtn = document.getElementById("resetBtn");
  const solveBtn = document.getElementById("solveBtn");
  const infoEl = document.getElementById("info");
  const SVGNS = "http://www.w3.org/2000/svg";
  const CX = 200, CY = 200, R = 150;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let state = Core.start({});
  let cur = 0, focusCur = false, hover = -1;
  let timer = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    kind = kind || Core.result(state);
    if (kind) statusEl.classList.add(kind);
  }
  const el = (name, attrs) => { const e = document.createElementNS(SVGNS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const solvable = () => Core.solve(state.n, state.m) !== null;

  function render() {
    const n = state.n;
    svg.textContent = "";
    const r = Math.max(10, Math.min(26, (Math.PI * R) / n - 3));
    const mk = Core.marked(state);
    const will = new Set(hover >= 0 ? Core.window(state, hover) : []);
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n, x = CX + R * Math.cos(a), y = CY + R * Math.sin(a);
      const g = el("g", { class: "disc" + (state.blue[i] ? " blue" : " red") + (will.has(i) ? " will" : ""), tabindex: i === cur ? "0" : "-1", role: "button", "data-i": i });
      g.setAttribute("aria-label", `Circle ${i + 1}: ${state.blue[i] ? "blue" : "red"}${state.helper && mk[i] ? ", marked" : ""}${i === 0 ? ", the one the arrow points at" : ""}. Press to change the colour of ${state.m} circles from here, clockwise.`);
      g.appendChild(el("circle", { cx: x, cy: y, r, class: "body" }));
      if (state.helper && mk[i]) g.appendChild(el("circle", { cx: x, cy: y, r: r * 0.35, class: "kernel" }));
      svg.appendChild(g);
    }
    // the arrow pointing at circle 0 (on the right), as in the applet
    const ax = CX + R + r + 26, ay = CY;
    svg.appendChild(el("line", { x1: ax, y1: ay, x2: CX + R + r + 6, y2: ay, class: "arrow" }));
    svg.appendChild(el("polygon", { points: `${CX + R + r + 4},${ay} ${CX + R + r + 14},${ay - 6} ${CX + R + r + 14},${ay + 6}`, class: "arrowhead" }));
    mIn.value = String(state.m); nIn.value = String(state.n);
    const locked = timer !== null;
    for (const c of [mIn, nIn, resetBtn]) c.disabled = locked;
    helperBox.disabled = locked || !Core.divides(state);
    helperBox.checked = state.helper;
    solveBtn.disabled = locked || !solvable() || Core.reached(state);
    infoEl.textContent = `${state.blue.filter(Boolean).length} blue circle${state.blue.filter(Boolean).length === 1 ? "" : "s"}. ` + (Core.divides(state) ? (state.m >= 3 ? `M divides N: the Solution helper is available.` : `M = 2: every circle is marked.`) : `M does not divide N.`);
    if (focusCur) { const g = svg.querySelector(`g.disc[data-i="${cur}"]`); if (g) g.focus(); focusCur = false; }
    if (window.Track) window.Track.state(state);
  }

  function announce() {
    if (Core.reached(state)) say(`Done: every circle is red except circle 1, the one the arrow points at. It took ${state.moves} click${state.moves === 1 ? "" : "s"}.`, "win");
    else say("");
  }
  function apply(m) { const next = Core.move(state, m); if (!next) return false; state = next; render(); announce(); return true; }

  svg.addEventListener("click", (e) => { const g = e.target.closest("g.disc"); if (!g || timer) return; cur = Number(g.dataset.i); focusCur = true; apply({ type: "click", i: cur }); });
  svg.addEventListener("pointerover", (e) => { const g = e.target.closest("g.disc"); const i = g ? Number(g.dataset.i) : -1; if (i !== hover) { hover = i; for (const d of svg.querySelectorAll("g.disc")) d.classList.toggle("will", i >= 0 && Core.window(state, i).includes(Number(d.dataset.i))); } });
  svg.addEventListener("pointerleave", () => { hover = -1; for (const d of svg.querySelectorAll("g.disc")) d.classList.remove("will"); });
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest("g.disc"); if (!g) return;
    const i = Number(g.dataset.i), n = state.n;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!timer) { cur = i; focusCur = true; apply({ type: "click", i }); } }
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); cur = (i + 1) % n; hover = cur; focusCur = true; render(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); cur = (i + n - 1) % n; hover = cur; focusCur = true; render(); }
  });
  svg.addEventListener("focusin", (e) => { const g = e.target.closest("g.disc"); if (g) { hover = Number(g.dataset.i); const will = Core.window(state, hover); for (const d of svg.querySelectorAll("g.disc")) d.classList.toggle("will", will.includes(Number(d.dataset.i))); } });

  const changeN = () => { if (!apply({ type: "n", value: nIn.value })) { say(`N is a whole number from ${Core.MIN_N} to ${Core.MAX_N}.`); nIn.value = String(state.n); } else { cur = 0; say(`${state.n} circles, ${state.m} at a time.`); } };
  const changeM = () => { if (!apply({ type: "m", value: mIn.value })) { say(`M is a whole number from ${Core.MIN_M} to ${Core.MAX_M}.`); mIn.value = String(state.m); } else { cur = 0; say(`${state.n} circles, ${state.m} at a time.`); } };
  nIn.addEventListener("change", changeN); mIn.addEventListener("change", changeM);
  helperBox.addEventListener("change", () => { apply({ type: "helper", value: helperBox.checked }); say(helperBox.checked ? "Marked circles have a green centre. Every M circles in a row hold exactly two of them." : ""); });
  resetBtn.addEventListener("click", () => { state = Core.move(state, { type: "reset" }); render(); say("Back to the start."); });
  solveBtn.addEventListener("click", () => {
    const sol = Core.solve(state.n, state.m);
    if (!sol) return;
    state = Core.move(state, { type: "reset" }); render();
    if (reduced) { for (const i of sol) state = Core.move(state, { type: "click", i }); render(); announce(); return; }
    let k = 0;
    timer = setInterval(() => {
      if (k >= sol.length) { clearInterval(timer); timer = null; render(); announce(); return; }
      state = Core.move(state, { type: "click", i: sol[k++] }); render();
    }, 350);
    render(); say(`A way: click circles ${sol.map((i) => i + 1).join(", ")}.`);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && timer) { clearInterval(timer); timer = null; render(); } });
  window.addEventListener("themechange", render);

  render();
})();
