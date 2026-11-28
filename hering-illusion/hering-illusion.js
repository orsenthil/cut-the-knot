"use strict";

/*
 * The page for Hering Illusion: drawing and input only. The three scrollbars
 * of the applet become three range inputs here; the fan of rays and the two
 * blue bundles come straight from HeringIllusionCore.layout(). A single
 * focusable dot on the top bundle can also be dragged (or moved with the
 * arrow keys) to change the gap, which is the applet's Diff scrollbar.
 */

(function () {
  const Core = HeringIllusionCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const nInput = document.getElementById("n");
  const diffInput = document.getElementById("diff");
  const widthInput = document.getElementById("width");
  const nVal = document.getElementById("nVal");
  const diffVal = document.getElementById("diffVal");
  const widthVal = document.getElementById("widthVal");

  /* The SVG viewBox is the applet's canvas: its coordinates are the core's
     coordinates, so no translation or scaling happens in the drawing code. */
  const CANVAS = { width: 480, height: 300 };
  const rayLayer = board.layer("rays");
  const bandLayer = board.layer("bands");
  const guideLayer = board.layer("guides");
  const handleLayer = board.layer("handles");
  const rayNodes = [];
  const topNodes = [];
  const bottomNodes = [];

  let state = Core.start();

  /** Status text only: this is an illustration, so never a win or a loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function draw() {
    const L = Core.layout(state, CANVAS);
    for (let i = 0; i < L.rays.length; i++) {
      const r = L.rays[i];
      if (!rayNodes[i]) {
        rayNodes[i] = board.line({ x: r.x1, y: r.y1 }, { x: r.x2, y: r.y2 }, "ray", rayLayer);
      }
      rayNodes[i].set({ x: r.x1, y: r.y1 }, { x: r.x2, y: r.y2 }).show(true);
    }
    for (let i = L.rays.length; i < rayNodes.length; i++) rayNodes[i].show(false);
    for (let i = 0; i < L.top.length; i++) {
      const t = L.top[i], b = L.bottom[i];
      if (!topNodes[i]) {
        topNodes[i] = board.segment({ x: t.x1, y: t.y1 }, { x: t.x2, y: t.y2 }, "band", bandLayer);
        bottomNodes[i] = board.segment({ x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 }, "band", bandLayer);
      }
      topNodes[i].set({ x: t.x1, y: t.y1 }, { x: t.x2, y: t.y2 }).show(true);
      bottomNodes[i].set({ x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 }).show(true);
    }
    for (let i = L.top.length; i < topNodes.length; i++) {
      topNodes[i].show(false);
      bottomNodes[i].show(false);
    }
    return L;
  }

  const gapHandle = board.handle("Blue band", Core.handlePoint(state, CANVAS), {
    r: 9, step: 4, shift: 16, layer: handleLayer,
    cls: "geom-handle band-handle",
    label: "Blue band. Drag it up or down, or focus it and use the arrow keys, to move the two blue bands apart or together.",
    describe: (p) => `Band ${Math.round(p.y)} of ${CANVAS.height}. The gap is ${Core.diffFromY(p.y, CANVAS)} units.`,
    clamp: (p) => ({ x: CANVAS.width - 24, y: Geom.clamp(p.y, 0, CANVAS.height) }),
    onMove: (p) => {
      state = Core.withSetting(state, "diff", Core.diffFromY(p.y, CANVAS));
      render();
    },
  });

  function render() {
    const L = draw();
    const cl = Core.claims(state, CANVAS);
    gapHandle.set(Core.handlePoint(state, CANVAS));
    nInput.value = String(state.n);
    diffInput.value = String(state.diff);
    widthInput.value = String(state.width);
    nVal.textContent = String(state.n);
    diffVal.textContent = String(state.diff);
    widthVal.textContent = String(state.width);
    say(`${L.counts.rays} straight rays cross the middle. The blue bands have ${L.counts.top} lines each and are ${cl.bandGap} units apart. Every line is really straight — the bend is in your eyes.`);
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function reset() {
    state = Core.start();
    render();
    gapHandle.node.focus();
  }

  nInput.addEventListener("input", () => {
    state = Core.withSetting(state, "n", nInput.value);
    render();
  });
  diffInput.addEventListener("input", () => {
    state = Core.withSetting(state, "diff", diffInput.value);
    render();
  });
  widthInput.addEventListener("input", () => {
    state = Core.withSetting(state, "width", widthInput.value);
    render();
  });
  newBtn.addEventListener("click", reset);
  document.addEventListener("keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if ((e.key === "r" || e.key === "R") && tag !== "INPUT" && tag !== "SELECT") reset();
  });

  /* The SVG classes use site tokens; a theme flip only needs a fresh redraw
     for ports that compute colours, but the shared hook keeps it in sync. */
  board.onTheme(render);
  render();
})();
