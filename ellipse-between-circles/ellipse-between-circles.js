"use strict";

/*
 * The page for Ellipse Between Circles: drawing and input only; the geometry is
 * in ellipse-between-circles-core.js. A 400 by 250 SVG holds the two given
 * circles, the dashed ellipse their centres define, and the third circle the
 * slider picks. Points C and D are focusable handles that slide along the
 * horizontal diameter (the applet's Fix(2)), and the slider keeps the applet's
 * 0..101 scrollbar range with T = value/100.
 */

(() => {
  const C = EllipseBetweenCirclesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const slider = document.getElementById("slider");
  const sliderOut = document.getElementById("sliderOut");
  const resetBtn = document.getElementById("resetBtn");

  let state = C.start();

  /** The status line; "done" is this demo's only possible end. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Layers in paint order: guides, circles, labels, the two handles. */
  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const labels = board.layer("labels");
  const tops = board.layer("handles");

  const diameter = board.segment(C.A, C.B, "axis", guides);
  const fociLine = board.segment(C.A, C.B, "foci-line", guides);
  const bigCircle = board.circle(C.A, C.B.x - C.A.x, "circle-big", shapes);
  const smallCircle = board.circle(C.A, 1, "circle-small", shapes);
  const locus = board.el("ellipse", { cx: 0, cy: 0, rx: 1, ry: 1 }, "locus", shapes);
  const newCircle = board.circle(C.A, 1, "circle-new", shapes);
  const bigDot = board.point(C.A, "focus-dot", 3.5, labels);
  const smallDot = board.point(C.B, "focus-dot", 3.5, labels);
  const newDot = board.point(C.A, "new-dot", 3.5, labels);
  const bigLabel = board.label(C.A, "outer centre", "pt-label", -20, -8, labels);
  const smallLabel = board.label(C.B, "inner centre", "pt-label", -22, 15, labels);

  const dHandle = board.handle("d", state.d, {
    r: 7, step: 5, layer: tops,
    label: "Point D, the left end of the small circle. Drag it, or focus it and use the arrow keys to slide it along the diameter",
    describe: (p) => `at ${Math.round(p.x)} across, on the diameter`,
    clamp: (q, name) => C.clampHandle(q, name),
    onMove: (p, name) => { state = C.setHandle(state, name, p); render(); },
  });
  const cHandle = board.handle("c", state.c, {
    r: 7, step: 5, layer: tops,
    label: "Point C, the right end of the small circle. Drag it, or focus it and use the arrow keys to slide it along the diameter",
    describe: (p) => `at ${Math.round(p.x)} across, on the diameter`,
    clamp: (q, name) => C.clampHandle(q, name),
    onMove: (p, name) => { state = C.setHandle(state, name, p); render(); },
  });

  function render() {
    const g = C.compute(state);
    diameter.set(g.A, g.B);
    fociLine.set(g.big, g.small);
    bigCircle.set(g.big, g.big.r);
    smallCircle.set(g.small, g.small.r).show(g.small.r > 0);
    const r = g.rect;
    locus.setAttribute("cx", r.x + r.w / 2);
    locus.setAttribute("cy", r.y + r.h / 2);
    locus.setAttribute("rx", r.w / 2);
    locus.setAttribute("ry", r.h / 2);
    locus.style.display = r.w > 0 && r.h > 0 ? "" : "none";
    newCircle.set(g.centre, g.r).show(g.r > 0);
    bigDot.set(g.big);
    smallDot.set(g.small).show(g.small.r > 0);
    newDot.set(g.centre).show(g.r > 0);
    bigLabel.set(g.big);
    smallLabel.set(g.small).show(g.small.r > 0);
    dHandle.set(state.d);
    cHandle.set(state.c);

    slider.value = String(state.slider);
    sliderOut.textContent = String(state.slider);

    say(C.status(state, g), C.result(state));
    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        slider: state.slider, c: state.c, d: state.d,
        big: g.big, small: g.small, centre: g.centre, radius: g.r, ellipse: r,
      });
    }
  }

  slider.addEventListener("input", () => {
    state = C.setSlider(state, slider.value);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = C.start();
    render();
  });

  board.onTheme(render);
  render();
})();
