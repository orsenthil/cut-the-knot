"use strict";

/*
 * The page for Derivatives of Sine and Cosine: drawing and input only; the
 * geometry is in sine-cosine-derivatives-core.js. An SVG shows the unit
 * circle with the radius to P, the cosine (blue arrow along the x-axis),
 * the sine (red arrow up to P) and, from P, the velocity split into a
 * vertical blue arrow and a horizontal red one. Start/Stop runs P round
 * the circle; P can also be dragged, or turned with the arrow keys.
 */

(function () {
  const Core = SineCosineDerivativesCore;
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const readout = document.getElementById("readout");
  const runBtn = document.getElementById("runBtn");
  const NS = "http://www.w3.org/2000/svg";
  const R = 90; // pixels per unit; the board is 400 x 400 around (200, 200)
  const X = (x) => 200 + R * x, Y = (y) => 200 - R * y;

  let state = Core.start();
  let timer = null;
  let dragging = false;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function el(name, attrs, cls) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    return e;
  }

  /** A line with an arrowhead at its end, styled by class. */
  function arrow(from, to, cls) {
    const g = el("g", {}, `arrow ${cls}`);
    const x1 = X(from.x), y1 = Y(from.y), x2 = X(to.x), y2 = Y(to.y);
    g.appendChild(el("line", { x1, y1, x2, y2 }));
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len > 3) {
      const ux = (x2 - x1) / len, uy = (y2 - y1) / len, s = Math.min(10, len * 0.6);
      g.appendChild(el("polygon", {
        points: `${x2},${y2} ${x2 - ux * s - uy * s * 0.45},${y2 - uy * s + ux * s * 0.45} ${x2 - ux * s + uy * s * 0.45},${y2 - uy * s - ux * s * 0.45}`,
      }));
    }
    return g;
  }

  function render() {
    const p = Core.picture(state);
    svg.textContent = "";
    svg.appendChild(el("line", { x1: X(-2), y1: Y(0), x2: X(2), y2: Y(0) }, "axis"));
    svg.appendChild(el("line", { x1: X(0), y1: Y(-2), x2: X(0), y2: Y(2) }, "axis"));
    svg.appendChild(el("circle", { cx: X(0), cy: Y(0), r: R }, "circle"));
    svg.appendChild(el("line", { x1: X(0), y1: Y(0), x2: X(p.P.x), y2: Y(p.P.y) }, "radius"));
    svg.appendChild(el("line", { x1: X(p.P.x), y1: Y(p.P.y), x2: X(p.T.x), y2: Y(p.T.y) }, "velocity"));
    for (const a of p.arrows) svg.appendChild(arrow(a.from, a.to, a.kind));
    const handle = el("circle", { cx: X(p.P.x), cy: Y(p.P.y), r: 9, tabindex: "0", role: "slider",
      "aria-label": "The point P on the circle; arrow keys turn it",
      "aria-valuemin": "0", "aria-valuemax": "359", "aria-valuenow": String(state.a), "aria-valuetext": `t = ${state.a} degrees` }, "handle");
    svg.appendChild(handle);
    handle.addEventListener("keydown", onKey);
    if (focusHandle) { handle.focus(); focusHandle = false; }
    const f = (v) => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);
    readout.textContent = `t = ${state.a}°   cos t = ${f(p.cos)}   sin t = ${f(p.sin)}   velocity = (${f(-p.sin)}, ${f(p.cos)})`;
    if (window.Track) window.Track.state(state);
  }

  let focusHandle = false;
  function onKey(e) {
    const d = { ArrowRight: -1, ArrowDown: -1, ArrowLeft: 1, ArrowUp: 1, PageUp: 15, PageDown: -15 }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    stop();
    state = Core.setAngle(state, state.a + d);
    focusHandle = true;
    render();
  }

  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    runBtn.textContent = "Start";
    runBtn.setAttribute("aria-pressed", "false");
  }
  function startRun() {
    stop();
    timer = setInterval(() => { state = Core.tick(state); render(); }, Core.FRAME_MS);
    runBtn.textContent = "Stop";
    runBtn.setAttribute("aria-pressed", "true");
    say("P runs round the circle. Watch the blue arrows: the cosine is also the upward part of the velocity.");
  }
  runBtn.addEventListener("click", () => (timer === null ? startRun() : (stop(), say(`Stopped at t = ${state.a}°.`))));
  document.querySelectorAll('input[name="speed"]').forEach((r) => r.addEventListener("change", () => { state = { ...state, speed: r.value }; }));

  function toUnit(e) {
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * 400) / rect.width, y = ((e.clientY - rect.top) * 400) / rect.height;
    return { x: (x - 200) / R, y: (200 - y) / R };
  }
  svg.addEventListener("pointerdown", (e) => {
    const u = toUnit(e);
    if (Math.hypot(u.x, u.y) < 0.4) return;
    dragging = true;
    svg.setPointerCapture(e.pointerId);
    stop();
    state = Core.setAngle(state, Core.angleOf(u.x, u.y));
    render();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const u = toUnit(e);
    state = Core.setAngle(state, Core.angleOf(u.x, u.y));
    render();
  });
  const end = () => { if (dragging) { dragging = false; say(`t = ${state.a}°. The two right triangles are equal, one turned a quarter turn.`); } };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });

  render();
  say("Press Start, or drag P round the circle.");
})();
