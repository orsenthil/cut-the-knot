"use strict";

/*
 * The page for Maxwell: drawing and input only; every geometric rule is in
 * maxwell-core.js. A 600 by 450 SVG board holds two triangles. The solid
 * sides of ABC (purple) and A'B'C' (green) show the two triangles, the light
 * lines through P and P' are the cevians, and the short coloured segments are
 * the sides of the other triangle that each cevian follows. Drag any of the
 * eight dots with a pointer, or focus a dot and use the arrow keys (Shift for
 * a bigger step). The radio buttons are the applet's Parallel/Perpendicular
 * checkboxes; Reset restores its opening figure.
 */

(function () {
  const Core = MaxwellCore;
  const statusEl = document.getElementById("status");
  const parallelRadio = document.getElementById("parallelRadio");
  const perpendicularRadio = document.getElementById("perpendicularRadio");
  const resetBtn = document.getElementById("resetBtn");

  const board = Geom.board(document.getElementById("board"));
  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start();

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

  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const keys = ["A", "B", "C"];
  const handleInfo = [
    { handle: "A", store: "A0", i: 0, label: "Point A of triangle ABC. Drag it, or focus it and use the arrow keys." },
    { handle: "B", store: "B0", i: 0, label: "Point B of triangle ABC. Drag it, or focus it and use the arrow keys." },
    { handle: "C", store: "C0", i: 0, label: "Point C of triangle ABC. Drag it, or focus it and use the arrow keys." },
    { handle: "P", store: "P0", i: 0, label: "Point P of triangle ABC. Drag it, or focus it and use the arrow keys." },
    { handle: "A'", store: "A1", i: 1, label: "Point A' of triangle A'B'C'. Drag it, or focus it and use the arrow keys." },
    { handle: "B'", store: "B1", i: 1, label: "Point B' of triangle A'B'C'. Drag it, or focus it and use the arrow keys." },
    { handle: "C'", store: "C1", i: 1, label: "Point C' of triangle A'B'C'. Drag it, or focus it and use the arrow keys." },
    { handle: "P'", store: "P1", i: 1, label: "Point P' of triangle A'B'C'. Drag it, or focus it and use the arrow keys." },
  ];

  /* Every element is created once and only its attributes change, so a dot
     keeps keyboard focus across a redraw. */
  const guide = [[], []];
  const side = [[], []];
  const cevian = [[], []];
  const footDot = [[], []];
  const text = {};
  for (let i = 0; i < 2; i++) {
    const tone = i === 0 ? "base" : "prime";
    for (let v = 0; v < 3; v++) {
      guide[i][v] = board.line(state.P[i], state.P[i], "cevian-guide guide-" + tone, guides);
      cevian[i][v] = board.segment(state.P[i], state.P[i], "cevian cevian-" + tone, shapes);
      footDot[i][v] = board.point(state.P[i], "foot-dot foot-" + tone, 3.5, marks);
    }
    side[i][0] = board.segment(state.A[i], state.B[i], "side side-" + tone, shapes);
    side[i][1] = board.segment(state.B[i], state.C[i], "side side-" + tone, shapes);
    side[i][2] = board.segment(state.C[i], state.A[i], "side side-" + tone, shapes);
  }
  const halo = board.circle(state.P[1], 14, "center-halo", marks);
  const pointOf = (store) => state[store[0]][Number(store[1])];
  for (const h of handleInfo) {
    text[h.handle] = board.label(pointOf(h.store), h.handle,
      h.i === 0 ? "point-label label-base" : "point-label label-prime", 9, -9, labels);
  }

  const clamp = (q) => ({
    x: Geom.clamp(q.x, 12, 588),
    y: Geom.clamp(q.y, 12, 438),
  });
  const handles = handleInfo.map((h) => board.handle(h.handle, pointOf(h.store), {
    step: 3,
    shift: 15,
    cls: "geom-handle " + (h.i === 0 ? "base-handle" : "prime-handle"),
    label: h.label,
    clamp,
    layer: handlesLayer,
    onMove: (p) => {
      state = Core.movePoint(state, h.store, p);
      render();
    },
  }));

  function render() {
    for (let i = 0; i < 2; i++) {
      for (let v = 0; v < 3; v++) {
        const from = state[keys[v]][i];
        const to = state.P[i];
        const foot = Core.cevianFoot(state, i, v);
        const endpoint = finite(foot) ? foot : from;
        guide[i][v].set(from, to);
        cevian[i][v].set(from, endpoint);
        footDot[i][v].set(endpoint);
      }
      side[i][0].set(state.A[i], state.B[i]);
      side[i][1].set(state.B[i], state.C[i]);
      side[i][2].set(state.C[i], state.A[i]);
    }
    halo.set(state.P[1]);
    handles.forEach((h, k) => h.set(pointOf(handleInfo[k].store)));
    for (const h of handleInfo) {
      text[h.handle].set(pointOf(h.store));
    }

    say(Core.describe(state));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  for (const [radio, mode] of [[parallelRadio, true], [perpendicularRadio, false]]) {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state = Core.setParallel(state, mode);
      render();
    });
  }

  resetBtn.addEventListener("click", () => {
    parallelRadio.checked = true;
    perpendicularRadio.checked = false;
    state = Core.start();
    render();
  });

  board.onTheme(render);
  render();
})();
