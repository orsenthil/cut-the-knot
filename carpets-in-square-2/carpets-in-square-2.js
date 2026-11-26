"use strict";

/*
 * The page for Carpets In Square 2: drawing and input only; every point and
 * every claim comes from carpets-in-square-2-core.js. The SVG shows the two
 * overlapping rectangles EFGH and IFJH inside ABCD. With "hint" ticked the
 * blue quadrilateral is IFGH and four red triangles balance it; untick it to
 * see the six red corners against the blue overlap HKFL. Two Geom handles
 * move A along the bottom side and F along the right side, as in the applet;
 * the objects are made once and only re-set, so keyboard focus survives a
 * redraw. Nothing is won or lost — this is an illustration.
 */

(function () {
  const Core = CarpetsInSquare2Core;
  const board = Geom.board("board");
  const statusEl = document.getElementById("status");
  const hintBox = document.getElementById("hintBox");
  const namesBox = document.getElementById("namesBox");
  const resetBtn = document.getElementById("resetBtn");

  const fills = board.layer("fills");
  const guides = board.layer("guides");
  const edges = board.layer("edges");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  let state = Core.start();
  let g = Core.compute(state);

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  // Six red polygons are enough for either mode; the hint picture uses four.
  const reds = [0, 1, 2, 3, 4, 5].map((i) =>
    board.polygon(g.redNormal[i], "red region", fills));
  const blue = board.polygon(g.blueNormal, "blue region", fills);
  const square = board.polygon([g.A, g.B, g.C, g.D], "square", edges);

  // The eight sides of EFGH and IFJH. Draw() in the applet draws these after
  // the fills; the extra four thin lines belong to the hint picture.
  const innerEdges = [
    [g.E, g.F], [g.F, g.G], [g.G, g.H], [g.H, g.E],
    [g.I, g.F], [g.F, g.J], [g.J, g.H], [g.H, g.I],
  ].map(([p, q]) => board.segment(p, q, "inner-edge", edges));
  const guideEdges = [
    [g.I, g.G], [g.E, g.G], [g.I, g.J], [g.H, g.F],
  ].map(([p, q]) => board.segment(p, q, "guide", guides));

  const centerDot = board.point(g.O, "center-dot", 4, marks);
  const crossDots = ["K", "L"].map((name) =>
    board.point(g[name], "cross-dot", 3.5, marks));
  const endDots = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map((name) =>
    board.point(g[name], "end-dot", 2.6, marks));

  const offsets = {
    A: [-16, 18], B: [7, 18], C: [7, -8], D: [-16, -8],
    E: [-8, 18], F: [8, 4], G: [0, -9], H: [-17, 4], I: [-4, 18], J: [-4, -9],
    O: [7, -7], K: [7, -6], L: [7, 12],
  };
  const pointLabels = {};
  for (const name of Object.keys(offsets)) {
    pointLabels[name] = board.label(g[name], name, "point-label",
      offsets[name][0], offsets[name][1], labels);
  }

  const aHandle = board.handle("A", g.A, {
    r: 10, step: 3, shift: 12, layer: handles, cls: "geom-handle move-handle",
    label: "Point A at the bottom left of the rectangle. Drag it, or focus it and use the arrow keys, to make the rectangle wider or narrower",
    describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
    clamp: (q) => ({ x: Core.clamp(q.x, 6, Core.maxLeft(state)), y: state.bottom }),
    onMove: (p) => apply({ type: "point", name: "A", point: p }),
  });
  const fHandle = board.handle("F", g.F, {
    r: 10, step: 3, shift: 12, layer: handles, cls: "geom-handle slide-handle",
    label: "Point F on the right side. Drag it up or down, or focus it and use the arrow keys, to move the two rectangles",
    describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
    clamp: (q) => ({ x: state.right, y: Core.clamp(q.y, state.top, state.bottom) }),
    onMove: (p) => apply({ type: "point", name: "F", point: p }),
  });

  /** Redraw every object from the current core figure; no new SVG elements. */
  function draw() {
    const regions = state.hint ? g.redHint : g.redNormal;
    for (let i = 0; i < reds.length; i++) {
      const part = regions[i];
      reds[i].show(g.valid && !!part);
      if (part) reds[i].set(part);
    }
    blue.show(g.valid).set(state.hint ? g.blueHint : g.blueNormal);
    square.set([g.A, g.B, g.C, g.D]);

    const pairs = [[g.E, g.F], [g.F, g.G], [g.G, g.H], [g.H, g.E],
      [g.I, g.F], [g.F, g.J], [g.J, g.H], [g.H, g.I]];
    for (let i = 0; i < innerEdges.length; i++) {
      innerEdges[i].show(g.valid).set(pairs[i][0], pairs[i][1]);
    }
    for (let i = 0; i < guideEdges.length; i++) {
      guideEdges[i].show(g.valid && state.hint).set(
        [[g.I, g.G], [g.E, g.G], [g.I, g.J], [g.H, g.F]][i][0],
        [[g.I, g.G], [g.E, g.G], [g.I, g.J], [g.H, g.F]][i][1]);
    }

    centerDot.show(g.valid && state.hint && state.showNames).set(g.O);
    for (let i = 0; i < crossDots.length; i++) {
      const name = ["K", "L"][i];
      crossDots[i].show(g.valid && !state.hint &&
        Math.hypot(g.C.x - g[name].x, g.C.y - g[name].y) > 10 &&
        Math.hypot(g.D.x - g[name].x, g.D.y - g[name].y) > 10).set(g[name]);
    }
    const ends = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    for (let i = 0; i < ends.length; i++) endDots[i].show(g.valid).set(g[ends[i]]);

    for (const name of Object.keys(pointLabels)) {
      let show = g.valid && state.showNames;
      if (name === "O") show = show && state.hint;
      if (name === "K" || name === "L") show = show && !state.hint &&
        Math.hypot(g.C.x - g[name].x, g.C.y - g[name].y) > 10 &&
        Math.hypot(g.D.x - g[name].x, g.D.y - g[name].y) > 10;
      pointLabels[name].show(show).set(g[name]);
    }
    aHandle.show(true).set(g.A);
    fHandle.set(g.F);
  }

  /** Redraw, speak the picture and save the position for the record and tutor. */
  function render() {
    g = Core.compute(state);
    draw();
    say(Core.describe(state), state.explored ? "done" : null);
    if (window.Track) window.Track.state(state);
  }

  function apply(m) {
    const next = Core.move(state, m);
    if (!next) {
      render();
      return false;
    }
    state = next;
    render();
    return true;
  }

  hintBox.addEventListener("change", () =>
    apply({ type: "option", key: "hint", value: hintBox.checked }));
  namesBox.addEventListener("change", () =>
    apply({ type: "option", key: "showNames", value: namesBox.checked }));
  resetBtn.addEventListener("click", () => {
    apply({ type: "reset" });
    hintBox.checked = state.hint;
    namesBox.checked = state.showNames;
  });

  // Classes are styled with CSS tokens, so a theme flip needs no new colours.
  board.onTheme(() => draw());

  hintBox.checked = state.hint;
  namesBox.checked = state.showNames;
  render();
})();
