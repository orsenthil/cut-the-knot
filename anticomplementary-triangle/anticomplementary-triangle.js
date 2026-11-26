"use strict";

/*
 * The page for An Anticomplementary Triangle Surprise: drawing and input only.
 * The construction and the invariant live in anticomplementary-triangle-core.js.
 *
 * The stage holds one SVG. A, B and C are draggable, focusable handles; every
 * other point is rebuilt from them. The three checkboxes are the panel's own
 * "Show names", "first step" and "second step" options. Nothing is won or
 * lost here: the status line reports the midpoint and area invariant.
 */

(function () {
  const C = AnticomplementaryTriangleCore;
  const statusEl = document.getElementById("status");
  const toggles = {
    names: document.getElementById("namesCheck"),
    firstStep: document.getElementById("firstCheck"),
    secondStep: document.getElementById("secondCheck"),
  };
  const newBtn = document.getElementById("newBtn");

  let state = C.start({});

  /** The line under the picture. This illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const board = Geom.board(document.getElementById("board"));
  /* Layers are made in paint order, and every object is made once and then
     moved with .set(), so a handle keeps keyboard focus across a redraw. */
  const fills = board.layer("fills");
  const spokesLayer = board.layer("spokes");
  const triangles = board.layer("triangles");
  const steps = board.layer("steps");
  const dots = board.layer("dots");
  const text = board.layer("text");
  const tops = board.layer("handles");

  const abc = board.polygon([state.A, state.B, state.C], "tri-abc", fills);
  const spokes = Array.from({ length: 6 }, () => board.segment(state.A, state.B, "spoke", spokesLayer));
  const xyz = board.polygon([state.A, state.B, state.C], "tri-xyz", triangles);
  const pqr = board.polygon([state.A, state.B, state.C], "tri-pqr", triangles);
  const firstTris = Array.from({ length: 3 }, () => board.polygon([state.A, state.B, state.C], "step-first", steps));
  const secondTris = Array.from({ length: 3 }, () => board.polygon([state.A, state.B, state.C], "step-second", steps));
  const apexDots = ["X", "Y", "Z"].map(() => board.point(state.A, "apex-dot", 3.6, dots));
  const outerDots = ["P", "Q", "R"].map(() => board.point(state.A, "outer-dot", 4, dots));
  const midDots = ["A", "B", "C"].map(() => board.point(state.A, "mid-dot", 2.6, dots));

  const names = ["A", "B", "C", "X", "Y", "Z", "P", "Q", "R"];
  const labels = Object.fromEntries(names.map((n) => [n,
    board.label(state.A, n, "pt-label", 7, -7, text)]));
  const offsets = {
    A: [8, -9], B: [-17, 15], C: [8, -9],
    X: [7, -8], Y: [-18, 5], Z: [8, 14],
    P: [-18, 16], Q: [8, -8], R: [-18, -8],
  };

  const clamp = (p) => C.clampToBoard(p);
  const describe = (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down in the drawing`;
  const onMove = (p, name) => {
    state = C.moveVertex(state, name, p);
    render();
  };
  const handles = Object.fromEntries(["A", "B", "C"].map((n) => [n,
    board.handle(n, state[n], {
      r: 10, step: 5, layer: tops, clamp, describe, onMove,
      label: `Point ${n} of the starting triangle. Drag it, or focus it and use the arrow keys to move it.`,
    })]));

  function place(name, p) {
    const label = labels[name];
    label.show(Boolean(p));
    if (p) label.set(p, name, offsets[name][0], offsets[name][1]);
  }

  function render() {
    const g = C.geometry(state);
    say(C.label(g));

    abc.set([g.A, g.B, g.C]);
    xyz.set([g.X, g.Y, g.Z]);
    pqr.set([g.P, g.Q, g.R]);
    for (let i = 0; i < 6; i++) spokes[i].set(g.spokes[i][0], g.spokes[i][1]);
    for (let i = 0; i < 3; i++) {
      firstTris[i].set(g.firstStep[i]);
      secondTris[i].set(g.secondStep[i]);
      firstTris[i].show(state.options.firstStep);
      secondTris[i].show(state.options.secondStep);
      apexDots[i].set([g.X, g.Y, g.Z][i]);
      outerDots[i].set([g.P, g.Q, g.R][i]);
      midDots[i].set([g.A, g.B, g.C][i]);
    }
    const mids = C.midpoints(g);
    for (const n in labels) {
      place(n, state.options.names ? (mids[n] || g[n]) : null);
    }
    for (const n of ["A", "B", "C"]) handles[n].set(state[n]);

    for (const k in toggles) toggles[k].checked = state.options[k];

    // The position, for the player's record and the tutor (board units).
    if (window.Track) {
      window.Track.state({ A: state.A, B: state.B, C: state.C, options: state.options });
    }
  }

  for (const k in toggles) {
    toggles[k].addEventListener("change", () => {
      state = C.setOption(state, k, toggles[k].checked);
      render();
    });
  }

  newBtn.addEventListener("click", () => {
    state = C.randomStart();
    render();
  });

  board.onTheme(render);
  render();
})();
