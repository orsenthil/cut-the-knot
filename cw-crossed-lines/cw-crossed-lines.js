"use strict";

/*
 * The page for Crossed Lines of Constant Width: drawing and input only; the
 * geometry is in cw-crossed-lines-core.js. An SVG board holds the three crossed
 * lines, the six circular arcs they generate, and four focusable handles.
 * Play moves a tracer along the six arcs (50 ms a frame, as the applet's
 * thread), while the four controls stay put so the picture stays readable.
 */

(function () {
  const Core = CwCrossedLinesCore;
  const stageEl = document.getElementById("stage");
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const playBtn = document.getElementById("playBtn");
  const resetBtn = document.getElementById("resetBtn");
  const linesBox = document.getElementById("linesBox");
  const dotsBox = document.getElementById("dotsBox");
  const pRange = document.getElementById("pRange");
  const pOut = document.getElementById("pOut");
  const speedIn = document.getElementById("speedIn");
  const board = Geom.board(svg);

  const grid = board.layer("grid");
  const arcsLayer = board.layer("arcs");
  const dotsLayer = board.layer("dots");
  const handlesLayer = board.layer("handles");
  const labelsLayer = board.layer("labels");

  const zero = { x: 0, y: 0 };
  const sides = [
    board.line(zero, zero, "side-line", grid),
    board.line(zero, zero, "side-line", grid),
    board.line(zero, zero, "side-line", grid),
  ];
  const arcs = Array.from({ length: 6 }, () => board.arc(zero, 1, 0, 0, "curve-arc", arcsLayer));
  const endpoints = Array.from({ length: 6 }, () => board.point(zero, "arc-dot", 3.5, dotsLayer));
  const tracer = board.point(zero, "tracer-dot", 5, dotsLayer);
  const labels = {};
  for (const name of Core.NAMES) labels[name] = board.label(zero, name, "handle-label", 11, -11, labelsLayer);

  let state = Core.start();
  let timer = null;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** The shared #status line: the "done" class is how the record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function apply(m) {
    const next = Core.move(state, m);
    if (!next) return false;
    const wasRunning = state.running;
    state = next;
    if (state.running !== wasRunning) loop();
    render();
    return true;
  }

  function clampHandle(q, name) {
    if (name === "P") return Core.clampP(q, state.B, state.C);
    return Core.clampBoard(q);
  }

  const handles = {};
  for (const name of Core.NAMES) {
    handles[name] = board.handle(name, state[name.toLowerCase()] || Core.controls(state).P, {
      r: 9, step: 5, shift: 10,
      label: name === "P"
        ? "Point P on the line BC. Drag it, or focus it and use the arrow keys to slide it along that line."
        : "Point " + name + ", one of the three crossed lines. Drag it, or focus it and use the arrow keys to move it.",
      clamp: clampHandle,
      layer: handlesLayer,
      onMove: (p, which) => apply({ type: "point", name: which, point: p }),
    });
  }

  function describeP() {
    const t = state.coefP;
    if (t < 0) return "past C";
    if (t > 1) return "past B";
    if (Math.abs(t) < 0.025) return "at C";
    if (Math.abs(t - 1) < 0.025) return "at B";
    return "between B and C";
  }

  function describe(geo) {
    const radii = geo.radii.map((r) => r.toFixed(2));
    const distinct = new Set(radii).size;
    const convex = Core.isConvex(state, 90);
    const width = Core.widthRange(state, 180);
    const shape = convex
      ? "The curve is convex and its width is the same in every direction."
      : "The curve bends inward, so its width changes with direction.";
    return `${state.note || "The point swings from line to line."} P is ${describeP()}. ` +
      `${shape} ${distinct} different radii. Width ${width.min.toFixed(1)} units.`;
  }

  function render() {
    const v = Core.controls(state);
    const geo = Core.compute(state);
    const here = { A: v.A, B: v.B, C: v.C, P: v.P };

    sides[0].set(v.A, v.B);
    sides[1].set(v.B, v.C);
    sides[2].set(v.C, v.A);
    for (const side of sides) side.show(state.showLines);

    const points = [v.P, geo.Q, geo.R, geo.Pp, geo.Qp, geo.Rp];
    geo.arcs.forEach((arc, i) => {
      const a0 = Math.atan2(arc.from.y - arc.centre.y, arc.from.x - arc.centre.x);
      arcs[i].set(arc.centre, arc.radius, a0, a0 + arc.angle);
      endpoints[i].set(points[i]);
      endpoints[i].show(state.showDots);
    });
    tracer.set(state.tracer || v.P);
    tracer.show(!!state.tracer && state.running);

    for (const name of Core.NAMES) {
      handles[name].set(here[name]);
      labels[name].set(here[name]);
    }

    linesBox.checked = state.showLines;
    dotsBox.checked = state.showDots;
    if (document.activeElement !== pRange) pRange.value = String(state.coefP);
    pOut.textContent = describeP();
    if (document.activeElement !== speedIn) speedIn.value = String(state.speed);
    playBtn.textContent = state.running ? "Stop" : "Play";
    playBtn.setAttribute("aria-pressed", String(state.running));

    // The position, for the player's record and the tutor, in board units.
    say(describe(geo), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  function loop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (state.running) timer = setInterval(() => apply({ type: "tick" }), 50);
  }

  playBtn.addEventListener("click", () => {
    if (!apply({ type: "play" })) return;
    if (state.running && reduced) say("Playing, even though your device asks for reduced motion.", Core.result(state));
  });
  resetBtn.addEventListener("click", () => {
    state = Core.move(state, { type: "reset" });
    loop();
    render();
  });
  linesBox.addEventListener("change", () => apply({ type: "showLines", value: linesBox.checked }));
  dotsBox.addEventListener("change", () => apply({ type: "showDots", value: dotsBox.checked }));
  pRange.addEventListener("input", () => apply({ type: "coef", value: Number(pRange.value) }));
  speedIn.addEventListener("change", () => {
    if (!apply({ type: "speed", value: Number(speedIn.value) })) {
      say("Speed must be a number from 0 to 20.");
      render();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && timer) { clearInterval(timer); timer = null; }
    else if (!document.hidden && state.running) loop();
  });
  board.onTheme(() => { /* SVG classes follow the theme through CSS tokens. */ });

  render();
  if (reduced) say("Animation is off because your device asks for reduced motion. Press Play, or drag the dots.");
})();
