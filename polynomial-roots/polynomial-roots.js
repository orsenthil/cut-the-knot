"use strict";

/*
 * The page for Graph of a Polynomial Defined by Its Roots: drawing and input
 * only; the algebra is in polynomial-roots-core.js. As in the applet, the
 * formula is made of the numbers you change: P(x) = A(x − r1)(x − r2)...,
 * each a number box. A canvas draws the graph; a filled dot marks a root
 * where the graph crosses the axis, a ring one where it only touches.
 */

(function () {
  const Core = PolynomialRootsCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const formulaEl = document.getElementById("formula");
  const infoEl = document.getElementById("info");
  const degIn = document.getElementById("degIn");
  const xIn = document.getElementById("xIn"), yIn = document.getElementById("yIn");
  const W = canvas.width, H = canvas.height;
  let state = Core.start({});
  let X = 13, Y = 10; // the applet's window: y from -10 to 10, x in proportion

  const tok = (st, n, f) => st.getPropertyValue(n).trim() || f;
  const sx = (x) => ((x + X) / (2 * X)) * W, sy = (y) => H - ((y + Y) / (2 * Y)) * H;

  function draw() {
    const st = getComputedStyle(document.documentElement);
    const stage = tok(st, "--stage", "#f3f5f8"), muted = tok(st, "--muted", "#5d6472"), accent = tok(st, "--accent", "#5b4ee8"), good = tok(st, "--good", "#15803d");
    ctx.fillStyle = stage; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = muted; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, sy(0)); ctx.lineTo(W, sy(0)); ctx.moveTo(sx(0), 0); ctx.lineTo(sx(0), H);
    for (let t = Math.ceil(-X); t <= X; t++) { ctx.moveTo(sx(t), sy(0) - 4); ctx.lineTo(sx(t), sy(0) + 4); }
    ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = muted; ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(`${-X}`, 4, sy(0) - 8); ctx.textAlign = "right"; ctx.fillText(`${X}`, W - 4, sy(0) - 8);
    ctx.fillText(`${Y}`, sx(0) - 6, 16); ctx.fillText(`${-Y}`, sx(0) - 6, H - 6); ctx.textAlign = "left";

    ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= W; i++) {
      const y = Core.value(state, (i / W) * 2 * X - X);
      if (Math.abs(y) > Y * 4) { pen = false; continue; }
      if (!pen) { ctx.moveTo(i, sy(y)); pen = true; } else ctx.lineTo(i, sy(y));
    }
    ctx.stroke();
    for (const m of Core.multiplicities(state)) {
      ctx.beginPath(); ctx.arc(sx(m.root), sy(0), 6, 0, 2 * Math.PI);
      if (m.crosses) { ctx.fillStyle = good; ctx.fill(); } else { ctx.fillStyle = stage; ctx.fill(); ctx.strokeStyle = good; ctx.lineWidth = 3; ctx.stroke(); }
    }
  }

  const word = (s) => (s > 0 ? "up" : s < 0 ? "down" : "flat");
  function describe() {
    const n = state.roots.length;
    if (state.a === 0) return "With A = 0 the polynomial is 0 everywhere.";
    const e = Core.ends(state);
    const parts = [`Degree ${n}, ${n % 2 ? "odd" : "even"}, and A is ${state.a > 0 ? "positive" : "negative"}: the graph goes ${word(e.left)} on the left and ${word(e.right)} on the right.`];
    for (const m of Core.multiplicities(state)) {
      parts.push(`Root ${m.root}${m.times > 1 ? ` (${m.times} times)` : ""}: ${m.crosses ? "crosses" : "touches"} the axis${m.times > 1 ? ", tangent to it" : ""}.`);
    }
    return parts.join(" ");
  }

  function numberBox(value, label, onChange) {
    const input = document.createElement("input");
    input.type = "number"; input.step = "1"; input.min = String(Core.NUM_MIN); input.max = String(Core.NUM_MAX);
    input.value = String(value); input.setAttribute("aria-label", label);
    input.addEventListener("change", () => {
      const v = Math.round(Number(input.value));
      if (Number.isFinite(v)) onChange(v); else render();
    });
    return input;
  }

  function buildFormula() {
    // Rebuilt only when the degree changes, so a box keeps its focus while stepping.
    formulaEl.replaceChildren();
    const lead = document.createElement("span"); lead.textContent = "P(x) = ";
    formulaEl.append(lead, numberBox(state.a, "Leading coefficient A", (v) => { state = Core.move(state, { type: "a", value: v }); render(); }));
    state.roots.forEach((r, i) => {
      const f = document.createElement("span"); f.className = "factor";
      const open = document.createElement("span"); open.textContent = "(x − ";
      const close = document.createElement("span"); close.textContent = ")";
      f.append(open, numberBox(r, `Root ${i + 1}`, (v) => { state = Core.move(state, { type: "root", index: i, value: v }); render(); }), close);
      formulaEl.append(f);
    });
  }

  function render() {
    if (formulaEl.querySelectorAll("input").length !== state.roots.length + 1) buildFormula();
    const boxes = formulaEl.querySelectorAll("input");
    [state.a, ...state.roots].forEach((v, i) => { if (Number(boxes[i].value) !== v) boxes[i].value = String(v); });
    degIn.value = String(state.roots.length);
    draw();
    infoEl.textContent = describe();
    canvas.setAttribute("aria-label", `Graph of ${Core.formula(state)} for x from ${-X} to ${X}. ${infoEl.textContent}`);
    if (window.Track) window.Track.state(state);
  }

  degIn.addEventListener("change", () => {
    const raw = Math.round(Number(degIn.value));
    const v = Number.isFinite(raw) ? Math.max(Core.DEG_MIN, Math.min(Core.DEG_MAX, raw)) : Core.DEG_START;
    // As in the applet, a new degree makes a new polynomial; the same degree changes nothing.
    if (v === state.roots.length) { degIn.value = String(v); return; }
    state = Core.move(state, { type: "degree", value: v });
    formulaEl.replaceChildren();
    render();
  });
  const windowIn = (input, set) => input.addEventListener("change", () => {
    const v = Number(input.value);
    if (v >= 1 && v <= 1000) set(v); else input.value = String(input === xIn ? X : Y);
    render();
  });
  windowIn(xIn, (v) => { X = v; }); windowIn(yIn, (v) => { Y = v; });
  document.getElementById("newBtn").addEventListener("click", () => {
    state = Core.move(state, { type: "degree", value: state.roots.length });
    formulaEl.replaceChildren();
    render();
  });
  window.addEventListener("themechange", render);
  render();
})();
