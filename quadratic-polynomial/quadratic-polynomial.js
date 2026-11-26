"use strict";

/*
 * The page for Graph and Roots of a Quadratic Polynomial: drawing and input
 * only; the algebra is in quadratic-polynomial-core.js. Three sliders set a,
 * b, c; a canvas draws the parabola and its roots: real ones on the x-axis, a
 * complex pair re ± im i as the points (re, ±im), with the dashed axis of the
 * parabola through them, as in the applet. While the roots are complex, a
 * faint circle of radius sqrt(c/a) shows the path they follow as b changes.
 */

(function () {
  const Core = QuadraticPolynomialCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const formulaEl = document.getElementById("formula");
  const infoEl = document.getElementById("info");
  const xIn = document.getElementById("xIn"), yIn = document.getElementById("yIn");
  const names = ["c", "b", "a"];
  const sliders = names.map((n) => document.getElementById("s" + n));
  const outs = names.map((n) => document.getElementById("o" + n));
  const W = canvas.width, H = canvas.height;
  let state = Core.start({});
  let X = 14, Y = 10; // the applet's window: y from -10 to 10, x in proportion

  const tok = (st, n, f) => st.getPropertyValue(n).trim() || f;
  const sx = (x) => ((x + X) / (2 * X)) * W, sy = (y) => H - ((y + Y) / (2 * Y)) * H;

  function draw() {
    const st = getComputedStyle(document.documentElement);
    const stage = tok(st, "--stage", "#f3f5f8"), ink = tok(st, "--ink", "#1f2430"), muted = tok(st, "--muted", "#5d6472"), accent = tok(st, "--accent", "#5b4ee8"), good = tok(st, "--good", "#15803d");
    ctx.fillStyle = stage; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = muted; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, sy(0)); ctx.lineTo(W, sy(0)); ctx.moveTo(sx(0), 0); ctx.lineTo(sx(0), H); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = muted; ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(`${-X}`, 4, sy(0) - 6); ctx.textAlign = "right"; ctx.fillText(`${X}`, W - 4, sy(0) - 6);
    ctx.fillText(`${Y}`, sx(0) - 6, 16); ctx.fillText(`${-Y}`, sx(0) - 6, H - 6); ctx.textAlign = "left";

    const r = Core.roots(state), [c, , a] = state.c;
    if (r.kind === "complex" && c / a > 0) {
      ctx.strokeStyle = good; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(sx(0), sy(0), (Math.sqrt(c / a) * W) / (2 * X), (Math.sqrt(c / a) * H) / (2 * Y), 0, 0, 2 * Math.PI); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (r.axis !== null) {
      ctx.strokeStyle = good; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(sx(r.axis), 0); ctx.lineTo(sx(r.axis), H); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= W; i++) {
      const y = Core.value(state.c, (i / W) * 2 * X - X);
      if (Math.abs(y) > Y * 4) { pen = false; continue; }
      if (!pen) { ctx.moveTo(i, sy(y)); pen = true; } else ctx.lineTo(i, sy(y));
    }
    ctx.stroke();
    for (const p of r.points) { ctx.fillStyle = good; ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), 5, 0, 2 * Math.PI); ctx.fill(); }
    const v = Core.vertex(state);
    if (v) { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(sx(v.x), sy(v.y), 3.5, 0, 2 * Math.PI); ctx.fill(); }
  }

  const fmt = (v) => (Math.abs(v) < 0.005 ? "0" : v.toFixed(2)).replace("-", "−");
  function describe() {
    const r = Core.roots(state), [c, b, a] = state.c, D = Core.discriminant(state);
    if (r.kind === "none") return "With a = 0 and b = 0 there is no equation to solve.";
    if (r.kind === "linear") return `With a = 0 the graph is a line, with the one root ${fmt(r.points[0].x)}.`;
    const lead = `D = b² − 4ac = ${fmt(D)}${D > 0 ? " > 0: two real roots" : D === 0 ? ": one double root" : " < 0: two complex roots"}`;
    const roots = r.kind === "complex" ? `${fmt(r.axis)} ± ${fmt(r.points[0].y)}i, at distance ${fmt(Math.sqrt(c / a))} = √(c/a) from 0` : r.kind === "double" ? fmt(r.points[0].x) : `${fmt(r.points[0].x)} and ${fmt(r.points[1].x)}`;
    return `${lead}, ${roots}. Their sum is −b/a = ${fmt(-b / a)} and their product c/a = ${fmt(c / a)}. The parabola opens ${a > 0 ? "up" : "down"}.`;
  }

  function render() {
    draw();
    state.c.forEach((v, i) => { sliders[i].value = String(v); outs[i].textContent = v.toFixed(2); });
    formulaEl.textContent = Core.formula(state);
    infoEl.textContent = describe();
    canvas.setAttribute("aria-label", `Graph of ${Core.formula(state)} for x from ${-X} to ${X}. ${infoEl.textContent}`);
    if (window.Track) window.Track.state(state);
  }

  sliders.forEach((s, i) => s.addEventListener("input", () => { state = Core.move(state, { type: "coef", index: i, value: s.value }); render(); }));
  const windowIn = (input, set) => input.addEventListener("change", () => {
    const v = Number(input.value);
    if (v >= 1 && v <= 1000) set(v); else input.value = String(input === xIn ? X : Y);
    render();
  });
  windowIn(xIn, (v) => { X = v; }); windowIn(yIn, (v) => { Y = v; });
  document.getElementById("newBtn").addEventListener("click", () => { state = Core.start({}); render(); });
  window.addEventListener("themechange", render);
  render();
})();
