"use strict";

/*
 * The page for Coxeter's tangent circles: drawing and input only. The
 * arithmetic is in coxeter-tangent-circles-core.js. Three focusable handles
 * A, B and C are the centres of the first three circles; their radii come
 * from the distances between the centres, so the circles always touch. The
 * fourth circle, the circle through the three touching points and the other
 * family of four circles are drawn once and updated in place, so a drag or an
 * arrow-key press never loses keyboard focus. The status line reports the
 * radii; this is a drawing with nothing to win.
 */

(function () {
  const Core = CoxeterTangentCirclesCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const innerRadio = document.getElementById("innerRadio");
  const outerRadio = document.getElementById("outerRadio");
  const fillChk = document.getElementById("fillChk");
  const secondChk = document.getElementById("secondChk");
  const pointsChk = document.getElementById("pointsChk");
  const board = Geom.board(document.getElementById("board"));

  const guides = board.layer("guides");
  const originals = board.layer("originals");
  const fourthLayer = board.layer("fourth");
  const familyLayer = board.layer("family");
  const markers = board.layer("markers");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  let state = Core.start({});
  const first = Core.geometry(state);

  const sideLines = [
    board.segment(first.A, first.B, "guide", guides),
    board.segment(first.B, first.C, "guide", guides),
    board.segment(first.C, first.A, "guide", guides),
  ];
  const originalCircles = [0, 1, 2].map(() =>
    board.circle(first.A, 1, "circle-original", originals));
  const fourth = board.circle(first.A, 1, "circle-fourth", fourthLayer);
  const familyCircles = [0, 1, 2, 3].map(() =>
    board.circle(first.A, 1, "circle-second", familyLayer));
  const contactDots = [0, 1, 2].map(() => board.point(first.A, "contact-dot", 3, markers));
  const innerDots = [0, 1, 2].map(() =>
    board.point(first.A, "contact-dot inner-contact", 3, markers));
  const labelA = board.label(first.A, "A", "point-label", -10, -8, labels);
  const labelB = board.label(first.B, "B", "point-label", -10, -8, labels);
  const labelC = board.label(first.C, "C", "point-label", -10, -8, labels);

  /** Keep a dragged or arrow-keyed centre in the canvas. */
  function clampPoint(q, name) {
    return Core.setPoint(state, name, q)[name];
  }

  function onMove(p, name) {
    state = Core.setPoint(state, name, p);
    render();
  }

  const aHandle = board.handle("A", first.A, {
    r: 9, step: 4, shift: 20, layer: handles, clamp: clampPoint, onMove: onMove,
    label: "Point A, the centre of the first circle. Drag it, or focus it and press the arrow keys.",
  });
  const bHandle = board.handle("B", first.B, {
    r: 9, step: 4, shift: 20, layer: handles, clamp: clampPoint, onMove: onMove,
    label: "Point B, the centre of the second circle. Drag it, or focus it and press the arrow keys.",
  });
  const cHandle = board.handle("C", first.C, {
    r: 9, step: 4, shift: 20, layer: handles, clamp: clampPoint, onMove: onMove,
    label: "Point C, the centre of the third circle. Drag it, or focus it and press the arrow keys.",
  });

  /**
   * The shared status line. `kind` is "win", "lose" or "done" and tells the
   * player's record a play ended; this is a picture with no win or loss, so
   * no kind is ever passed and the measurements are reported without one.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (v) => v.toFixed(1);

  function render() {
    const g = Core.geometry(state);
    const shown = g.valid;

    sideLines.forEach((line, i) => {
      line.show(shown);
      if (shown) line.set([g.A, g.B, g.C][i], [g.B, g.C, g.A][i]);
    });
    originalCircles.forEach((shape, i) => {
      shape.show(shown);
      if (shown) {
        shape.set(g.circles[i], g.circles[i].r);
        shape.node.setAttribute("class", fillChk.checked ? "circle-original filled" : "circle-original");
      }
    });
    fourth.show(shown);
    if (shown) {
      fourth.set(g.circle, g.circle.r);
      fourth.node.setAttribute("class", fillChk.checked ? "circle-fourth filled" : "circle-fourth");
    }
    familyCircles.forEach((shape, i) => {
      shape.show(shown && secondChk.checked);
      if (shown) {
        shape.set(g.second[i], g.second[i].r);
        shape.node.setAttribute("class", fillChk.checked ? "circle-second filled" : "circle-second");
      }
    });

    [g.points.ABp, g.points.BCp, g.points.CAp].forEach((p, i) => {
      contactDots[i].show(shown && pointsChk.checked);
      if (shown) contactDots[i].set(p);
    });
    [g.points.AKp, g.points.BKp, g.points.CKp].forEach((p, i) => {
      innerDots[i].show(shown && pointsChk.checked);
      if (shown) innerDots[i].set(p);
    });

    labelA.set(g.A);
    labelB.set(g.B);
    labelC.set(g.C);
    aHandle.set(g.A);
    bHandle.set(g.B);
    cHandle.set(g.C);

    if (!shown) {
      say("Move the three dots so they make a triangle; then the three circles touch.");
    } else {
      const family = state.innerCircle ? "small circle in the gap" : "circle around the three";
      say("Circle radii " + fmt(g.radii.a) + ", " + fmt(g.radii.b) + ", " + fmt(g.radii.c) +
        ". The " + family + " has radius " + fmt(g.circle.r) +
        ". The second four circles touch at the same six points.");
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start({ innerCircle: innerRadio.checked });
    render();
  });
  innerRadio.addEventListener("change", () => {
    if (innerRadio.checked) {
      state = Core.setFamily(state, true);
      render();
    }
  });
  outerRadio.addEventListener("change", () => {
    if (outerRadio.checked) {
      state = Core.setFamily(state, false);
      render();
    }
  });
  fillChk.addEventListener("change", render);
  secondChk.addEventListener("change", render);
  pointsChk.addEventListener("change", render);
  board.onTheme(() => render());

  render();
})();
