"use strict";

/*
 * Page for Elkies: drawing and input only. The incircle chain is computed in
 * elkies-core.js. Three vertex handles and one point-on-a-side handle are
 * focusable and draggable; all SVG shapes are created once and updated in
 * place, so a handle keeps its keyboard focus while the six circles change.
 */

(() => {
  const Core = ElkiesCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const board = Geom.board(document.getElementById("board"));
  const resetBtn = document.getElementById("resetBtn");
  const pairInputs = Array.from(document.querySelectorAll('input[name="pair"]'));

  const sidesLayer = board.layer("sides");
  const cutsLayer = board.layer("cuts");
  const circlesLayer = board.layer("circles");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start({});

  /**
   * The shared status line. "win", "lose" and "done" are the record's result
   * classes; this is a demonstration, so it only ever reports what is drawn.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const sides = [
    board.segment(state.V[0], state.V[1], "side", sidesLayer),
    board.segment(state.V[1], state.V[2], "side base", sidesLayer),
    board.segment(state.V[2], state.V[0], "side", sidesLayer),
  ];
  const cuts = [];
  const circles = [];
  for (let k = 0; k < Core.PAIRS; k++) cuts.push(board.segment(state.V[0], state.V[1], "cut", cutsLayer));
  for (let k = 0; k <= Core.PAIRS; k++) circles.push(board.circle(state.V[0], 1, "incircle", circlesLayer));
  const names = ["A3", "A1", "A2", "P"];
  const labels = names.map((name) => board.label(state.V[0], name, "point-label", 6, -8, labelsLayer));

  /** Keep a vertex inside the board; the point P is separately kept on its side. */
  function clampVertex(q) {
    return {
      x: Geom.clamp(q.x, 2, state.width - 2),
      y: Geom.clamp(q.y, 2, state.height - 2),
    };
  }

  function clampPoint(q) {
    const next = Core.setTa(state, q);
    return Core.sidePoint({ ...state, ta: next.ta });
  }

  const handles = [0, 1, 2].map((i) => board.handle(names[i], state.V[i], {
    r: 8, step: 2, shift: 10, layer: handlesLayer,
    label: "Vertex " + names[i] + ". Drag it, or focus it and use the arrow keys to move the triangle.",
    clamp: clampVertex,
    onMove: (q) => {
      state = Core.setVertex(state, i, q);
      render();
    },
  }));

  const pointHandle = board.handle("P", Core.sidePoint(state), {
    r: 8, step: 2, shift: 10, cls: "geom-handle p-handle", layer: handlesLayer,
    label: "Point P on side A1 A2. Drag it along the side, or focus it and use the arrow keys, to move the cut.",
    clamp: clampPoint,
    onMove: (q) => {
      state = { ...state, ta: Core.setTa(state, q).ta };
      render();
    },
  });

  function render() {
    const chain = Core.chain(state);
    const V = state.V;
    const P = Core.sidePoint(state);

    sides[0].set(V[0], V[1]);
    sides[1].set(V[1], V[2]);
    sides[2].set(V[2], V[0]);

    for (let k = 0; k < cuts.length; k++) {
      const cut = chain.cuts[k];
      cuts[k].show(!!cut);
      if (cut) {
        const before = k === 0 ? P : chain.cuts[k - 1].at;
        cuts[k].set(cut.from, before);
      }
    }

    for (let k = 0; k < circles.length; k++) {
      const circle = chain.circles[k];
      circles[k].show(!!circle);
      if (!circle) continue;
      circles[k].set(circle.center, circle.radius);
      const highlighted = state.which === Core.ALL || k === state.which || k === state.which + 1;
      circles[k].node.setAttribute("class", "incircle" + (highlighted ? " pair" : "") +
        (k === 0 ? " first" : ""));
    }

    labels[0].set(V[0], "A3", 7, -9);
    labels[1].set(V[1], "A1", -22, -9);
    labels[2].set(V[2], "A2", 7, -9);
    labels[3].set(P, "P", 7, -9);
    for (let i = 0; i < handles.length; i++) handles[i].set(V[i]);
    pointHandle.set(P);

    if (chain.circles.length <= Core.PAIRS) {
      say("Move the corners apart to see the six circles.");
    } else {
      const choice = state.which === Core.ALL
        ? "All six circles are shown."
        : "Pair " + (state.which + 1) + " is highlighted: circles " + (state.which + 1) +
          " and " + (state.which + 2) + ".";
      const radii = chain.circles.slice(0, Core.PAIRS).map((c) => c.radius.toFixed(1)).join(", ");
      say(choice + " Circle 7 falls on circle 1, so the chain has at most six different circles. Radii: " + radii + ".");
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  for (const input of pairInputs) {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state = Core.setWhich(state, input.value);
      render();
    });
  }

  board.onTheme(() => render());
  render();
})();
