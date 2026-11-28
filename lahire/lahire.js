"use strict";

/*
 * The page for La Hire's Theorem: drawing and input only. All the geometry
 * lives in lahire-core.js; this file lays out the applet's 600 by 450 board
 * with a circle, the two red polars, the blue rays shown at a touch, and the
 * little pairs of eyes that wake up when the two points line up.
 *
 * Four handles (O, R, A and B) are created once and moved with .set(), so a
 * handle keeps keyboard focus after every redraw. Dragging the circle's rim
 * translates O and R together, as MoveableCircle did in the applet.
 */

(() => {
  const C = LahireCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesChk = document.getElementById("namesChk");
  const newBtn = document.getElementById("newBtn");
  const { width, height } = C.VIEW;
  const PAD = 12;

  let state = C.start();
  let eyesOpen = false;

  /** The line under the picture. A droodle has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* ---------------------------------------------------------- the drawing */

  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const faces = board.layer("faces");
  faces.setAttribute("aria-hidden", "true");
  const labels = board.layer("labels");
  const tops = board.layer("handles");

  const mainCircle = board.circle(state.O, 1, "main-circle", guides);
  const rimHit = board.circle(state.O, 1, "rim-hit", guides);
  rimHit.node.setAttribute("aria-hidden", "true");

  const polarOfA = board.line(state.A, state.B, "polar-line", guides);
  const polarOfB = board.line(state.B, state.A, "polar-line", guides);
  const rayA = board.segment(state.O, state.A, "ray", shapes);
  const rayB = board.segment(state.O, state.B, "ray", shapes);
  const inverseA = board.point(state.A, "inverse-dot", 6, shapes);
  const inverseB = board.point(state.B, "inverse-dot", 6, shapes);

  const names = {
    O: board.label(state.O, "O", "pt-label", -18, -14, labels),
    R: board.label(state.R, "R", "pt-label", -18, -14, labels),
    A: board.label(state.A, "A", "pt-label", 10, -14, labels),
    B: board.label(state.B, "B", "pt-label", 10, -14, labels),
    C: board.label(state.B, "C", "pt-label", 10, -14, labels),
    D: board.label(state.A, "D", "pt-label", 10, -14, labels),
  };

  /* The applet's three mouseTracker eyes, reduced to outlines and pupils. */
  const eyePlaces = [
    { x: 40, y: 30, r: 10 },
    { x: width - 110, y: 50, r: 10 },
    { x: 175, y: 25, r: 15 },
  ];
  const eyes = eyePlaces.map((place) => {
    board.el("ellipse", { cx: place.x, cy: place.y, rx: place.r, ry: place.r }, "eye", faces);
    return { ...place, pupil: board.point(place, "eye-pupil", place.r / 2, faces) };
  });

  function moveEyes(at) {
    for (const eye of eyes) {
      const dx = at.x - eye.x;
      const dy = at.y - eye.y;
      const d = Math.hypot(dx, dy) || 1;
      const r = eyesOpen ? eye.r * 0.86 : eye.r * 0.45;
      const room = eye.r - r;
      eye.pupil.set({ x: eye.x + (dx / d) * room, y: eye.y + (dy / d) * room }, r);
    }
  }

  /* Between(O, X, P): the applet draws the blue ray to P when X is between
     O and P, otherwise only as far as the inverse point X. */
  function between(o, x, p) {
    if (Math.abs(o.x - p.x) < 1) return (p.y - x.y) * (o.y - x.y) < 0;
    return (p.x - x.x) * (o.x - x.x) < 0;
  }

  const clampPoint = (q) => ({
    x: Geom.clamp(q.x, PAD, width - PAD),
    y: Geom.clamp(q.y, PAD, height - PAD),
  });
  const describe = (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down in the drawing`;

  const handles = {
    O: board.handle("O", state.O, {
      r: 10, step: 1, layer: tops, clamp: clampPoint, describe,
      label: "Point O, centre of the circle. Drag it, or use the arrow keys; Shift takes bigger steps",
      onMove: (p) => { state = C.moveVertex(state, "O", p); render(); },
    }),
    R: board.handle("R", state.R, {
      r: 10, step: 1, layer: tops, clamp: clampPoint, describe,
      label: "Point R on the circle. Drag it to resize the circle, or use the arrow keys",
      onMove: (p) => { state = C.moveVertex(state, "R", p); render(); },
    }),
    A: board.handle("A", state.A, {
      r: 10, step: 1, layer: tops, clamp: clampPoint, describe,
      label: "Point A. Drag it onto B's polar, or use the arrow keys; Shift takes bigger steps",
      onMove: (p) => { state = C.moveVertex(state, "A", p); render(); },
    }),
    B: board.handle("B", state.B, {
      r: 10, step: 1, layer: tops, clamp: clampPoint, describe,
      label: "Point B. Drag it onto A's polar, or use the arrow keys; Shift takes bigger steps",
      onMove: (p) => { state = C.moveVertex(state, "B", p); render(); },
    }),
  };

  /* Dragging the rim moves the circle: O and R translate together. */
  rimHit.node.addEventListener("pointerdown", (e) => {
    const start = board.toLocal(e.clientX, e.clientY);
    const origin = { ...state.O };
    const move = (ev) => {
      const p = board.toLocal(ev.clientX, ev.clientY);
      state = C.moveCircle(state, clampPoint({
        x: origin.x + p.x - start.x,
        y: origin.y + p.y - start.y,
      }));
      render();
      ev.preventDefault();
    };
    const stop = () => {
      board.root.removeEventListener("pointermove", move);
      board.root.removeEventListener("pointerup", stop);
      board.root.removeEventListener("pointercancel", stop);
      board.root.removeEventListener("lostpointercapture", stop);
    };
    if (board.root.setPointerCapture) board.root.setPointerCapture(e.pointerId);
    board.root.addEventListener("pointermove", move);
    board.root.addEventListener("pointerup", stop);
    board.root.addEventListener("pointercancel", stop);
    board.root.addEventListener("lostpointercapture", stop);
    e.preventDefault();
  });

  board.root.addEventListener("pointermove", (e) => {
    if (!board.root.querySelector(".geom-handle:active")) moveEyes(board.toLocal(e.clientX, e.clientY));
  });

  function render() {
    const g = C.geometry(state);
    eyesOpen = g.touching;

    mainCircle.set(g.circle.center, g.circle.radius);
    rimHit.set(g.circle.center, g.circle.radius);

    polarOfA.show(Boolean(g.polarA)).set(g.polarA ? g.polarA.a : state.O, g.polarA ? g.polarA.b : state.A);
    polarOfB.show(Boolean(g.polarB)).set(g.polarB ? g.polarB.a : state.B, g.polarB ? g.polarB.b : state.A);

    if (g.touching && g.C && g.D) {
      rayA.show(true).set(state.O, between(state.O, g.D, state.A) ? state.A : g.D);
      rayB.show(true).set(state.O, between(state.O, g.C, state.B) ? state.B : g.C);
      inverseA.show(true).set(g.D);
      inverseB.show(true).set(g.C);
    } else {
      rayA.show(false);
      rayB.show(false);
      inverseA.show(false);
      inverseB.show(false);
    }

    for (const name of ["O", "R", "A", "B"]) handles[name].set(state[name]);
    names.O.set(state.O);
    names.R.set(state.R);
    names.A.set(state.A);
    names.B.set(state.B);
    names.C.show(state.showNames && Boolean(g.C)).set(g.C || state.B);
    names.D.show(state.showNames && Boolean(g.D)).set(g.D || state.A);
    for (const name of ["O", "R", "A", "B"]) names[name].show(state.showNames);
    moveEyes({ x: width / 2, y: height / 2 });

    say(C.status(state, g));

    // The position, for the player's record and the tutor (board units).
    if (window.Track) window.Track.state(state);
  }

  namesChk.addEventListener("change", () => {
    state = C.setShowNames(state, namesChk.checked);
    render();
  });
  newBtn.addEventListener("click", () => {
    state = C.start();
    namesChk.checked = state.showNames;
    render();
  });
  board.onTheme(render);
  render();
})();
