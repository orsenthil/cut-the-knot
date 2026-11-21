"use strict";

/*
 * The page for Shapes of Constant Width: drawing and input only; the geometry
 * is in cwidth-core.js. One canvas shows the Reuleaux triangle turning (5
 * degrees every 100 ms, as the applet) with the square that always touches all
 * four of its sides. Click the picture, or press the View button, to cycle the
 * three views; Pause stops the turning (and the page starts paused when the
 * visitor prefers reduced motion); the arrow keys turn it by hand.
 */

(function () {
  const Core = CwidthCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const viewBtn = document.getElementById("viewBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const stepIn = document.getElementById("stepIn");
  const resetBtn = document.getElementById("resetBtn");
  const N = canvas.width;
  const S = Math.round(N * 0.52); // the triangle's side, in pixels, so that the square always fits the picture
  const VIEWS = { rotate: "Triangle turning in its square", square: "Square turning round the triangle", trace: "The ground the triangle covers" };
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let state = Core.start();
  let running = !reduced;
  let timer = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const colour = (styles, name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  let styles = null;
  let traceReady = false;

  function palette() {
    styles = getComputedStyle(document.documentElement);
    return {
      stage: colour(styles, "--stage", "#f3f5f8"), ink: colour(styles, "--ink", "#1f2430"),
      muted: colour(styles, "--muted", "#5d6472"), accent: colour(styles, "--accent", "#5b4ee8"),
      bad: colour(styles, "--bad", "#d4565a"),
    };
  }

  /** Trace the Reuleaux triangle as a path: three arcs, each centred on the opposite vertex. */
  function shapePath(cx, cy, angle) {
    const vs = Core.vertices(angle, S);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const [x0, y0] = vs[i];
      const a = vs[(i + 1) % 3], b = vs[(i + 2) % 3];
      const t1 = Math.atan2(a[1] - y0, a[0] - x0), t2 = Math.atan2(b[1] - y0, b[0] - x0);
      let d = t2 - t1;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      // the arc centred at vertex i runs between the other two vertices
      if (i === 0) ctx.moveTo(cx + a[0], cy + a[1]);
      ctx.arc(cx + x0, cy + y0, S, t1, t1 + d, d < 0);
    }
    ctx.closePath();
  }

  function draw(keep) {
    const p = palette();
    const angle = state.angle;
    if (!keep) {
      ctx.clearRect(0, 0, N, N);
      ctx.fillStyle = p.stage;
      ctx.fillRect(0, 0, N, N);
    }
    const sq = Core.square(state, S);
    const centre = N / 2;
    if (state.mode === "square") {
      // The triangle stays still; the square turns round it, always touching all four sides.
      shapePath(centre, centre, 0);
      ctx.fillStyle = "rgba(91,78,232,0.28)";
      ctx.fill();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 3;
      ctx.stroke();
      const b0 = Core.boundsApplet(0, S);
      const c0 = [centre + (b0.left + b0.right) / 2, centre + (b0.top + b0.bottom) / 2];
      ctx.save();
      ctx.translate(c0[0], c0[1]);
      ctx.rotate((-angle * Math.PI) / 180);
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(-S / 2, -S / 2, S, S);
      ctx.restore();
    } else {
      // The square stays put at the middle; the triangle turns inside it, sliding to keep touching all sides.
      const left = centre - S / 2, top = centre - S / 2;
      const ox = left - sq.left, oy = top - sq.top; // where the triangle's centre must be
      shapePath(ox, oy, angle);
      ctx.fillStyle = state.mode === "trace" ? "rgba(91,78,232,0.07)" : "rgba(91,78,232,0.28)";
      ctx.fill();
      if (state.mode !== "trace") {
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = state.mode === "trace" ? 1.5 : 2;
      ctx.strokeRect(left, top, S, S);
      const vs = Core.vertices(angle, S);
      ctx.fillStyle = p.bad;
      for (const [x, y] of vs) { ctx.beginPath(); ctx.arc(ox + x, oy + y, 3.5, 0, 2 * Math.PI); ctx.fill(); }
    }
  }

  function describe() {
    return `${VIEWS[state.mode]}. Angle ${state.angle}°. Every direction measures the same: the width is always the side of the triangle.`;
  }

  function render(keep) {
    draw(keep);
    viewBtn.textContent = "View: " + { rotate: "turning", square: "square turns", trace: "trace" }[state.mode];
    pauseBtn.textContent = running ? "Pause" : "Play";
    pauseBtn.setAttribute("aria-pressed", running ? "false" : "true");
    stepIn.value = String(state.step);
    if (window.Track) window.Track.state(state);
  }

  function apply(m, announce) {
    const next = Core.move(state, m);
    if (!next) return false;
    const changedMode = next.mode !== state.mode;
    state = next;
    render(state.mode === "trace" && !changedMode && m.type === "tick");
    if (announce || changedMode) say(describe(), Core.result(state));
    return true;
  }

  function loop() {
    clearInterval(timer);
    timer = running ? setInterval(() => apply({ type: "tick" }, false), Core.TICK_MS) : null;
  }

  function setRunning(on) {
    running = on;
    loop();
    render();
    say(on ? "Turning." : "Paused. Use the arrow keys on the picture to turn it by hand.");
  }

  canvas.addEventListener("click", () => { apply({ type: "click" }, true); });
  canvas.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "arrowright" || k === "arrowup") { e.preventDefault(); apply({ type: "angle", value: state.angle + state.step }, true); }
    else if (k === "arrowleft" || k === "arrowdown") { e.preventDefault(); apply({ type: "angle", value: state.angle - state.step }, true); }
    else if (k === "v" || k === "enter") { e.preventDefault(); apply({ type: "click" }, true); }
    else if (k === " ") { e.preventDefault(); setRunning(!running); }
  });
  viewBtn.addEventListener("click", () => apply({ type: "click" }, true));
  pauseBtn.addEventListener("click", () => setRunning(!running));
  stepIn.addEventListener("change", () => { if (!apply({ type: "step", value: Number(stepIn.value) }, false)) say("The step must be a number of degrees from 1 to 30."); render(); });
  resetBtn.addEventListener("click", () => { state = { ...Core.start(), seen: state.seen }; render(); say("Back to angle 0."); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { clearInterval(timer); } else loop(); });
  window.addEventListener("themechange", () => render());

  render();
  loop();
  if (reduced) say("Animation is paused because your device asks for reduced motion. Press Play, or use the arrow keys on the picture.");
})();
