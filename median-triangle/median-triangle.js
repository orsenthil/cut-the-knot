"use strict";

/*
 * The page for Median Triangle: drawing and input only. The construction and
 * the area invariant live in median-triangle-core.js.
 *
 * The stage holds one SVG. A, B and C are draggable, focusable handles;
 * everything else is rebuilt from them. The pink triangles are the four
 * quarter-area pieces the applet fills, the red lines are the medians, and
 * the blue triangle has the three medians as its sides. The two checkboxes
 * are the applet's own "names" and "hint" options. Nothing is won or lost:
 * the status line reports the area share, which stays at 75%.
 */

(function () {
  const C = MedianTriangleCore;
  const statusEl = document.getElementById("status");
  const namesCheck = document.getElementById("namesCheck");
  const hintCheck = document.getElementById("hintCheck");
  const newBtn = document.getElementById("newBtn");

  let state = C.start({});

  /** The line under the picture. This illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const board = Geom.board(document.getElementById("board"));
  /* Layers are created in paint order. Every shape is created once and then
     moved with .set(), so the keyboard focus on a handle survives a redraw. */
  const fills = board.layer("fills");
  const lines = board.layer("lines");
  const hints = board.layer("hints");
  const dots = board.layer("dots");
  const text = board.layer("text");
  const tops = board.layer("handles");

  const corners = Array.from({ length: 3 }, () => board.polygon([state.A, state.B, state.C], "pink-corner", fills));
  const middle = board.polygon([state.A, state.B, state.C], "pink-middle", fills);
  const blue = board.polygon([state.A, state.B, state.C], "median-tri", fills);
  const abc = board.polygon([state.A, state.B, state.C], "tri-abc", lines);
  const medianLines = Array.from({ length: 3 }, () => board.segment(state.A, state.B, "median-line", lines));
  const paraLines = [board.segment(state.A, state.B, "para-line", lines),
    board.segment(state.A, state.B, "para-line", lines)];
  const hintLines = Array.from({ length: 6 }, () => board.segment(state.A, state.B, "hint-line", hints));
  const midDots = Array.from({ length: 3 }, () => board.point(state.A, "mid-dot", 4, dots));
  const outerDots = Array.from({ length: 3 }, () => board.point(state.A, "outer-dot", 4.5, dots));

  const names = ["A", "B", "C", "Ma", "Mb", "Mc", "D", "E", "F"];
  const labels = Object.fromEntries(names.map((n) => [n,
    board.label(state.A, n, "pt-label", 8, -8, text)]));
  const offsets = {
    A: [-18, 20], B: [8, 20], C: [-8, -12],
    Ma: [8, -8], Mb: [-30, -8], Mc: [-8, 20],
    D: [8, -8], E: [8, -8], F: [8, 16],
  };

  const clamp = (p) => C.clampToBoard(p);
  const describe = (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down in the drawing`;
  const onMove = (p, name) => {
    state = C.moveVertex(state, name, p);
    render();
  };
  const handles = Object.fromEntries(["A", "B", "C"].map((n) => [n,
    board.handle(n, state[n], {
      r: 14, step: 5, layer: tops, clamp, describe, onMove,
      label: `Point ${n} of triangle ABC. Drag it, or focus it and use the arrow keys to move it`,
    })]));

  function place(name, p) {
    labels[name].show(Boolean(p));
    if (p) labels[name].set(p, name, offsets[name][0], offsets[name][1]);
  }

  function render() {
    const g = C.geometry(state);
    say(C.label(g));

    abc.set([g.A, g.B, g.C]);
    for (let i = 0; i < 3; i++) {
      corners[i].set(g.cornerTriangles[i]);
      medianLines[i].set(...g.medians[i]);
      midDots[i].set([g.Am, g.Bm, g.Cm][i]);
      outerDots[i].set([g.D, g.E, g.F][i]);
    }
    middle.set(g.centerTriangle);
    blue.set(g.medianTriangle);
    paraLines[0].set(g.B, g.D);
    paraLines[1].set(g.C, g.D);
    for (let i = 0; i < 6; i++) {
      hintLines[i].set(...g.hintPairs[i]);
      hintLines[i].show(state.options.hint);
      hintLines[i].node.setAttribute("class", `hint-line hint-${Math.floor(i / 2) + 1}`);
    }

    const shown = {
      A: g.A, B: g.B, C: g.C,
      Ma: g.Am, Mb: g.Bm, Mc: g.Cm,
      D: g.D, E: g.E, F: g.F,
    };
    for (const n of names) place(n, state.options.names ? shown[n] : null);
    for (const n of ["A", "B", "C"]) handles[n].set(state[n]);

    namesCheck.checked = state.options.names;
    hintCheck.checked = state.options.hint;

    // The position, for the player's record and the tutor (board units).
    if (window.Track) {
      window.Track.state({ A: state.A, B: state.B, C: state.C, options: state.options });
    }
  }

  namesCheck.addEventListener("change", () => {
    state = C.setOption(state, "names", namesCheck.checked);
    render();
  });
  hintCheck.addEventListener("change", () => {
    state = C.setOption(state, "hint", hintCheck.checked);
    render();
  });
  newBtn.addEventListener("click", () => {
    state = C.randomStart();
    render();
  });

  board.onTheme(render);
  render();
})();
