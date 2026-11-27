"use strict";

/*
 * The page for Fagnano IV: drawing and input only; the geometry is in
 * fagnano-iv-core.js. A 400 by 250 SVG board holds the triangle ABC, the
 * circumcircle, the inscribed triangle PQR, and the three pairs of eyes that
 * open when P, Q, R sit on the altitude feet. Drag any of the six dots, or
 * focus one and use the arrow keys (Shift for bigger steps). The two
 * checkboxes are the applet's "names" and "hint"; Reset is a modern extra,
 * the applet had no button.
 */

(function () {
  const Core = FagnanoIvCore;
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  const resetBtn = document.getElementById("resetBtn");

  const board = Geom.board(document.getElementById("board"));
  const quadsLayer = board.layer("quads");
  const circleLayer = board.layer("circle");
  const guidesLayer = board.layer("guides");
  const shapesLayer = board.layer("shapes");
  const dotsLayer = board.layer("dots");
  const eyesLayer = board.layer("eyes");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start();
  let first = Core.compute(state);
  let mouse = { x: 200, y: 125 };

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are how the player's record learns that a play has
   * ended. This is an illustration, so no kind is ever used here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Every element is created once; render only changes its attributes, so a
     focused handle keeps its focus while the figure moves. */
  const quads = [
    board.polygon([first.O, first.P, first.C, first.Q], "quad quad-c", quadsLayer),
    board.polygon([first.O, first.Q, first.A, first.R], "quad quad-a", quadsLayer),
    board.polygon([first.O, first.R, first.B, first.P], "quad quad-b", quadsLayer),
  ];
  const circumcircle = board.circle(state.A, 10, "circumcircle", circleLayer);

  const triangleEdges = [
    board.segment(state.A, state.B, "tri-edge", shapesLayer),
    board.segment(state.B, state.C, "tri-edge", shapesLayer),
    board.segment(state.C, state.A, "tri-edge", shapesLayer),
  ];
  const innerEdges = [
    board.segment(state.A, state.A, "inner-edge", shapesLayer),
    board.segment(state.A, state.A, "inner-edge", shapesLayer),
    board.segment(state.A, state.A, "inner-edge", shapesLayer),
  ];
  const toSide = [
    board.segment(state.A, state.A, "radius-line", guidesLayer),
    board.segment(state.A, state.A, "radius-line", guidesLayer),
    board.segment(state.A, state.A, "radius-line", guidesLayer),
  ];
  const toVertex = [
    board.segment(state.A, state.A, "radius-line", guidesLayer),
    board.segment(state.A, state.A, "radius-line", guidesLayer),
    board.segment(state.A, state.A, "radius-line", guidesLayer),
  ];
  const altitudes = [
    board.line(state.A, state.A, "altitude", guidesLayer),
    board.line(state.B, state.B, "altitude", guidesLayer),
    board.line(state.C, state.C, "altitude", guidesLayer),
  ];
  const normals = [];
  const rightAngles = [];
  const normalDots = [];
  for (let i = 0; i < 6; i++) {
    normals.push(board.segment(state.A, state.A, "normal", guidesLayer));
    rightAngles.push(board.rightAngle(state.A, state.A, state.A, 6, "right-angle", guidesLayer));
    normalDots.push(board.point(state.A, "normal-dot", 2.5, dotsLayer));
  }
  const orthicDots = [
    board.point(state.A, "orthic-dot", 5, dotsLayer),
    board.point(state.A, "orthic-dot", 5, dotsLayer),
    board.point(state.A, "orthic-dot", 5, dotsLayer),
  ];
  const centreDot = board.point(state.A, "centre-dot", 4, dotsLayer);

  const labelNames = ["A", "B", "C", "P", "Q", "R", "O", "Ha", "Hb", "Hc"];
  const text = {};
  for (const name of labelNames) {
    text[name] = board.label(state.A, name === "Ha" ? "Hₐ" : name === "Hb" ? "Hᵦ" : name === "Hc" ? "Hc" : name,
      "point-label", 7, -8, labelsLayer);
  }
  const labelOffsets = {
    A: [-15, -10], B: [-16, 17], C: [8, 17],
    P: [8, -9], Q: [8, -9], R: [-17, -9], O: [8, -8],
    Ha: [8, 15], Hb: [8, -9], Hc: [8, -9],
  };

  /* Three pairs of eyes, as in the applet: P at the left, Q in the middle,
     R at the right. The pupils follow the pointer; a winking eye gets a lid. */
  const eyeCentres = [{ x: 48, y: 20 }, { x: 200, y: 20 }, { x: 352, y: 20 }];
  const eyes = eyeCentres.map((c, i) => {
    const white = board.circle(c, 9, "eye-white", eyesLayer);
    const outline = board.circle(c, 9, "eye-outline", eyesLayer);
    const iris = board.circle(c, 4, "eye-iris", eyesLayer);
    const lid = board.segment({ x: c.x - 9, y: c.y }, { x: c.x + 9, y: c.y }, "eye-lid", eyesLayer);
    const name = board.label({ x: c.x, y: c.y + 19 }, ["P", "Q", "R"][i], "eye-label", -4, 0, eyesLayer);
    return { white, outline, iris, lid, name, centre: c };
  });

  function drawEyes(f) {
    for (let i = 0; i < eyes.length; i++) {
      const e = eyes[i];
      const dx = mouse.x - e.centre.x, dy = mouse.y - e.centre.y;
      const d = Math.hypot(dx, dy) || 1;
      const reach = f.eyesOpen ? 4 : 2;
      e.iris.set({ x: e.centre.x + (dx / d) * reach, y: e.centre.y + (dy / d) * reach },
        f.eyesOpen ? 4 : 3);
      e.lid.show(!f.eyesOpen);
      e.white.show(true);
      e.outline.show(true);
    }
  }

  const clamp = (name) => (q) => Core.clampPoint(state, name, q);
  const onMove = (name) => (p) => {
    state = Core.move(state, name, p);
    render();
  };
  const handles = {};
  for (const name of ["A", "B", "C", "P", "Q", "R"]) {
    const side = ["P", "Q", "R"].includes(name);
    handles[name] = board.handle(name, first[name], {
      r: side ? 9 : 11,
      step: 2,
      shift: 10,
      cls: side ? "geom-handle side-handle" : "geom-handle vertex-handle",
      label: `Point ${name}. Drag it` +
        (side ? " along the side of the triangle, or focus it and use the arrow keys." :
          " to change the triangle, or focus it and use the arrow keys."),
      clamp: clamp(name),
      onMove: onMove(name),
      layer: handlesLayer,
    });
  }

  function render() {
    const f = Core.compute(state);
    const ok = Core.finite(f.O) && Number.isFinite(f.r);
    const pts = [[f.O, f.P, f.C, f.Q], [f.O, f.Q, f.A, f.R], [f.O, f.R, f.B, f.P]];
    for (let i = 0; i < 3; i++) {
      quads[i].show(ok).set(pts[i]);
      triangleEdges[i].set([f.A, f.B, f.C, f.A][i], [f.A, f.B, f.C, f.A][(i + 1) % 3]);
      innerEdges[i].set([f.P, f.Q, f.R][i], [f.P, f.Q, f.R][(i + 1) % 3]);
      toSide[i].show(ok).set(f.O, [f.P, f.Q, f.R][i]);
      toVertex[i].show(ok).set(f.O, [f.A, f.B, f.C][i]);
    }
    circumcircle.show(ok && f.r < 5000).set(ok ? f.O : f.A, ok ? f.r : 1);
    centreDot.show(ok).set(ok ? f.O : f.A);

    const feet = [f.Ha, f.Hb, f.Hc];
    const from = [f.A, f.B, f.C];
    for (let i = 0; i < 3; i++) {
      altitudes[i].show(state.showHint && Core.finite(feet[i])).set(from[i], Core.finite(feet[i]) ? feet[i] : from[i]);
      orthicDots[i].show(state.showHint && Core.finite(feet[i])).set(Core.finite(feet[i]) ? feet[i] : from[i]);
    }

    const verts = [[f.B, f.C], [f.C, f.A], [f.A, f.B]];
    const sides = [f.P, f.Q, f.R];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const k = i * 2 + j;
      const n = f.normals[i][j];
      const good = ok && Core.finite(n) && Core.dist(n, sides[i]) > 0.5 && Core.dist(n, verts[i][j]) > 0.5;
      normals[k].show(good).set(good ? sides[i] : f.A, good ? n : f.A);
      rightAngles[k].show(good).set(good ? n : f.A, good ? sides[i] : f.A, good ? verts[i][j] : f.A, 6);
      normalDots[k].show(good).set(good ? n : f.A);
    }

    const at = { A: f.A, B: f.B, C: f.C, P: f.P, Q: f.Q, R: f.R, O: f.O, Ha: f.Ha, Hb: f.Hb, Hc: f.Hc };
    for (const name of labelNames) {
      const show = ["Ha", "Hb", "Hc"].includes(name)
        ? state.showHint && Core.finite(at[name]) && state.showNames
        : state.showNames && (name === "O" ? ok : true);
      const [dx, dy] = labelOffsets[name];
      text[name].show(show).set(Core.finite(at[name]) ? at[name] : f.A, name, dx, dy);
    }

    for (const name of ["A", "B", "C"]) handles[name].set(state[name]);
    handles.P.set(f.P);
    handles.Q.set(f.Q);
    handles.R.set(f.R);

    namesBox.checked = state.showNames;
    hintBox.checked = state.showHint;
    drawEyes(f);
    say(Core.describe(state, f));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  board.root.addEventListener("pointermove", (e) => {
    mouse = board.toLocal(e.clientX, e.clientY);
    drawEyes(Core.compute(state));
  });

  for (const [box, key] of [[namesBox, "showNames"], [hintBox, "showHint"]]) {
    box.addEventListener("change", () => {
      state = Core.option(state, key, box.checked);
      render();
    });
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start();
    render();
  });

  board.onTheme(render);
  render();
})();
