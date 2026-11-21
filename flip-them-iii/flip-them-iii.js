"use strict";

/*
 * The page for Flipping Items Simultaneously III: drawing and input only; the rules are in
 * flip-them-iii-core.js. An SVG ring of red circles: press one and it and the next M - 1 circles
 * clockwise change colour; the goal is to make every circle blue with as few clicks as possible. The
 * arrow keys move round the ring; Enter or Space presses. "Show the answer" gives the page's formula
 * and a button that plays out the fewest clicks.
 */

(function () {
  const Core = FlipThemIIICore;
  const svg = document.getElementById("ring");
  const statusEl = document.getElementById("status");
  const mIn = document.getElementById("mIn"), nIn = document.getElementById("nIn");
  const answerBox = document.getElementById("answerBox");
  const resetBtn = document.getElementById("resetBtn");
  const solveBtn = document.getElementById("solveBtn");
  const infoEl = document.getElementById("info");
  const answerEl = document.getElementById("answer");
  const SVGNS = "http://www.w3.org/2000/svg";
  const CX = 200, CY = 200, R = 160;
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
  const clicksSoFar = () => state.clicks.reduce((a, b) => a + b, 0);

  function render() {
    const n = state.n;
    svg.textContent = "";
    const r = Math.max(10, Math.min(26, (Math.PI * R) / n - 3));
    const will = new Set(hover >= 0 ? Core.window(state, hover) : []);
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n, x = CX + R * Math.cos(a), y = CY + R * Math.sin(a);
      const g = el("g", { class: "disc" + (state.blue[i] ? " blue" : " red") + (will.has(i) ? " will" : ""), tabindex: i === cur ? "0" : "-1", role: "button", "data-i": i });
      g.setAttribute("aria-label", `Circle ${i + 1}: ${state.blue[i] ? "blue" : "red"}${state.clicks[i] ? `, clicked ${state.clicks[i]} time${state.clicks[i] === 1 ? "" : "s"}` : ""}. Press to change the colour of ${state.m} circles from here, clockwise.`);
      g.appendChild(el("circle", { cx: x, cy: y, r, class: "body" }));
      if (state.clicks[i] % 2 === 1) g.appendChild(el("circle", { cx: x, cy: y, r: r * 0.3, class: "dot" }));
      svg.appendChild(g);
    }
    mIn.value = String(state.m); nIn.value = String(state.n);
    const locked = timer !== null;
    for (const c of [mIn, nIn, resetBtn]) c.disabled = locked;
    const a = Core.answer(state.n, state.m);
    const showA = answerBox.checked;
    solveBtn.disabled = locked || !showA || !a.solvable || Core.allBlue(state);
    infoEl.textContent = `${state.blue.filter(Boolean).length} of ${n} circles are blue. Clicks so far: ${clicksSoFar()}.`;
    answerEl.textContent = showA ? (a.solvable ? `gcd(M, N) = ${a.g}, M₁ = ${a.m1} is odd, N₁ = ${a.n1}: it can be done, and ${a.n1} clicks are the fewest (click every ${a.g === 1 ? "" : a.g + (a.g === 2 ? "nd" : a.g === 3 ? "rd" : "th") + " "}circle).` : `gcd(M, N) = ${a.g}, M₁ = ${a.m1} is even: it cannot be done.`) : "";
    if (focusCur) { const g = svg.querySelector(`g.disc[data-i="${cur}"]`); if (g) g.focus(); focusCur = false; }
    if (window.Track) window.Track.state(state);
  }

  function announce() {
    if (Core.allBlue(state)) {
      const a = Core.answer(state.n, state.m), k = clicksSoFar();
      say(`Every circle is blue after ${k} click${k === 1 ? "" : "s"}.` + (k === a.fewest ? " That is the fewest possible." : ` The fewest possible is ${a.fewest}.`), "win");
    } else say("");
  }
  function apply(m) { const next = Core.move(state, m); if (!next) return false; state = next; render(); announce(); return true; }

  svg.addEventListener("click", (e) => { const g = e.target.closest("g.disc"); if (!g || timer) return; cur = Number(g.dataset.i); focusCur = true; apply({ type: "click", i: cur }); });
  svg.addEventListener("pointerover", (e) => { const g = e.target.closest("g.disc"); const i = g ? Number(g.dataset.i) : -1; if (i !== hover) { hover = i; const w = i >= 0 ? Core.window(state, i) : []; for (const d of svg.querySelectorAll("g.disc")) d.classList.toggle("will", w.includes(Number(d.dataset.i))); } });
  svg.addEventListener("pointerleave", () => { hover = -1; for (const d of svg.querySelectorAll("g.disc")) d.classList.remove("will"); });
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest("g.disc"); if (!g) return;
    const i = Number(g.dataset.i), n = state.n;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!timer) { cur = i; focusCur = true; apply({ type: "click", i }); } }
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); cur = (i + 1) % n; hover = cur; focusCur = true; render(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); cur = (i + n - 1) % n; hover = cur; focusCur = true; render(); }
  });
  svg.addEventListener("focusin", (e) => { const g = e.target.closest("g.disc"); if (g) { hover = Number(g.dataset.i); const w = Core.window(state, hover); for (const d of svg.querySelectorAll("g.disc")) d.classList.toggle("will", w.includes(Number(d.dataset.i))); } });

  const changeN = () => { if (!apply({ type: "n", value: nIn.value })) { say(`N is a whole number from ${Core.MIN_N} to ${Core.MAX_N}.`); nIn.value = String(state.n); } else { cur = 0; say(`${state.n} circles, ${state.m} at a time.`); } };
  const changeM = () => { if (!apply({ type: "m", value: mIn.value })) { say(`M is a whole number from ${Core.MIN_M} to ${Core.MAX_M}.`); mIn.value = String(state.m); } else { cur = 0; say(`${state.n} circles, ${state.m} at a time.`); } };
  nIn.addEventListener("change", changeN); mIn.addEventListener("change", changeM);
  answerBox.addEventListener("change", render);
  resetBtn.addEventListener("click", () => { state = Core.move(state, { type: "reset" }); render(); say("All circles are red again."); });
  solveBtn.addEventListener("click", () => {
    const f = Core.fewest(state.n, state.m);
    if (!f) return;
    state = Core.move(state, { type: "reset" }); render();
    if (reduced) { for (const i of f.clicks) state = Core.move(state, { type: "click", i }); render(); announce(); return; }
    let k = 0;
    timer = setInterval(() => {
      if (k >= f.clicks.length) { clearInterval(timer); timer = null; render(); announce(); return; }
      state = Core.move(state, { type: "click", i: f.clicks[k++] }); render();
    }, 400);
    render(); say(`Click circles ${f.clicks.map((i) => i + 1).join(", ")}.`);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && timer) { clearInterval(timer); timer = null; render(); } });
  window.addEventListener("themechange", render);

  render();
})();
