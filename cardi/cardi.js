"use strict";

/*
 * The page for Cardi: drawing and input only; all the geometry is in
 * cardi-core.js. An SVG holds the fixed circle, the rolling circle at the
 * current instant, the cardioid traced by M, and one of the three overlays
 * from the old applet: the tangent and mirror line, the hinged parallelogram
 * OPMQ, or the doubled parallelogram that finds the far end N of the chord.
 * M and T are draggable handles; the buttons roll the circle a step at a time
 * or let it play, as the applet's mouse click started and stopped the motion.
 */

(function () {
  const Core = CardiCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const playBtn = document.getElementById("playBtn");
  const stepBtn = document.getElementById("stepBtn");
  const resetBtn = document.getElementById("resetBtn");
  const showBtn = document.getElementById("showBtn");
  const modeBtns = [...document.querySelectorAll("[data-mode]")];

  let state = Core.start({});
  let timer = null;

  /** `#status` is read by the player's record; "done" means the picture was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Back to front: the traced curve, the guide lines, the two circles, the
   * selected construction, named dots and labels, then the two handles. */
  const curveLayer = board.layer("curve");
  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const overlay = board.layer("overlay");
  const dots = board.layer("dots");
  const letterLayer = board.layer("letters");
  const handleLayer = board.layer("handles");

  // The curve is fixed: sample the applet's closed form once into a path.
  const samples = [];
  for (let i = 0; i <= 360; i++) {
    const p = Core.formulaPoint((i * Core.TAU) / 360, Core.O, Core.R, Core.R_MOVING, 1);
    samples.push(`${i ? "L" : "M"} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`);
  }
  board.el("path", { d: samples.join(" ") + " Z" }, "cardioid", curveLayer);

  const g0 = Core.geometry(state);
  const fixedCircle = board.circle(g0.O, g0.R, "fixed-circle", shapes);
  const movingCircle = board.circle(g0.P, g0.r, "moving-circle", shapes);
  const opLine = board.segment(g0.O, g0.P, "centres", guides);
  const tangentLine = board.line(g0.T, Core.tangent(g0).along(200), "tangent", guides);
  const amLine = board.segment(g0.A, g0.M, "am", overlay);
  const bisectorLine = board.line(g0.T, Core.tangent(g0).along(200), "bisector", overlay);
  const rods = [
    board.segment(g0.P, g0.M, "rod", overlay),
    board.segment(g0.O, g0.Q, "rod", overlay),
    board.segment(g0.Q, g0.M, "rod", overlay),
  ];
  const chord = board.segment(g0.M, g0.N, "rod double", overlay);

  const dotO = board.point(g0.O, "fixed-dot", 4, dots);
  const dotA = board.point(g0.A, "fixed-dot", 4, dots);
  const dotT = board.point(g0.T, "contact-dot", 4, dots);
  const dotP = board.point(g0.P, "moving-dot", 4, dots);
  const dotFoot = board.point(g0.foot, "pedal-dot", 4, dots);
  const dotQ = board.point(g0.Q, "moving-dot", 4, dots);
  const dotN = board.point(g0.N, "moving-dot", 4, dots);

  const letters = {};
  for (const key of ["A", "M", "T", "O", "P", "Q", "N"]) {
    letters[key] = board.label(g0[key], key, "glabel", 8, -8, letterLayer);
  }

  /* The handles project onto their own curve, so M stays on the cardioid and
   * T stays on the fixed circle while either is dragged or moved by a key. */
  const handles = {
    M: board.handle("M", g0.M, {
      r: 9, step: 3, shift: 15, cls: "geom-handle handle-m", layer: handleLayer,
      label: "Point M on the cardioid. Drag it, or focus it and use the arrow keys to turn the rolling circle.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      clamp: (p) => Core.clamp(p, "M"),
      onMove: (p) => apply({ type: "theta", value: Core.thetaFrom(p, "M") }),
    }),
    T: board.handle("T", g0.T, {
      r: 9, step: 3, shift: 15, cls: "geom-handle handle-t", layer: handleLayer,
      label: "Point T where the two circles touch. Drag it round the fixed circle, or use the arrow keys.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      clamp: (p) => Core.clamp(p, "T"),
      onMove: (p) => apply({ type: "theta", value: Core.thetaFrom(p, "T") }),
    }),
  };

  function render() {
    const g = Core.geometry(state);
    handles.M.set(g.M);
    handles.T.set(g.T);

    fixedCircle.set(g.O, g.R);
    movingCircle.set(g.P, g.r);
    opLine.set(g.O, g.P);
    const at = Core.tangent(g);
    tangentLine.set(g.T, at.along(200));
    bisectorLine.set(g.T, at.along(200));

    amLine.set(g.A, g.M);
    rods[0].set(g.P, g.M);
    rods[1].set(g.O, g.Q);
    rods[2].set(g.Q, g.M);
    chord.set(g.M, g.N);

    const show = state.construction;
    tangentLine.show(show && state.mode === "cross");
    amLine.show(show && state.mode === "cross");
    bisectorLine.show(show && state.mode === "cross");
    for (const rod of rods) rod.show(show && state.mode !== "cross");
    chord.show(show && state.mode === "double");

    dotO.set(g.O);
    dotA.set(g.A);
    dotT.set(g.T);
    dotP.set(g.P);
    dotFoot.set(g.foot);
    dotQ.set(g.Q);
    dotN.set(g.N);
    dotFoot.show(show && state.mode === "cross");
    dotQ.show(show && state.mode !== "cross");
    dotN.show(show && state.mode === "double");

    for (const key of ["A", "M", "T", "O", "P", "Q", "N"]) letters[key].set(g[key]);
    letters.M.show(true);
    letters.Q.show(show && state.mode !== "cross");
    letters.N.show(show && state.mode === "double");

    playBtn.textContent = timer ? "Pause" : "Play";
    playBtn.setAttribute("aria-pressed", String(Boolean(timer)));
    stepBtn.disabled = Boolean(timer);
    showBtn.setAttribute("aria-pressed", String(show));
    showBtn.textContent = show ? "Hide construction" : "Show construction";
    for (const btn of modeBtns) btn.setAttribute("aria-pressed", String(btn.dataset.mode === state.mode));

    say(Core.describe(state), Core.result(state));

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function apply(m) {
    if (!m) return false;
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render();
    return true;
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    render();
  }

  function play() {
    if (timer) { stop(); return; }
    timer = setInterval(() => apply({ type: "step" }), Core.TICK_MS);
    apply({ type: "step" });
  }

  playBtn.addEventListener("click", play);
  stepBtn.addEventListener("click", () => { if (timer) stop(); apply({ type: "step" }); });
  resetBtn.addEventListener("click", () => { stop(); apply({ type: "reset" }); });
  showBtn.addEventListener("click", () => apply({ type: "construction", value: !state.construction }));
  for (const btn of modeBtns) {
    btn.addEventListener("click", () => apply({ type: "mode", value: btn.dataset.mode }));
  }
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLElement && ["BUTTON", "INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
    if (e.key === " ") { e.preventDefault(); play(); }
    else if (e.key === "r" || e.key === "R") { stop(); apply({ type: "reset" }); }
    else if (e.key === "c" || e.key === "C") {
      const i = Core.MODES.indexOf(state.mode);
      apply({ type: "mode", value: Core.MODES[(i + 1) % Core.MODES.length] });
    }
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && timer) stop(); });

  board.onTheme(render);
  render();
})();
