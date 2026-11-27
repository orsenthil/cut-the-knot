"use strict";

/*
 * The page for Four Touching Circles III: drawing and input only. The
 * tangency arithmetic is in four-touching-circles-3-core.js. Four circles are
 * drawn from their centres and rim points; each of those eight points is a
 * focusable handle. The contact points, the circle through the first three
 * contacts and the optional inverted circles are drawn once and updated in
 * place, so a drag or an arrow-key press never loses keyboard focus. This is
 * a picture with nothing to win or lose.
 */

(function () {
  const Core = FourTouchingCircles3Core;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const pointsChk = document.getElementById("pointsChk");
  const centersChk = document.getElementById("centersChk");
  const inversionChk = document.getElementById("inversionChk");
  const circlesChk = document.getElementById("circlesChk");
  const board = Geom.board(document.getElementById("board"));

  const guides = board.layer("guides");
  const invertedLayer = board.layer("inverted");
  const circleLayer = board.layer("circles");
  const suppliedLayer = board.layer("supplied");
  const contactLayer = board.layer("contacts");
  const handleLayer = board.layer("handles");

  let state = Core.start({});
  const first = Core.geometry(state);

  const centerLines = [0, 1, 2, 3].map(() => board.segment(first.circles[0], first.circles[0], "center-line", guides));
  const centerDots = [0, 1, 2, 3].map((i) =>
    board.point(first.circles[i], "center-dot circle-" + i, 3.5, guides));
  const invImages = [0, 1, 2, 3].map(() =>
    board.circle(first.circles[0], 1, "inverse-circle", invertedLayer));
  const invLines = [0, 1, 2, 3].map(() =>
    board.segment(first.circles[0], first.circles[0], "inverse-line", invertedLayer));
  const invOutline = board.circle(state.inv.c, 100, "inverse-outline", invertedLayer);
  const circles = [0, 1, 2, 3].map((i) =>
    board.circle(first.circles[i], first.circles[i].r, "circle-own circle-" + i, circleLayer));
  const supplied = board.circle(first.circles[0], 1, "supplied-circle", suppliedLayer);
  const contactDots = [0, 1, 2, 3, 4, 5].map(() =>
    board.point(first.circles[0], "contact-dot", 4, contactLayer));

  /** The handle's point after a core update, in board units. */
  function namedPoint(s, name) {
    if (name === "ic") return s.inv.c;
    if (name === "ib") return s.inv.b;
    const i = Number(name[1]);
    return name[0] === "c" ? s.circles[i].c : s.circles[i].b;
  }

  function clamp(q, name) {
    return namedPoint(Core.setPoint(state, name, q), name);
  }

  function onMove(p, name) {
    state = Core.setPoint(state, name, p);
    render();
  }

  const handles = [];
  for (let i = 0; i < 4; i++) {
    handles.push(board.handle("c" + i, first.circles[i].c, {
      r: 8, step: 2, shift: 12, layer: handleLayer, clamp, onMove,
      label: "Centre of circle " + (i + 1) + ". Drag it, or focus it and press the arrow keys.",
    }));
    handles.push(board.handle("b" + i, first.circles[i].b, {
      r: 8, step: 2, shift: 12, layer: handleLayer, clamp, onMove,
      label: "Rim point of circle " + (i + 1) + ". Drag it to change the size, or focus it and press the arrow keys.",
    }));
  }
  const invCenterHandle = board.handle("ic", state.inv.c, {
    r: 8, step: 2, shift: 12, layer: handleLayer, clamp, onMove,
    label: "Centre of the inversion circle. Drag it onto a contact point, or focus it and press the arrow keys.",
  });
  const invRimHandle = board.handle("ib", state.inv.b, {
    r: 8, step: 2, shift: 12, layer: handleLayer, clamp, onMove,
    label: "Rim point of the inversion circle. Drag it to change its size, or focus it and press the arrow keys.",
  });
  handles.push(invCenterHandle, invRimHandle);

  /*
   * The shared status line. `kind` is "win", "lose" or "done" and tells the
   * player's record that a play ended; this is a drawing with no win or loss,
   * so no kind is ever passed and the measurements are reported without one.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    const show = state.show;

    circles.forEach((shape, i) => {
      const c = g.circles[i];
      shape.show(show.circles);
      shape.set(c, c.r);
    });

    centerLines.forEach((shape, i) => {
      const pair = g.centerLines[i];
      shape.show(show.centers && !!pair);
      if (pair) shape.set(pair[0], pair[1]);
    });
    centerDots.forEach((shape, i) => {
      shape.show(show.centers);
      shape.set(g.circles[i]);
    });

    supplied.show(!!g.circle && Number.isFinite(g.circle.r));
    if (g.circle) supplied.set(g.circle, g.circle.r);

    contactDots.forEach((shape, i) => {
      const hit = g.contacts[i];
      shape.show(!!hit);
      if (hit) shape.set(hit.point);
    });

    invOutline.show(show.inversion);
    if (show.inversion) invOutline.set(state.inv.c, Core.dist(state.inv.c, state.inv.b));
    g.inversions.forEach((image, i) => {
      const circleImage = image.kind === "circle";
      invImages[i].show(show.inversion && circleImage);
      invLines[i].show(show.inversion && !circleImage);
      if (circleImage) invImages[i].set(image, image.r);
      else invLines[i].set(image.a, image.b);
    });

    handles.forEach((h, i) => {
      const isInversion = i >= 8;
      h.show(!isInversion || show.inversion);
      h.set(namedPoint(state, h.name));
    });
    board.root.classList.toggle("show-points", show.points);

    let message;
    if (g.contacts.length < 3) {
      message = g.contacts.length + " touching point" + (g.contacts.length === 1 ? "" : "s") +
        ". Move a centre or a rim dot until at least three circles touch.";
    } else if (g.chain.external === null) {
      message = g.contacts.length + " touching points. The dashed circle goes through the first three.";
    } else if (g.chain.external % 2 === 0) {
      message = g.chain.external + " outside touches (even): the fourth contact lies on the dashed circle.";
    } else {
      message = g.chain.external + " outside touches (odd): the fourth contact is off the dashed circle.";
    }
    if (g.contacts.length > 4) message += " " + g.contacts.length + " contacts in all.";
    if (show.inversion) message += " The faint shapes are the inverted circles.";
    say(message);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start({ show: state.show });
    render();
  });
  circlesChk.addEventListener("change", () => {
    state = Core.setOption(state, "circles", circlesChk.checked);
    render();
  });
  pointsChk.addEventListener("change", () => {
    state = Core.setOption(state, "points", pointsChk.checked);
    render();
  });
  centersChk.addEventListener("change", () => {
    state = Core.setOption(state, "centers", centersChk.checked);
    render();
  });
  inversionChk.addEventListener("change", () => {
    state = Core.setOption(state, "inversion", inversionChk.checked);
    render();
  });
  board.onTheme(() => render());

  render();
})();
