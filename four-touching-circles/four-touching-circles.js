"use strict";

/*
 * Four Touching Circles: drawing and input only; all geometry is in
 * four-touching-circles-core.js. Two vertical lines and two circles touch in
 * a ring; move A, B, E or the inversion circle O,R. Tick "Inverted diagram"
 * to see their images and the circle through the four contact points. All
 * shapes are created once and updated in place, so a handle keeps keyboard
 * focus after every move.
 */

(function () {
  const Core = FourTouchingCirclesCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const invertAtEBtn = document.getElementById("invertAtEBtn");
  const invChk = document.getElementById("invChk");
  const board = Geom.board(document.getElementById("board"));

  const guides = board.layer("guides");
  const circles = board.layer("circles");
  const images = board.layer("images");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  let state = Core.start({});
  let first = Core.geometry(state);

  /* An image may be a circle or a line (when the original passes through O). */
  function flexShape(cls, layer) {
    const circle = board.circle(first.O, 1, cls, layer);
    const line = board.line(first.O, first.R, cls, layer);
    return {
      set(image) {
        const isCircle = image.kind === "circle";
        circle.show(isCircle);
        line.show(!isCircle && image.kind === "line");
        if (isCircle) circle.set(image.center, image.radius);
        else if (image.kind === "line") line.set(image.p, image.q);
        else { circle.show(false); line.show(false); }
      },
      show(on) { circle.show(on); line.show(on); },
    };
  }

  const invCircle = board.circle(first.O, first.inversion.radius, "inv-circle", circles);
  const circleA = board.circle(first.cA.center, first.cA.radius, "chain-circle-a", circles);
  const circleB = board.circle(first.cB.center, first.cB.radius, "chain-circle-b", circles);
  const baseLine = board.line(first.A, first.B, "base-line", guides);
  const guideA = board.line(first.lineA.p, first.lineA.q, "guide-line", guides);
  const guideB = board.line(first.lineB.p, first.lineB.q, "guide-line", guides);

  const imageA = flexShape("image-circle-a", images);
  const imageB = flexShape("image-circle-b", images);
  const imageAB = flexShape("image-line-ab", images);
  const imageCA = flexShape("image-chain-a", images);
  const imageCB = flexShape("image-chain-b", images);
  const throughCircle = board.circle(first.O, 1, "through-circle", images);
  const throughLine = board.line(first.O, first.R, "through-line", images);

  const dotA = board.point(first.A, "contact-dot", 5, dots);
  const dotB = board.point(first.B, "contact-dot", 5, dots);
  const dotE = board.point(first.E, "contact-dot", 5, dots);
  const dotA2 = board.point(first.invertedPoints.A, "image-dot", 4, dots);
  const dotB2 = board.point(first.invertedPoints.B, "image-dot", 4, dots);
  const dotE2 = board.point(first.invertedPoints.E, "image-dot", 4, dots);
  const dotO = board.point(first.O, "center-dot", 4, dots);

  const labA = board.label(first.A, "A", "point-label", -14, -8, labels);
  const labB = board.label(first.B, "B", "point-label", 7, -8, labels);
  const labE = board.label(first.E, "E", "point-label", 7, -8, labels);
  const labO = board.label(first.O, "O", "point-label", 7, -8, labels);
  const labR = board.label(first.R, "R", "point-label", 7, -8, labels);

  const clampPoint = (q) => ({
    x: Geom.clamp(q.x, 16, state.width - 16),
    y: Geom.clamp(q.y, 16, state.height - 16),
  });

  function mover(name, r) {
    return board.handle(name, state[name], {
      r, step: 4, shift: 20, layer: handles,
      label: "Point " + name + ". Drag it, or focus it and press the arrow keys to move it.",
      describe: (p) => `${name} at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      clamp: clampPoint,
      onMove: (p) => {
        state = Core.setPoint(state, name, p);
        render();
      },
    });
  }

  const hA = mover("A", 9);
  const hB = mover("B", 9);
  const hE = mover("E", 9);
  const hO = mover("O", 9);
  const hR = mover("R", 7);

  /** The shared status line: a picture, so no win, loss or finished class. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    const inverted = invChk.checked;
    const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);

    invCircle.set(g.inversion.center, g.inversion.radius);
    circleA.set(g.cA.center, g.cA.radius);
    circleB.set(g.cB.center, g.cB.radius);
    baseLine.set(g.A, g.B);
    guideA.set(g.lineA.p, g.lineA.q);
    guideB.set(g.lineB.p, g.lineB.q);
    baseLine.show(!inverted);
    guideA.show(!inverted);
    guideB.show(!inverted);
    circleA.show(!inverted);
    circleB.show(!inverted);

    imageA.set(g.imgLineA);
    imageB.set(g.imgLineB);
    imageAB.set(g.imgLineAB);
    imageCA.set(g.imgCA);
    imageCB.set(g.imgCB);
    for (const shape of [imageA, imageB, imageAB, imageCA, imageCB]) shape.show(inverted);

    if (g.through && finite(g.through.center) && Number.isFinite(g.through.radius)) {
      throughCircle.set(g.through.center, g.through.radius);
      throughCircle.show(inverted);
      throughLine.show(false);
    } else {
      throughLine.set(g.invertedPoints.A, g.invertedPoints.B);
      throughLine.show(inverted && finite(g.invertedPoints.A));
      throughCircle.show(false);
    }

    dotA.set(g.A); dotB.set(g.B); dotE.set(g.E); dotO.set(g.O);
    dotA.show(!inverted); dotB.show(!inverted); dotE.show(!inverted);
    if (finite(g.invertedPoints.A)) dotA2.set(g.invertedPoints.A);
    if (finite(g.invertedPoints.B)) dotB2.set(g.invertedPoints.B);
    if (finite(g.invertedPoints.E)) dotE2.set(g.invertedPoints.E);
    dotA2.show(inverted && finite(g.invertedPoints.A));
    dotB2.show(inverted && finite(g.invertedPoints.B));
    dotE2.show(inverted && finite(g.invertedPoints.E));
    dotO.show(true);

    labA.set(g.A, "A", -14, -8); labB.set(g.B, "B", 7, -8);
    labE.set(g.E, "E", 7, -8); labO.set(g.O, "O", 7, -8);
    labR.set(g.R, "R", 7, -8);
    for (const lab of [labA, labB, labE]) lab.show(!inverted);
    labO.show(true); labR.show(true);

    hA.set(g.A); hB.set(g.B); hE.set(g.E); hO.set(g.O); hR.set(g.R);

    const contacts = inverted
      ? "Inverted contacts A′, E′, B′ and O lie on one circle"
      : "Contacts A, E, B and the point at infinity lie on the line AB";
    say(contacts + ". Inversion radius " + g.inversion.radius.toFixed(1) +
      ". Drag the circled points to change the chain.");

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start({ inverted: invChk.checked });
    render();
  });
  invertAtEBtn.addEventListener("click", () => {
    // With O at E, the two circles tangent at E invert to parallel lines,
    // which is the picture discussed on the cut-the-knot page.
    state = Core.setPoint(state, "O", state.E);
    // A smaller inversion circle keeps the two image lines on the board.
    state = Core.setPoint(state, "R", {
      x: state.E.x + 70, y: state.E.y + 50,
    });
    invChk.checked = true;
    render();
  });
  invChk.addEventListener("change", render);
  board.onTheme(() => render());

  render();
})();
