"use strict";

/*
 * The drawing and input for Arbelos Incircle. All the geometry is in
 * arbelos-incircle-core.js; this file only puts the three arcs, the inscribed
 * circle, the tangency points and the three joining lines on an SVG board.
 * C is the applet's one draggable handle, held on the baseline so the picture
 * is always a true arbelos. The two checkboxes and Reset are drawing options.
 */

(function () {
  const Core = ArbelosIncircleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const guidesBox = document.getElementById("guides");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /* Layers, back to front: the arbelos wash, the three arcs and baseline,
   * the construction lines, the circle, small dots, names, then the handle. */
  const wash = board.layer("wash");
  const arcs = board.layer("arcs");
  const guides = board.layer("guides");
  const circleLayer = board.layer("circle");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const washPath = board.el("path", null, "arbelos-fill", wash);
  const bigArc = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "arc arc-big", arcs);
  const leftArc = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "arc", arcs);
  const rightArc = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "arc", arcs);
  const baseline = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "baseline", arcs);

  const joins = [
    board.line({ x: 0, y: 0 }, { x: 0, y: 0 }, "join", guides),
    board.line({ x: 0, y: 0 }, { x: 0, y: 0 }, "join", guides),
    board.line({ x: 0, y: 0 }, { x: 0, y: 0 }, "join join-cd", guides),
  ];
  const circle = board.circle({ x: 0, y: 0 }, 1, "incircle", circleLayer);

  const dotKeys = ["D", "E", "F", "M", "N", "S"];
  const dotStyle = { S: "dot dot-s", D: "dot dot-touch", E: "dot dot-touch", F: "dot dot-touch" };
  const dotByKey = {};
  for (const key of dotKeys) dotByKey[key] = board.point({ x: 0, y: 0 }, dotStyle[key] || "dot", 3.5, dots);

  const labelOffsets = {
    A: [-14, 18], B: [6, 18], C: [-5, 20],
    M: [-10, -8], N: [-9, -8], S: [7, -7],
    D: [6, -7], E: [-15, -8], F: [6, -8],
  };
  const labels = {};
  for (const key of Object.keys(labelOffsets)) {
    labels[key] = board.label({ x: 0, y: 0 }, key, "point-label", labelOffsets[key][0], labelOffsets[key][1], names);
  }

  const handle = board.handle("C", state.C, {
    label: "Point C, where the two small half-circles meet. Drag it, or focus it and use the arrow keys.",
    r: 8, step: 5, shift: 15, layer: top,
    clamp: (q) => Core.project(q),
    describe: (p) => "on the baseline at x = " + Math.round(p.x),
    onMove: (p) => {
      state = Core.move(state, p);
      render();
    },
  });

  /** Only the three classes below tell the record that a play has ended. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** The arbelos: big upper arc, then the right and left arcs back to A. */
  function arbelosPath(g) {
    return "M " + g.A.x + " " + g.A.y +
      " A " + g.R + " " + g.R + " 0 0 1 " + g.B.x + " " + g.B.y +
      " A " + g.r2 + " " + g.r2 + " 0 0 0 " + g.C.x + " " + g.C.y +
      " A " + g.r1 + " " + g.r1 + " 0 0 0 " + g.A.x + " " + g.A.y + " Z";
  }

  function render() {
    const g = Core.geometry(state);
    if (!g) {
      say("Drag C between A and B.");
      if (window.Track) window.Track.state(state);
      return;
    }

    handle.set(state.C);
    washPath.setAttribute("d", arbelosPath(g));
    bigArc.set(g.O, g.R, Math.PI, 2 * Math.PI);
    leftArc.set(g.O1, g.r1, Math.PI, 2 * Math.PI);
    rightArc.set(g.O2, g.r2, Math.PI, 2 * Math.PI);
    baseline.set(g.A, g.B);
    circle.set(g.P, g.rho);
    joins[0].set(g.A, g.N);
    joins[1].set(g.B, g.M);
    joins[2].set(g.C, g.D);
    for (const line of joins) line.show(state.guides);
    for (const key of dotKeys) dotByKey[key].set(g[key]);

    for (const key of Object.keys(labels)) {
      labels[key].set(g[key]);
      labels[key].show(state.names);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, O: g.O, O1: g.O1, O2: g.O2,
        M: g.M, N: g.N, P: g.P, D: g.D, E: g.E, F: g.F, S: g.S,
        r1: g.r1, r2: g.r2, R: g.R, radius: g.rho,
        circles: g.circles, options: { names: state.names, guides: state.guides },
      });
    }
  }

  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  guidesBox.addEventListener("change", () => {
    state = Core.setOption(state, "guides", guidesBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    namesBox.checked = state.names;
    guidesBox.checked = state.guides;
    render();
  });

  board.onTheme(render);
  render();
})();
