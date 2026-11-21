"use strict";

/*
 * The page for Compare Fractions: Interactive Practice: drawing and input only; the rules are in
 * fraction-comparison-exercise-core.js. Two fractions, three buttons (<, =, >), optional bar pictures of the
 * fractions and, with them, the common denominator.
 */

(function () {
  const Core = FractionComparisonExerciseCore;
  const row = document.getElementById("row");
  const bars = document.getElementById("bars");
  const scoreEl = document.getElementById("score");
  const statusEl = document.getElementById("status");
  const signBtns = [0, 1, 2].map((i) => document.getElementById("sign" + i));
  const gBox = document.getElementById("gBox"), cBox = document.getElementById("cBox");
  const nextBtn = document.getElementById("nextBtn"), restartBtn = document.getElementById("restartBtn");
  const SVGNS = "http://www.w3.org/2000/svg";
  const fresh = () => (Date.now() % 1000003) + 1;
  let state = Core.start({ seed: fresh() });

  function say(text, kind) { statusEl.textContent = text; statusEl.classList.remove("win", "lose", "done"); if (kind) statusEl.classList.add(kind); }
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e; };

  function frac(n, d, label) { const f = el("div", "frac"); f.setAttribute("role", "img"); f.setAttribute("aria-label", `${label}: ${n} over ${d}`); f.append(el("span", "num", String(n)), el("span", "bar"), el("span", "den", String(d))); return f; }

  function bar(n, d, parts, label) {
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 300 30"); svg.setAttribute("class", "barsvg"); svg.setAttribute("role", "img");
    const scale = parts / d;
    svg.setAttribute("aria-label", `${label}: ${n} of ${d} parts shaded`);
    for (let i = 0; i < parts; i++) {
      const r = document.createElementNS(SVGNS, "rect");
      r.setAttribute("x", (i * 300) / parts); r.setAttribute("y", 2); r.setAttribute("width", 300 / parts); r.setAttribute("height", 26);
      r.setAttribute("class", i < n * scale ? "on" : "off");
      svg.appendChild(r);
    }
    return svg;
  }

  function render() {
    row.textContent = "";
    row.append(frac(state.n1, state.d1, "First fraction"), el("span", "q", state.answered < 0 ? "?" : Core.SIGNS[state.answered]), frac(state.n2, state.d2, "Second fraction"));
    bars.textContent = "";
    if (state.graphics) {
      const parts1 = state.common ? Core.lcm(state.d1, state.d2) : state.d1, parts2 = state.common ? parts1 : state.d2;
      const n1 = state.n1, n2 = state.n2;
      bars.append(bar(n1, state.d1, parts1, "First fraction"), bar(n2, state.d2, parts2, "Second fraction"));
    }
    const done = state.answered >= 0;
    signBtns.forEach((b) => { b.disabled = done; });
    gBox.checked = state.graphics; cBox.checked = state.common; cBox.disabled = !state.graphics;
    scoreEl.textContent = `Problems: ${state.problems}   Correct answers: ${state.solved}`;
    if (window.Track) window.Track.state(state);
  }

  signBtns.forEach((b, i) => b.addEventListener("click", () => {
    const next = Core.move(state, { type: "answer", sign: i }); if (!next) return;
    state = next; render(); say(Core.remark(state), Core.result(state)); nextBtn.focus();
  }));
  gBox.addEventListener("change", () => { state = Core.move(state, { type: "graphics", value: gBox.checked }); render(); });
  cBox.addEventListener("change", () => { const n = Core.move(state, { type: "common", value: cBox.checked }); if (n) { state = n; render(); } });
  nextBtn.addEventListener("click", () => { state = Core.move(state, { type: "next", seed: fresh() }); render(); say(""); signBtns[0].focus(); });
  restartBtn.addEventListener("click", () => { state = Core.move(state, { type: "restart", seed: fresh() }); render(); say("Scores reset."); });
  render();
})();
