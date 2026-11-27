"use strict";

/*
 * The Divergent Spirals page: drawing and input only. All the numbers come
 * from divergent-spirals-core.js, which transcribes the applet's Reset(),
 * DrawTop() and run().
 *
 * The applet draws one circular arc per ring and rotates the whole stack a
 * fixed angle per tick. Here each arc is an SVG circle with a dashed stroke;
 * rotating the layer reproduces Graphics2D.rotate(). A draggable dot on an
 * outer ring lets a player turn the picture by hand (mouse, touch or arrow
 * keys) without changing the drawing algorithm.
 */

(() => {
  const C = DivergentSpiralsCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const runBtn = document.getElementById("runBtn");
  const cwBtn = document.getElementById("cwBtn");
  const ccwBtn = document.getElementById("ccwBtn");
  const fastBtn = document.getElementById("fastBtn");
  const slowBtn = document.getElementById("slowBtn");
  const openingInput = document.getElementById("openingInput");
  const overlapInput = document.getElementById("overlapInput");
  const openingValue = document.getElementById("openingValue");
  const overlapValue = document.getElementById("overlapValue");
  const resetBtn = document.getElementById("resetBtn");

  const center = { x: Math.trunc(C.CANVAS.width / 2), y: Math.trunc(C.CANVAS.height / 2) };
  const knobRadius = C.radius(C.start()) + 14;

  const guides = board.layer("guides");
  const arcLayer = board.layer("arcs");
  const handles = board.layer("handles");

  // The half-ring behind the turn knob, and the fixed centre of the design.
  board.circle(center, knobRadius, "knob-track", guides);
  board.arc(center, knobRadius, -Math.PI / 2, Math.PI / 2, "knob-track-strong", guides);
  board.point(center, "center-dot", 3, guides);

  let state = C.start();
  let seen = { cw: false, ccw: false };
  let timer = 0;
  let geometryKey = "";
  const arcNodes = [];

  /** Status text. `kind` is "done" once both turns have been watched. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** SVG circles start their dash at 3 o'clock and run clockwise (y down). */
  function setArc(shape, arc) {
    const node = shape.node;
    const circumference = 2 * Math.PI * arc.radius;
    const sweep = Math.min(arc.sweep, 360); // drawArc above 360 is a full circle
    node.setAttribute("cx", center.x);
    node.setAttribute("cy", center.y);
    node.setAttribute("r", arc.radius);
    if (sweep >= 360) node.setAttribute("stroke-dasharray", "none");
    else node.setAttribute("stroke-dasharray", `${circumference * sweep / 360} ${circumference}`);
    node.setAttribute("stroke-dashoffset", -circumference * (arc.start % 360) / 360);
  }

  function updateArcs(arcs) {
    while (arcNodes.length < arcs.length) {
      arcNodes.push(board.circle(center, 1, "spiral-arc", arcLayer));
    }
    arcNodes.forEach((node, i) => {
      node.show(i < arcs.length);
      if (i < arcs.length) setArc(node, arcs[i]);
    });
  }

  function synchroniseControls() {
    runBtn.textContent = state.running ? "Stop" : "Start";
    runBtn.setAttribute("aria-label", state.running ? "Stop the rotation" : "Start the rotation");
    cwBtn.setAttribute("aria-pressed", String(state.clockwise));
    ccwBtn.setAttribute("aria-pressed", String(!state.clockwise));
    fastBtn.setAttribute("aria-pressed", String(state.fast));
    slowBtn.setAttribute("aria-pressed", String(!state.fast));
    // The applet disables its Fast and Slow checkboxes until Start is pressed.
    fastBtn.disabled = !state.running;
    slowBtn.disabled = !state.running;
    openingInput.value = String(state.opening);
    overlapInput.value = String(state.overlap);
    openingValue.textContent = `${state.opening}°`;
    overlapValue.textContent = String(state.overlap);
  }

  function render() {
    const arcs = C.arcs(state);
    const key = `${state.opening}|${state.overlap}|${arcs.length}`;
    if (key !== geometryKey) {
      updateArcs(arcs);
      geometryKey = key;
    }
    arcLayer.setAttribute("transform", `rotate(${state.angle * 180 / Math.PI} ${center.x} ${center.y})`);
    knob.set(Geom.pointOnCircle(center, knobRadius, state.angle));

    if (seen.cw && seen.ccw) {
      say("You have watched both turns. Clockwise seems to send a light spiral outward; counterclockwise seems to draw both inward. The drawing never changes — only which way it turns.", "done");
    } else {
      const motion = state.running ? "Turning" : "Stopped";
      const dir = state.clockwise ? "clockwise" : "counterclockwise";
      const speed = state.fast ? "fast" : "slow";
      say(`${motion} ${dir}, ${speed}. Arc angle ${state.opening}°, overlap ${state.overlap}, ${arcs.length} arcs.`, null);
    }
    if (window.Track) window.Track.state(C.position(state));
  }

  const knob = board.handle("turn", Geom.pointOnCircle(center, knobRadius, state.angle), {
    r: 10, step: 3, shift: 15, layer: handles,
    label: "Turn the design: drag this dot, or focus it and use the arrow keys to rotate the picture",
    describe: (p) => `about ${Math.round((Math.atan2(p.y - center.y, p.x - center.x) * 180 / Math.PI + 360) % 360)} degrees`,
    clamp: (p) => Geom.pointOnCircle(center, knobRadius, Math.atan2(p.y - center.y, p.x - center.x)),
    onMove: (p) => {
      const next = Math.atan2(p.y - center.y, p.x - center.x);
      let change = next - state.angle;
      change = Math.atan2(Math.sin(change), Math.cos(change));
      if (change > 0) seen.cw = true; else if (change < 0) seen.ccw = true;
      state = C.setOptions(state, { angle: next });
      render();
    },
  });

  function tick() {
    if (!state.running) return;
    state = C.advance(state, 1);
    if (state.clockwise && state.fast) seen.cw = true;
    if (!state.clockwise) seen.ccw = true;
    render();
    timer = setTimeout(tick, C.period(state.fast));
  }

  function toggleRun() {
    clearTimeout(timer);
    state = C.setOptions(state, { running: !state.running });
    synchroniseControls();
    if (state.running) tick(); else render();
  }

  function setDirection(clockwise) {
    // itemStateChanged() reads both checkboxes and resets Period from Fast.
    state = C.setOptions(state, { clockwise: clockwise });
    synchroniseControls();
    render();
  }

  function setFast(fast) {
    // itemStateChanged(): Fast state and Period = fast ? 10 : 20.
    state = C.setOptions(state, { fast: fast });
    synchroniseControls();
    render();
  }

  function reset() {
    clearTimeout(timer);
    state = C.start();
    seen = { cw: false, ccw: false };
    geometryKey = "";
    synchroniseControls();
    render();
  }

  runBtn.addEventListener("click", toggleRun);
  cwBtn.addEventListener("click", () => setDirection(true));
  ccwBtn.addEventListener("click", () => setDirection(false));
  fastBtn.addEventListener("click", () => setFast(true));
  slowBtn.addEventListener("click", () => setFast(false));
  resetBtn.addEventListener("click", reset);
  openingInput.addEventListener("input", () => {
    state = C.setOptions(state, { opening: Number(openingInput.value) });
    synchroniseControls();
    render();
  });
  overlapInput.addEventListener("input", () => {
    state = C.setOptions(state, { overlap: Number(overlapInput.value) });
    synchroniseControls();
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
    if (e.key === "s" || e.key === "S") toggleRun();
    if (e.key === "r" || e.key === "R") reset();
  });

  board.onTheme(render);
  synchroniseControls();
  render();
})();
