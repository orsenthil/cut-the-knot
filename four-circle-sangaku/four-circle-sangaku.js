"use strict";

/*
 * The page for Four Circle Sangaku: drawing and input only. The geometry is in
 * four-circle-sangaku-core.js. The large circle, the diameter AB and the chord
 * CD are guides; the three circles are drawn once and updated in place, so a
 * dragged handle keeps its keyboard focus. All colours come from site tokens.
 */

(function () {
  const Core = FourCircleSangakuCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const board = Geom.board(document.getElementById("board"));
  const width = 400, height = 260;

  const guides = board.layer("guides");
  const circlesLayer = board.layer("circles");
  const hintLayer = board.layer("hints");
  const dots = board.layer("dots");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start({ width, height });
  let last = Core.compute(state);

  const bigCircle = board.circle(state.center, state.radius, "big-circle", guides);
  const abLine = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "diameter", guides);
  const cdLine = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "chord", guides);
  const caLine = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "side", guides);
  const cbLine = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "side", guides);

  const upperCircle = board.circle(state.center, 1, "incircle", circlesLayer);
  const leftCircle = board.circle(state.center, 1, "outer-circle", circlesLayer);
  const rightCircle = board.circle(state.center, 1, "outer-circle", circlesLayer);

  const leftTangent = board.line({ x: 0, y: 0 }, { x: 0, y: 1 }, "hint-line", hintLayer);
  const rightTangent = board.line({ x: 0, y: 0 }, { x: 0, y: 1 }, "hint-line", hintLayer);
  const uvLine = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "hint-segment", hintLayer);

  const fixedDots = ["A", "B", "O", "P", "Q", "D"].map((name) =>
    board.point({ x: 0, y: 0 }, "geom-dot", 2.6, dots));
  const hintDots = ["S", "T", "W"].map(() =>
    board.point({ x: 0, y: 0 }, "hint-dot", 2.6, dots));

  const names = ["A", "B", "C", "D", "O", "P", "Q", "I", "U", "V", "W", "S", "T"];
  const labels = names.map((name) => board.label({ x: 0, y: 0 }, "", "point-label", 4, -5, labelsLayer));

  const point = Core.pointAt(state.center, state.radius, state.angle);
  const cHandle = board.handle("C", point, {
    r: 9, step: 3, shift: 12, layer: handlesLayer,
    label: "Point C on the large circle. Drag it, or focus it and use the arrow keys to move it around the circle.",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y) + " on the board",
    clamp: (q) => Core.projectToCircle(q, state.center, state.radius),
    onMove: (p) => {
      state = Core.moveC(state, p);
      render();
    },
  });

  /**
   * The shared status line. "win", "lose" and "done" tell the player's record
   * that a play ended; this picture has no win or loss, so no kind is used.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    // Compute() in the applet leaves the picture alone when C reaches A; at B
    // the triangle collapses. Both ends hold the last good diagram here.
    const atB = Core.distance(state.C, {
      x: state.center.x + state.radius, y: state.center.y,
    }) <= Core.TOO_CLOSE;
    const solution = atB ? null : Core.compute(state);
    if (solution) last = solution;
    const g = solution || last;

    bigCircle.set(g.circle.center, g.circle.radius);
    abLine.set(g.A, g.B);
    cdLine.set(state.C, g.D);
    caLine.set(state.C, g.A);
    cbLine.set(state.C, g.B);

    upperCircle.set(g.upper.center, g.upper.radius);
    leftCircle.set(g.left.center, g.left.radius);
    rightCircle.set(g.right.center, g.right.radius);

    leftTangent.set({ x: g.left.center.x, y: 0 }, { x: g.left.center.x, y: height });
    rightTangent.set({ x: g.right.center.x, y: 0 }, { x: g.right.center.x, y: height });
    uvLine.set(g.uPoint, g.vPoint);
    [leftTangent, rightTangent, uvLine].forEach((shape) => shape.show(state.showHint));

    const fixedPoints = [g.A, g.B, g.O, g.left.center, g.right.center, g.D];
    for (let i = 0; i < fixedDots.length; i++) fixedDots[i].set(fixedPoints[i], 2.6);
    const hintPoints = [g.sPoint, g.tPoint, g.wPoint];
    for (let i = 0; i < hintDots.length; i++) {
      hintDots[i].set(hintPoints[i], 2.6);
      hintDots[i].show(state.showHint);
    }

    const labelPoints = [g.A, g.B, state.C, g.D, g.O, g.left.center, g.right.center,
      g.upper.center, g.uPoint, g.vPoint, g.wPoint, g.sPoint, g.tPoint];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const visible = state.showNames && (i < 8 || state.showHint);
      labels[i].set(labelPoints[i], visible ? name : "", 4, -5);
    }

    cHandle.set(state.C);

    if (!solution) {
      say("C is at the end of the diameter: the diagram is held still. Move C back along the circle.");
    } else {
      const mean = (g.rL + g.rR) / 2;
      say("Inside circle " + g.r.toFixed(1) + "; side circles " + g.rL.toFixed(1) +
        " and " + g.rR.toFixed(1) + ". Their average is " + mean.toFixed(1) + ".");
    }
    if (window.Track) window.Track.state(Core.position(state));
  }

  function turn(delta) {
    state = Core.turn(state, delta);
    render();
  }

  document.getElementById("leftBtn").addEventListener("click", () => turn(-Math.PI / 12));
  document.getElementById("rightBtn").addEventListener("click", () => turn(Math.PI / 12));
  document.getElementById("namesChk").addEventListener("change", (e) => {
    state = { ...state, showNames: e.target.checked };
    render();
  });
  document.getElementById("hintChk").addEventListener("change", (e) => {
    state = { ...state, showHint: e.target.checked };
    render();
  });
  document.getElementById("newBtn").addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(() => render());
  render();
})();
