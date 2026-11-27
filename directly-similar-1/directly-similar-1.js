"use strict";

/*
 * The page for Directly Similar 1: drawing and input only. All the geometry
 * (the two squares from opposite corners and the translated third square)
 * lives in directly-similar-1-core.js. The stage is a 500 by 500 SVG board,
 * matching the old applet's canvas; five focusable Geom handles move the two
 * opposite corners of each given square and the point P. Nothing is won here.
 */

(function () {
  const Core = DirectlySimilar1Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const newBtn = document.getElementById("newBtn");

  let state = Core.start({});
  let showNames = false; /* the Java canvas read "show" but never drew names */

  /**
   * Shows the line under the board. `kind` is "win", "lose", "done" or nothing;
   * those three classes tell the player's record that a play has ended. This
   * is an illustration, so no kind is ever passed.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Paint order: coloured links, the squares, labels, then the five dots. */
  const linkLayer = board.layer("links");
  const squareLayer = board.layer("squares");
  const markLayer = board.layer("marks");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const givenA = board.polygon(state.points, "given-square", squareLayer);
  const givenB = board.polygon(state.points, "given-square", squareLayer);
  const made = board.polygon(state.points, "new-square", squareLayer);
  const connectors = [0, 1, 2, 3].map((k) =>
    board.segment(state.points[0], state.points[1], `link link-${k}`, linkLayer));
  const translated = [0, 1, 2, 3].map((k) =>
    board.segment(state.points[4], state.points[4], `link link-${k}`, linkLayer));
  const pDot = board.point(state.points[4], "p-dot", 6, markLayer);

  const names = ["A1", "B1", "C1", "D1"];
  const newLabels = names.map((text) => board.label(state.points[4], text, "pt-label", 9, -9, labelLayer));
  const handleLabels = Core.NAMES.map((text, i) =>
    board.label(state.points[i], text, "pt-label", -12, -11, labelLayer));

  const clamp = (v) => Geom.clamp(v, 16, 484);
  const handles = Core.NAMES.map((name, i) => board.handle(name, state.points[i], {
    r: 16,
    step: 5,
    shift: 4,
    cls: "geom-handle",
    layer: handleLayer,
    label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it.`,
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    clamp: (p) => ({ x: clamp(p.x), y: clamp(p.y) }),
    onMove: (p) => {
      state = Core.movePoint(state, i, p);
      render();
    },
  }));

  function render() {
    const f = Core.figures(state);
    givenA.set(f.first);
    givenB.set(f.second);
    made.set(f.third);
    for (let k = 0; k < 4; k++) {
      connectors[k].set(f.first[k], f.second[k]);
      translated[k].set(state.points[4], f.third[k]);
    }
    pDot.set(state.points[4]);
    handles.forEach((h, i) => h.set(state.points[i]));
    handleLabels.forEach((l, i) => l.set(state.points[i], Core.NAMES[i]));
    newLabels.forEach((l, k) => l.set(f.third[k], names[k]));
    [handleLabels, newLabels].forEach((group) => group.forEach((l) => l.show(showNames)));
    namesBox.checked = showNames;
    say(Core.describe(state));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  newBtn.addEventListener("click", () => {
    state = Core.start({});
    render();
  });
  namesBox.addEventListener("change", () => {
    showNames = namesBox.checked;
    render();
  });

  board.onTheme(render);
  render();
})();
