"use strict";

/*
 * The page for Graph and Roots of a Third Degree Polynomial: drawing and input
 * only; the algebra is in polynomial-degree-3-core.js. Four sliders set a, b,
 * c, d; a canvas draws the graph with its roots: real ones on the x-axis, a
 * complex pair re ± im i as the points (re, ±im) on a dashed line. The
 * inflection point is marked; clicking it (or the check box) shows the tangent
 * there and the difference P − tangent, as in the applet.
 */

(function () {
  const Core = PolynomialDegree3Core;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const formulaEl = document.getElementById("formula");
  const infoEl = document.getElementById("info");
  const tanBox = document.getElementById("tanBox");
  const xIn = document.getElementById("xIn"), yIn = document.getElementById("yIn");
  const names = ["d", "c", "b", "a"];
  const sliders = names.map((n) => document.getElementById("s" + n));
  const outs = names.map((n) => document.getElementById("o" + n));
  const W = canvas.width, H = canvas.height;
  let state = Core.start({});
  let X = 14, Y = 10; // the applet's window: y from -10 to 10, x in proportion

  const tok = (st, n, f) => st.getPropertyValue(n).trim() || f;
  const sx = (x) => ((x + X) / (2 * X)) * W, sy = (y) => H - ((y + Y) / (2 * Y)) * H;

  function curve(f, color, width, dash) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= W; i++) {
      const y = f((i / W) * 2 * X - X);
      if (!Number.isFinite(y) || Math.abs(y) > Y * 4) { pen = false; continue; }
      if (!pen) { ctx.moveTo(i, sy(y)); pen = true; } else ctx.lineTo(i, sy(y));
    }
    ctx.stroke(); ctx.setLineDash([]);
  }
  const dot = (x, y, color, r) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx(x), sy(y), r || 5, 0, 2 * Math.PI); ctx.fill(); };

  function draw() {
    const st = getComputedStyle(document.documentElement);
    const stage = tok(st, "--stage", "#f3f5f8"), ink = tok(st, "--ink", "#1f2430"), muted = tok(st, "--muted", "#5d6472"), accent = tok(st, "--accent", "#5b4ee8"), good = tok(st, "--good", "#15803d"), bad = tok(st, "--bad", "#c2362b");
    ctx.fillStyle = stage; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = muted; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, sy(0)); ctx.lineTo(W, sy(0)); ctx.moveTo(sx(0), 0); ctx.lineTo(sx(0), H); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = muted; ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(`${-X}`, 4, sy(0) - 6); ctx.textAlign = "right"; ctx.fillText(`${X}`, W - 4, sy(0) - 6);
    ctx.fillText(`${Y}`, sx(0) - 6, 16); ctx.fillText(`${-Y}`, sx(0) - 6, H - 6); ctx.textAlign = "left";

    const c = state.c, f = Core.inflection(state), r = Core.roots(state);
    if (state.tangent && f) {
      curve((x) => f.slope * x + f.intercept, muted, 1.5);
      curve((x) => Core.value(f.difference, x), bad, 2);
    }
    curve((x) => Core.value(c, x), accent, 2.5);
    if (r) {
      if (r.complex) {
        ctx.strokeStyle = good; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(sx(r.others[0].re), 0); ctx.lineTo(sx(r.others[0].re), H); ctx.stroke(); ctx.setLineDash([]);
      }
      dot(r.real, 0, good);
      for (const o of r.others) dot(o.re, o.im, good);
    }
    if (f) dot(f.x, f.y, ink, 4);
  }

  const fmt = (v) => (Math.abs(v) < 0.005 ? "0" : v.toFixed(2)).replace("-", "−");
  function describeRoots() {
    const r = Core.roots(state);
    if (!r) return "With a = 0 this is not a third degree polynomial, and the applet shows no roots.";
    const o = r.others;
    const rest = r.complex ? `The other two are the complex pair ${fmt(o[0].re)} ± ${fmt(Math.abs(o[0].im))}i, drawn as two points straight above and below each other`
      : `The other two, ${fmt(o[0].re)} and ${fmt(o[1].re)}, are real too`;
    const f = Core.inflection(state);
    return `A real root: ${fmt(r.real)}. ${rest}. Inflection point (${fmt(f.x)}, ${fmt(f.y)}).` +
      (state.tangent ? ` Taking away the tangent there leaves ${fmt(state.c[3])}(x − ${fmt(f.x)})³, with three equal roots.` : "");
  }

  function render() {
    draw();
    state.c.forEach((v, i) => { sliders[i].value = String(v); outs[i].textContent = v.toFixed(2); });
    tanBox.checked = state.tangent;
    formulaEl.textContent = Core.formula(state);
    infoEl.textContent = describeRoots();
    canvas.setAttribute("aria-label", `Graph of ${Core.formula(state)} for x from ${-X} to ${X}. ${infoEl.textContent}`);
    if (window.Track) window.Track.state(state);
  }

  sliders.forEach((s, i) => s.addEventListener("input", () => { state = Core.move(state, { type: "coef", index: i, value: s.value }); render(); }));
  tanBox.addEventListener("change", () => { state = Core.move(state, { type: "tangent", value: tanBox.checked }); render(); });
  canvas.addEventListener("click", (e) => {
    const f = Core.inflection(state);
    if (!f) return;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width), py = (e.clientY - rect.top) * (H / rect.height);
    // The applet: a click within 10 pixels of the inflection point (a little more for fingers).
    if (Math.hypot(px - sx(f.x), py - sy(f.y)) < 10 * Math.max(1.5, W / rect.width)) {
      state = Core.move(state, { type: "tangent", value: !state.tangent }); render();
    }
  });
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
