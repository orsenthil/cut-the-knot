"use strict";

/*
 * The page for Inflection Points of Fourth Degree Polynomials: drawing and input only; the algebra is in
 * fourth-degree-core.js. Five sliders set the coefficients; a canvas draws the graph, the inflection line
 * and the difference p - L, with the inflection points and the other two crossings marked.
 */

(function () {
  const Core = FourthDegreeCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const infoEl = document.getElementById("info");
  const sliders = [0, 1, 2, 3, 4].map((i) => document.getElementById("c" + i));
  const outs = [0, 1, 2, 3, 4].map((i) => document.getElementById("o" + i));
  const boxes = { graph: document.getElementById("gBox"), line: document.getElementById("lBox"), diff: document.getElementById("dBox") };
  const yIn = document.getElementById("yIn");
  const resetBtn = document.getElementById("resetBtn");
  const W = canvas.width, H = canvas.height;
  let state = Core.start({});
  let X = 6, Y = 10;

  function say(text, kind) { statusEl.textContent = text; statusEl.classList.remove("win", "lose", "done"); kind = kind || Core.result(state); if (kind) statusEl.classList.add(kind); }
  const tok = (st, n, f) => st.getPropertyValue(n).trim() || f;
  const sx = (x) => ((x + X) / (2 * X)) * W, sy = (y) => H - ((y + Y) / (2 * Y)) * H;

  function curve(f, color, width) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= W; i++) {
      const x = (i / W) * 2 * X - X, y = f(x);
      if (Math.abs(y) > Y * 3) { pen = false; continue; }
      if (!pen) { ctx.moveTo(i, sy(y)); pen = true; } else ctx.lineTo(i, sy(y));
    }
    ctx.stroke();
  }

  function draw() {
    const st = getComputedStyle(document.documentElement);
    const stage = tok(st, "--stage", "#f3f5f8"), ink = tok(st, "--ink", "#1f2430"), muted = tok(st, "--muted", "#5d6472"), accent = tok(st, "--accent", "#5b4ee8"), good = tok(st, "--good", "#1a8f4d"), bad = tok(st, "--bad", "#c0392b");
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = stage; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = muted; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, sy(0)); ctx.lineTo(W, sy(0)); ctx.moveTo(sx(0), 0); ctx.lineTo(sx(0), H); ctx.stroke(); ctx.globalAlpha = 1;
    const c = state.c, k = Core.crossings(c);
    if (state.showGraph) curve((x) => Core.evalPoly(c, x), accent, 2.5);
    if (state.showLine && k) curve((x) => k.s * x + k.t, good, 2);
    if (state.showDiff && k) curve((x) => Core.evalPoly(k.diff, x), bad, 2);
    if (k) {
      for (const [x, col] of [[k.a, ink], [k.b, ink], [k.xL, good], [k.xR, good]]) { const y = Core.evalPoly(c, x); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx(x), sy(y), 4.5, 0, 2 * Math.PI); ctx.fill(); }
    }
  }

  function render() {
    draw();
    state.c.forEach((v, i) => { sliders[i].value = String(v); outs[i].textContent = v.toFixed(1); });
    for (const key of Object.keys(boxes)) boxes[key].checked = { graph: state.showGraph, line: state.showLine, diff: state.showDiff }[key];
    const k = Core.crossings(state.c);
    const f = (v) => v.toFixed(3);
    if (!k) infoEl.textContent = "This polynomial does not have two inflection points (m4 is 0, or p'' has no two real roots), so there is no inflection line.";
    else {
      const ar = Core.areas(state.c);
      infoEl.textContent = `Inflection points a = ${f(k.a)}, b = ${f(k.b)}. The line meets the graph again at xL = ${f(k.xL)} and xR = ${f(k.xR)}. a + b = ${f(k.a + k.b)} = xL + xR = ${f(k.xL + k.xR)}. (b − a)/(a − xL) = ${f((k.b - k.a) / (k.a - k.xL))} (the golden ratio is ${f(k.phi)}). Areas ${f(ar.left)} : ${f(ar.middle)} : ${f(ar.right)} = 1 : ${f(ar.middle / ar.left)} : ${f(ar.right / ar.left)}.`;
    }
    yIn.value = String(Y);
    if (window.Track) window.Track.state(state);
  }

  sliders.forEach((s, i) => s.addEventListener("input", () => { state = Core.move(state, { type: "coef", index: i, value: s.value }); render(); say(""); }));
  for (const key of Object.keys(boxes)) boxes[key].addEventListener("change", () => { state = Core.move(state, { type: "show", which: key, value: boxes[key].checked }); render(); });
  yIn.addEventListener("change", () => { const v = Number(yIn.value); if (v >= 1 && v <= 1000) { Y = v; render(); } else { say("The vertical range is a number from 1 to 1000."); yIn.value = String(Y); } });
  resetBtn.addEventListener("click", () => { state = Core.move(state, { type: "reset" }); Y = 10; render(); say("Back to x⁴ − 6x² + x."); });
  window.addEventListener("themechange", render);
  render();
})();
