"use strict";

/*
 * The page for Area Of Triangle: drawing and input only, with the geometry in
 * area-of-triangle-core.js. The SVG board holds triangle ABC, its altitude CH
 * and the rectangles ABQP, AHCP and HBQC. The three corners are Geom handles,
 * so a pointer or the arrow keys can move them; three checkboxes reproduce the
 * applet's "triangle", "names" and "colors" switches, and Reset restores the
 * opening picture. Every shape is made once and re-set on each redraw, so a
 * handle keeps its keyboard focus.
 */

(function () {
  const Core = AreaOfTriangleCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    fills: board.layer("fills"),
    guides: board.layer("guides"),
    sides: board.layer("sides"),
    marks: board.layer("marks"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geometry = Core.compute(state);

  /** Status line; a demo has no winner, so it never takes win/lose classes. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const triangleFill = board.polygon([state.A, state.B, state.C], "triangle-fill", layers.fills);
  const leftFill = board.polygon([state.A, state.A, state.C, state.A], "rect-fill rect-left", layers.fills);
  const rightFill = board.polygon([state.A, state.B, state.A, state.C], "rect-fill rect-right", layers.fills);

  const guides = [
    board.line(state.C, geometry.H, "guide", layers.guides),
    board.line(state.A, geometry.P, "guide", layers.guides),
    board.line(state.B, geometry.Q, "guide", layers.guides),
  ];
  const sides = [
    board.segment(state.A, state.C, "side", layers.sides),
    board.segment(state.B, state.C, "side", layers.sides),
    board.segment(state.A, state.B, "base", layers.sides),
    board.segment(geometry.P, geometry.Q, "top", layers.sides),
  ];
  const rightMarks = [
    board.rightAngle(geometry.H, state.A, state.C, 8, "rightmark", layers.marks),
    board.rightAngle(geometry.P, state.A, state.C, 8, "rightmark", layers.marks),
    board.rightAngle(geometry.Q, state.B, state.C, 8, "rightmark", layers.marks),
  ];
  const footDots = [
    board.point(geometry.H, "footdot", 3.5, layers.dots),
    board.point(geometry.P, "footdot", 3.5, layers.dots),
    board.point(geometry.Q, "footdot", 3.5, layers.dots),
  ];

  const labelOffsets = {
    A: [-13, -11], B: [8, -11], C: [8, -8],
    H: [-9, 17], P: [-14, -9], Q: [8, -9],
  };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label(state.A, name, "point-label",
      labelOffsets[name][0], labelOffsets[name][1], layers.labels);
  }

  const handles = {};
  for (const name of Core.NAMES) {
    handles[name] = board.handle(name, state[name], {
      r: 10,
      step: 4,
      cls: "geom-handle corner-handle",
      layer: layers.handles,
      label: "Corner " + name + ". Drag it, or focus it and use the arrow keys to move it.",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      clamp: (q) => ({
        x: Math.max(8, Math.min(state.width - 8, q.x)),
        y: Math.max(8, Math.min(state.height - 8, q.y)),
      }),
      onMove: (p, which) => apply({ type: "point", name: which, point: p }),
    });
  }

  function show(shape, on) { shape.show(on); return shape; }

  function draw() {
    const g = geometry;
    const points = { A: g.A, B: g.B, C: g.C, H: g.H, P: g.P, Q: g.Q };
    for (const name of Core.NAMES) handles[name].set(state[name]);

    triangleFill.set([g.A, g.B, g.C]).show(state.showTriangle);
    leftFill.set([g.A, g.H, g.C, g.P]).show(state.showColors);
    rightFill.set([g.H, g.B, g.Q, g.C]).show(state.showColors);

    guides[0].set(g.C, g.H);
    guides[1].set(g.A, g.P);
    guides[2].set(g.B, g.Q);
    sides[0].set(g.A, g.C);
    sides[1].set(g.B, g.C);
    sides[2].set(g.A, g.B);
    sides[3].set(g.P, g.Q);

    rightMarks[0].set(g.H, g.A, g.C, 8);
    rightMarks[1].set(g.P, g.A, g.C, 8);
    rightMarks[2].set(g.Q, g.B, g.C, 8);
    footDots[0].set(g.H);
    footDots[1].set(g.P);
    footDots[2].set(g.Q);
    for (let i = 0; i < 3; i++) {
      const v = [g.H, g.P, g.Q][i];
      const on = !g.degenerate &&
        Math.hypot(v.x - [g.A, g.A, g.B][i].x, v.y - [g.A, g.A, g.B][i].y) > 6;
      show(rightMarks[i], on);
      show(footDots[i], !g.degenerate);
    }

    for (const name of Object.keys(labels)) {
      labels[name].set(points[name]).show(state.showNames && !g.degenerate);
    }
  }

  function statusText(g) {
    if (g.degenerate) return "Put the three corners apart so they make a triangle.";
    const base = Math.round(g.base);
    const height = Math.round(g.height);
    const big = Math.round(g.rectangleArea);
    const small = Math.round(g.triangleArea);
    const outside = g.insideBase
      ? "Both small rectangles fit inside the big one."
      : "One little rectangle is counted with a minus sign, yet the sum is still the same.";
    return `Base ${base}, altitude ${height}. The rectangles add to ${big} and the triangle is ${small}, exactly half. ${outside}`;
  }

  /** Redraw, speak the picture and save the position for the record and tutor. */
  function render() {
    geometry = Core.compute(state);
    draw();
    say(statusText(geometry));
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; an illegal one leaves the picture as it was. */
  function apply(m) {
    const next = Core.move(state, m);
    if (!next) {
      render();
      return false;
    }
    state = next;
    render();
    return true;
  }

  const checkboxes = {
    showTriangle: document.getElementById("triangleBox"),
    showNames: document.getElementById("namesBox"),
    showColors: document.getElementById("colorsBox"),
  };
  for (const key of Object.keys(checkboxes)) {
    const box = checkboxes[key];
    box.checked = state[key];
    box.addEventListener("change", () => apply({ type: "option", key, value: box.checked }));
  }
  document.getElementById("resetBtn").addEventListener("click", () => {
    apply({ type: "reset" });
    for (const key of Object.keys(checkboxes)) checkboxes[key].checked = state[key];
  });

  // Classes are styled with CSS tokens, so a theme flip needs no new colours.
  board.onTheme(() => draw());

  render();
})();
