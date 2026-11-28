"use strict";

/*
 * The page for invert: drawing and input only. The seven-rod geometry and all
 * five drag rules live in invert-core.js. An SVG board shows the rhombus
 * ABCD, the two long rods from O, the rod PA, the guide circle centred at P,
 * and the straight line traced by C. Geom handles let a pointer or the arrow
 * keys move O, A, B, C or P; every colour comes from the site's CSS tokens.
 */

(function () {
  const Core = InvertCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    guides: board.layer("guides"),
    trail: board.layer("trail"),
    rods: board.layer("rods"),
    marks: board.layer("marks"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();

  /** The record learns "explored" from the "done" class on #status. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* ------------------------------------------------------ drawn objects */

  const rods = {
    ob: board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "rod rod-long", layers.rods),
    od: board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "rod rod-long", layers.rods),
    ab: board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "rod rod-rhombus", layers.rods),
    bc: board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "rod rod-rhombus", layers.rods),
    cd: board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "rod rod-rhombus", layers.rods),
    da: board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "rod rod-rhombus", layers.rods),
    pa: board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "rod rod-pivot", layers.rods),
  };
  const guides = {
    circle: board.circle({ x: 0, y: 0 }, 1, "guide-circle", layers.guides),
    ray: board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "guide-ray", layers.guides),
    diagonal: board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "guide-diagonal", layers.guides),
  };
  const cDot = board.point({ x: 0, y: 0 }, "trace-point", 5, layers.marks);

  const labelNames = ["O", "P", "A", "B", "C", "D"];
  const offsets = {
    O: [-15, 16], P: [-14, -11], A: [8, -9], B: [8, -9], C: [-15, -9], D: [8, 16],
  };
  const labels = {};
  for (const name of labelNames) {
    labels[name] = board.label({ x: 0, y: 0 }, name, "point-label",
      offsets[name][0], offsets[name][1], layers.labels);
  }

  const trailSegs = [];
  function poolTrail(n) {
    while (trailSegs.length < n) {
      trailSegs.push(board.segment({ x: 0, y: 0 }, { x: 1, y: 1 },
        "trace-line", layers.trail));
    }
    trailSegs.forEach((s, i) => s.show(i < n));
  }

  const handleNames = ["O", "A", "B", "C", "P"];
  const noun = {
    O: "pivot O", A: "circle point A", B: "corner B", C: "drawing point C",
    P: "circle centre P",
  };
  const handles = {};
  for (const name of handleNames) {
    handles[name] = board.handle(name, state[name === "P" ? "center" : name], {
      r: 9,
      step: 2,
      shift: 10,
      cls: "geom-handle joint-handle" + (name === "C" ? " drawing-handle" : ""),
      layer: layers.handles,
      label: noun[name] + ". Drag it, or focus it and press the arrow keys to move it.",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      onMove: (p, which) => apply({ type: "drag", which: which, point: p },
        "Moved " + noun[which] + " to (" + Math.round(p.x) + ", " + Math.round(p.y) + ")."),
    });
  }

  /* ------------------------------------------------------------- drawing */

  function draw() {
    rods.ob.set(state.O, state.B);
    rods.od.set(state.O, state.D);
    rods.ab.set(state.A, state.B);
    rods.bc.set(state.B, state.C);
    rods.cd.set(state.C, state.D);
    rods.da.set(state.D, state.A);
    rods.pa.set(state.center, state.A);

    guides.circle.set(state.center, state.radius);
    guides.ray.set(state.O, state.A);
    guides.diagonal.set(state.B, state.D);
    for (const key of Object.keys(guides)) guides[key].show(state.showCircle);

    cDot.set(state.C);
    const points = { O: state.O, P: state.center, A: state.A, B: state.B, C: state.C, D: state.D };
    for (const name of labelNames) labels[name].set(points[name], name).show(state.showNames);

    const path = state.trajectory.concat([state.draw, state.C]).filter(
      (p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    poolTrail(Math.max(0, path.length - 1));
    for (let i = 1; i < path.length; i++) {
      if (trailSegs[i - 1]) trailSegs[i - 1].set(path[i - 1], path[i]);
    }

    for (const name of handleNames) handles[name].set(points[name]);
  }

  function statusText() {
    const oa = Math.hypot(state.A.x - state.O.x, state.A.y - state.O.y);
    const oc = Math.hypot(state.C.x - state.O.x, state.C.y - state.O.y);
    const power = state.longOne * state.longOne - state.rombSide * state.rombSide;
    if (state.failed) {
      return "The rods cannot close there, so the last good picture stays. " +
        "Drag A nearer the middle of the dashed circle, or press Reset.";
    }
    return "OA = " + oa.toFixed(1) + ", OC = " + oc.toFixed(1) +
      ", so OA × OC = " + Math.round(oa * oc) + " = " + Math.round(power) +
      " = OB² − AB². A and C stay opposite each other on the green line." +
      (state.trajectory.length > 1 ? " C has drawn " + state.trajectory.length + " trace points."
        : " Drag A around the circle to draw the line.");
  }

  /** Redraw, speak what happened and save the position for the record/tutor. */
  function render() {
    draw();
    say(statusText(), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /** A refused drag restores every handle to the last good linkage. */
  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render();
    if (note) say(note + " " + statusText(), Core.result(state));
    return true;
  }

  const namesBox = document.getElementById("showNames");
  const guidesBox = document.getElementById("showGuides");
  namesBox.checked = state.showNames;
  guidesBox.checked = state.showCircle;
  namesBox.addEventListener("change", () =>
    apply({ type: "option", key: "showNames", value: namesBox.checked }));
  guidesBox.addEventListener("change", () =>
    apply({ type: "option", key: "showCircle", value: guidesBox.checked }));

  document.getElementById("clearBtn").addEventListener("click", () =>
    apply({ type: "clearTrail" }, "Cleared the traced line."));
  document.getElementById("resetBtn").addEventListener("click", () =>
    apply({ type: "reset" }, "Back to the opening linkage."));

  // Mouse up and key release end a grab, as in the applet's mouseReleased.
  board.root.addEventListener("pointerup", () => apply({ type: "release" }));
  board.root.addEventListener("pointercancel", () => apply({ type: "release" }));
  board.root.addEventListener("keyup", (e) => {
    if (e.key.startsWith("Arrow")) apply({ type: "release" });
  });

  board.onTheme(() => draw());
  render();
})();
