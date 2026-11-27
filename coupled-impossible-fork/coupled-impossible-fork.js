"use strict";

/*
 * Coupled Impossible Fork: drawing and input only. The geometry is in
 * coupled-impossible-fork-core.js. The board keeps the applet's 600 by 350
 * canvas as its viewBox: one seven-point Pi on the left, its half-turn image
 * on the right, and equal-length beams between them. A handle and a slider
 * both change W, the beam length; the button shows the edges the default
 * drawing masks. There is no win and no loss: this is an illustration.
 */

(() => {
  const Core = CoupledImpossibleForkCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const wRange = document.getElementById("wRange");
  const wOut = document.getElementById("wOut");
  const lessBtn = document.getElementById("lessBtn");

  let state = Core.start({});

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Paint order follows Draw(): skeleton, masked faces, revealed edges, beams,
     then labels and the one handle. Nodes are made once and only moved. */
  const guides = board.layer("guides");
  const skeletonLayer = board.layer("skeleton");
  const faceLayer = board.layer("faces");
  const detailLayer = board.layer("detail");
  const beamLayer = board.layer("beams");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const O = { x: 0, y: 0 };
  const skeletonLines = [];
  const detailLines = [];
  const beamLines = [];
  for (let i = 0; i < 10; i++) skeletonLines.push(board.segment(O, O, "frame-line skeleton", skeletonLayer));
  for (let i = 0; i < 12; i++) detailLines.push(board.segment(O, O, "frame-line detail", detailLayer));
  for (let i = 0; i < 12; i++) beamLines.push(board.segment(O, O, "frame-line beam", beamLayer));
  const faces = [];
  for (let i = 0; i < 2; i++) faces.push(board.polygon([], "cover-face", faceLayer));

  const guide = board.segment({ x: 70, y: 322 }, { x: 530, y: 322 }, "guide", guides);
  const leftLabel = board.label({ x: 92, y: 262 }, "left Pi", "small-label", 0, 0, labelLayer);
  const rightLabel = board.label({ x: 508, y: 92 }, "right Pi", "small-label", 0, 0, labelLayer);
  const meetDot = board.point(O, "meet-dot", 5, labelLayer);
  const meetLabel = board.label(O, "the joined ends", "small-label", 8, -10, labelLayer);

  /** W to the handle's x on the guide line at the bottom of the board. */
  const handleX = (w) => 70 + ((w - Core.W_MIN) / (Core.W_MAX - Core.W_MIN)) * 460;
  const wFromX = (x) => Core.W_MIN + ((x - 70) / 460) * (Core.W_MAX - Core.W_MIN);

  const wHandle = board.handle("beam length", { x: handleX(state.w), y: 322 }, {
    r: 14, step: 10, shift: 30, cls: "geom-handle", layer: handleLayer,
    label: "Beam length. Drag along the bottom line, or focus and use the left and right arrow keys, to join or separate the two Pi pieces",
    describe: () => `beam length ${state.w} of 500`,
    clamp: (q) => ({ x: Math.max(70, Math.min(530, q.x)), y: 322 }),
    onMove: (p) => {
      state = Core.setW(state, wFromX(p.x));
      render();
    },
  });

  function setLines(pool, wanted, cls) {
    wanted.forEach((l, i) => {
      const node = pool[i];
      if (!node) return;
      node.set(l.a, l.b);
      node.node.setAttribute("class", "frame-line " + cls + (cls === "detail" ? " " + l.kind : ""));
      node.show(true);
    });
    for (let i = wanted.length; i < pool.length; i++) pool[i].show(false);
  }

  function render() {
    const g = Core.geometry(state);

    setLines(skeletonLines, g.lines.filter((l) => l.kind === "skeleton"), "skeleton");
    setLines(detailLines, g.lines.filter((l) => l.kind === "outline" || l.kind === "detail"), "detail");
    setLines(beamLines, g.lines.filter((l) => l.kind === "beam"), "beam");

    g.faces.forEach((pts, i) => {
      if (faces[i]) {
        faces[i].set(pts);
        faces[i].show(true);
      }
    });
    for (let i = g.faces.length; i < faces.length; i++) faces[i].show(false);

    const joined = g.gap < 1e-6;
    const meeting = { x: (g.join.j23.x + g.join.j31.x) / 2, y: (g.join.j23.y + g.join.j31.y) / 2 };
    meetDot.set(meeting);
    meetDot.show(joined);
    meetLabel.set(meeting, "the joined ends");
    meetLabel.show(joined);

    wHandle.set({ x: handleX(g.w), y: 322 });
    wRange.value = String(g.w);
    wOut.textContent = String(g.w) + " / 500";
    lessBtn.textContent = g.lessReal ? "Hide the rear edges" : "Show the rear edges";
    lessBtn.setAttribute("aria-pressed", String(g.lessReal));

    say(Core.describe(state).text, null);
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  wRange.addEventListener("input", () => {
    state = Core.setW(state, Number(wRange.value));
    render();
  });
  lessBtn.addEventListener("click", () => {
    state = Core.toggleLessReal(state);
    render();
  });
  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state = Core.setW(state, btn.dataset.preset === "gap" ? Core.W_MIN : Core.W_MAX);
      render();
    });
  });
  document.getElementById("newBtn").addEventListener("click", () => {
    state = Core.start({});
    render();
  });

  board.onTheme(render);
  render();
})();
