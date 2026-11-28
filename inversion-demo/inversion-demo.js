"use strict";

/*
 * The page for Inversion Demo: drawing and input only. The inversion, the
 * random circles and the stack all live in inversion-demo-core.js.
 *
 * The stage is the applet's 600 by 450 drawing. O and A set the circle of
 * inversion. Each coloured circle has a centre C and a rim point B: drag
 * either dot, or drag the circle itself to move both at once. Its image is
 * drawn in the same colour, dashed; when the circle reaches O the image is a
 * dashed straight line. Objects are created once and moved with .set(), so a
 * dot keeps keyboard focus while it is dragged or nudged with arrow keys.
 */

(() => {
  const C = InversionDemoCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const addBtn = document.getElementById("addBtn");
  const removeBtn = document.getElementById("removeBtn");
  const resetBtn = document.getElementById("resetBtn");
  const { width, height } = C.VIEW;
  const PAD = 6;

  let state = C.start();

  /** The line under the picture. An illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const guides = board.layer("guides");
  const images = board.layer("images");
  const sources = board.layer("sources");
  const labels = board.layer("labels");
  const tops = board.layer("handles");

  const radiusLine = board.segment(state.O, state.A, "radius-line", guides);
  const invCircle = board.circle(state.O, 1, "inv-circle", sources);
  const oLabel = board.label(state.O, "O", "pt-label", -19, -12, labels);
  const aLabel = board.label(state.A, "A", "pt-label", 10, -10, labels);

  const clampPoint = (q) => ({
    x: Geom.clamp(q.x, PAD, width - PAD),
    y: Geom.clamp(q.y, PAD, height - PAD),
  });
  const describe = (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down in the drawing`;

  const inversionHandles = {
    O: board.handle("O", state.O, {
      r: 11, step: 5, cls: "geom-handle", layer: tops, clamp: clampPoint, describe,
      label: "Point O, centre of inversion. Drag it, or focus it and use the arrow keys",
      onMove: (p) => { state = C.moveVertex(state, "O", p); render(); },
    }),
    A: board.handle("A", state.A, {
      r: 11, step: 5, cls: "geom-handle", layer: tops, clamp: clampPoint, describe,
      label: "Point A on the inversion circle. Drag it, or focus it and use the arrow keys",
      onMove: (p) => { state = C.moveVertex(state, "A", p); render(); },
    }),
  };

  const views = [];

  /* Drag the rim of a coloured circle: its centre and rim translate together. */
  function wireCircleDrag(view, slot) {
    view.hit.node.addEventListener("pointerdown", (e) => {
      if (slot >= state.circles.length) return;
      const start = board.toLocal(e.clientX, e.clientY);
      const origin = { ...state.circles[slot].C };
      const svg = board.root;
      const move = (ev) => {
        const p = board.toLocal(ev.clientX, ev.clientY);
        state = C.moveCircle(state, slot, clampPoint({
          x: origin.x + p.x - start.x,
          y: origin.y + p.y - start.y,
        }));
        render();
        ev.preventDefault();
      };
      const stop = () => {
        svg.removeEventListener("pointermove", move);
        svg.removeEventListener("pointerup", stop);
        svg.removeEventListener("pointercancel", stop);
        svg.removeEventListener("lostpointercapture", stop);
      };
      if (svg.setPointerCapture) svg.setPointerCapture(e.pointerId);
      svg.addEventListener("pointermove", move);
      svg.addEventListener("pointerup", stop);
      svg.addEventListener("pointercancel", stop);
      svg.addEventListener("lostpointercapture", stop);
      e.preventDefault();
    });
  }

  function makeView(slot) {
    const at = { x: 0, y: 0 };
    const view = {
      ring: board.circle(at, 1, "target-ring", sources),
      hit: board.circle(at, 1, "circle-hit", sources),
      imageCircle: board.circle(at, 1, "image-circle", images),
      imageLine: board.line(at, { x: 1, y: 0 }, "image-line", images),
      C: board.handle("C" + slot, at, {
        r: 9, step: 5, cls: "geom-handle", layer: tops, clamp: clampPoint, describe,
        label: `Centre of circle ${slot + 1}. Drag it, or focus it and use the arrow keys`,
        onMove: (p) => { state = C.moveVertex(state, "C" + slot, p); render(); },
      }),
      B: board.handle("B" + slot, at, {
        r: 9, step: 5, cls: "geom-handle", layer: tops, clamp: clampPoint, describe,
        label: `Rim point of circle ${slot + 1}. Drag it, or focus it and use the arrow keys`,
        onMove: (p) => { state = C.moveVertex(state, "B" + slot, p); render(); },
      }),
    };
    view.hit.node.setAttribute("aria-label", `Circle ${slot + 1}. Drag the rim to move the whole circle`);
    wireCircleDrag(view, slot);
    views.push(view);
    return view;
  }

  function render() {
    const g = C.geometry(state);
    radiusLine.set(state.O, state.A);
    invCircle.set(g.inversion.center, g.inversion.radius);
    oLabel.set(state.O);
    aLabel.set(state.A);

    while (views.length < state.circles.length) makeView(views.length);
    for (let i = 0; i < views.length; i++) {
      const view = views[i];
      const item = g.items[i];
      if (!item) {
        view.ring.show(false);
        view.hit.show(false);
        view.imageCircle.show(false);
        view.imageLine.show(false);
        view.C.show(false);
        view.B.show(false);
        continue;
      }
      const palette = "palette-" + Math.max(0, C.COLORS.indexOf(item.color));
      view.ring.show(true).set(item.source.center, item.source.radius);
      view.ring.node.setAttribute("class", "target-ring " + palette);
      view.hit.show(true).set(item.source.center, item.source.radius);
      view.C.show(true).set(state.circles[i].C);
      view.B.show(true).set(state.circles[i].B);
      if (item.image.kind === "circle") {
        view.imageCircle.show(true).set(item.image.center, item.image.radius);
        view.imageCircle.node.setAttribute("class", "image-circle " + palette);
        view.imageLine.show(false);
      } else if (item.image.kind === "line" && item.image.point) {
        view.imageCircle.show(false);
        view.imageLine.show(true).set(item.image.point, {
          x: item.image.point.x + item.image.direction.x,
          y: item.image.point.y + item.image.direction.y,
        });
        view.imageLine.node.setAttribute("class", "image-line " + palette);
      } else {
        view.imageCircle.show(false);
        view.imageLine.show(false);
      }
    }

    for (const name of ["O", "A"]) inversionHandles[name].set(state[name]);
    say(C.status(state, g));

    // The position, for the player's record and the tutor (board units).
    if (window.Track) window.Track.state(state);
  }

  addBtn.addEventListener("click", () => { state = C.addCircle(state); render(); });
  removeBtn.addEventListener("click", () => { state = C.removeCircle(state); render(); });
  resetBtn.addEventListener("click", () => { state = C.start(); render(); });
  board.onTheme(render);
  render();
})();
