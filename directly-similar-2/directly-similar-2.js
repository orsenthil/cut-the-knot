"use strict";

/*
 * The page for Directly Similar 2: drawing and input only. The geometry -
 * completing C' from the angles of ABC and translating each vertex by its
 * step to A' - lives in directly-similar-2-core.js.
 *
 * A 500 by 500 SVG holds the two given triangles, the matching coloured
 * links, and the new triangle at P. Six focusable Geom handles move A, B, C,
 * A', B' and P; C' is rebuilt by the core. The "Show hint" box marks matching
 * angles and links, as the applet's checkbox did. Nothing is won or lost.
 */

(function () {
  const Core = DirectlySimilar2Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");

  let state = Core.start({});
  let showNames = false;
  let showHint = false;

  /**
   * Shows a line under the board. `kind` is "win", "lose", "done" or nothing;
   * those three classes tell the player's record that a play ended. This is
   * an illustration, so no kind is ever passed here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Paint order: links, the three triangles, hint arcs, labels, then dots. */
  const linkLayer = board.layer("links");
  const shapeLayer = board.layer("shapes");
  const angleLayer = board.layer("angles");
  const markLayer = board.layer("marks");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const given = board.polygon(state.points.slice(0, 3), "triangle given", shapeLayer);
  const primed = board.polygon(state.points.slice(3, 6), "triangle primed", shapeLayer);
  const made = board.polygon(state.points.slice(0, 3), "triangle made", shapeLayer);

  const links = [0, 1, 2].map((k) =>
    board.segment(state.points[k], state.points[k + 3], `match match-${k}`, linkLayer));
  const fromP = [0, 1, 2].map((k) =>
    board.segment(state.points[5], state.points[5], `from-p match-${k}`, linkLayer));

  /* The old ShowHint marked the corner angles of all three triangles and
   * put matching marks on the corresponding pair of links. */
  const arcRadius = [26, 21, 16];
  const arcs = [0, 1, 2].map((tri) => [0, 1, 2].map((k) => board.angleArc(
    state.points[0], state.points[1], state.points[2], arcRadius[k],
    `hint-arc arc-${k}`, angleLayer)));

  const pDot = board.point(state.points[5], "p-dot", 7, markLayer);
  const fDot = board.point(state.points[3], "f-dot", 5, markLayer);

  const names = ["A", "B", "C", "A\u2032", "B\u2032", "C\u2032", "A\u2081", "B\u2081", "C\u2081", "P"];
  const labelOffsets = [
    [-16, -12], [6, -12], [-16, 24], [-18, -12], [6, -12], [-18, 24],
    [-20, -12], [6, -12], [6, 22], [8, 26],
  ];
  const labels = names.map((text, i) => board.label(
    state.points[Math.min(i, 5)], text, "pt-label", labelOffsets[i][0], labelOffsets[i][1], labelLayer));

  const clamp = (p) => ({ x: Geom.clamp(p.x, 16, 484), y: Geom.clamp(p.y, 16, 484) });
  const handles = Core.NAMES.map((name, i) => board.handle(name, state.points[i], {
    r: 15,
    step: 5,
    shift: 4,
    cls: "geom-handle",
    layer: handleLayer,
    label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it.`,
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    clamp: clamp,
    onMove: (p) => {
      state = Core.movePoint(state, i, p);
      render();
    },
  }));

  function setArcs(triPoints, index) {
    for (let k = 0; k < 3; k++) {
      const a = triPoints[k], b = triPoints[(k + 1) % 3], c = triPoints[(k + 2) % 3];
      arcs[index][k].set(a, b, c, arcRadius[k]);
      arcs[index][k].show(showHint);
    }
  }

  function render() {
    const f = Core.figures(state);
    const alive = Boolean(f.third);

    given.set(f.abc);
    made.show(alive);
    primed.show(alive);
    fDot.show(alive);
    if (alive) {
      made.set(f.third);
      primed.set(f.primed);
      fDot.set(f.f);
    }

    for (let k = 0; k < 3; k++) {
      links[k].set(state.points[k], state.points[k + 3]);
      links[k].node.classList.toggle("marked", showHint);
      fromP[k].show(alive);
      fromP[k].node.classList.toggle("marked", showHint);
      if (alive) fromP[k].set(state.points[5], f.third[k]);
    }

    const all = [f.abc, f.primed || f.abc, f.third || f.abc];
    for (let t = 0; t < 3; t++) {
      setArcs(all[t], t);
      if (!alive && t > 0) arcs[t].forEach((a) => a.show(false));
    }

    pDot.set(state.points[5]);
    handles.forEach((h, i) => h.set(state.points[i]));
    labels.forEach((l, i) => {
      const pt = i < 6 ? state.points[i] : i === 9 ? state.points[5] : (f.third || f.abc)[i - 6];
      l.set(pt);
      l.show(showNames && (alive || i < 6 || i === 9));
    });
    namesBox.checked = showNames;
    hintBox.checked = showHint;

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
  hintBox.addEventListener("change", () => {
    showHint = hintBox.checked;
    render();
  });

  board.onTheme(render);
  render();
})();
