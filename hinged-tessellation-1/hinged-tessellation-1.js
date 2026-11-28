"use strict";

/*
 * A Semi-regular Tessellation on Hinges A — drawing and input only. The
 * applet's geometry, option ranges and restraints live in
 * hinged-tessellation-1-core.js.
 *
 * The stage is one SVG with the applet's 640 x 460 viewBox. Its layers hold
 * the translucent triangles, the black hinge lines, the two guide loci that
 * the handles slide along, point names, and finally the three focusable
 * handles. Shapes are made once and updated on every redraw so a dragged
 * handle keeps keyboard focus. No shape has a win or a loss: this is an
 * illustration, and the status says which of the page's two arrangements is
 * shown.
 */

(function () {
  const Core = HingedTessellation1Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const layersInput = document.getElementById("layers");
  const layersOut = document.getElementById("layersOut");
  const modeButtons = [
    document.getElementById("modeOne"),
    document.getElementById("modeTwo"),
    document.getElementById("modeBands"),
  ];
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Back to front: translucent tiles, their edges, guides, names, handles. */
  const fills = board.layer("fills");
  const edges = board.layer("edges");
  const guides = board.layer("guides");
  const texts = board.layer("texts");
  const top = board.layer("handles");

  const guideCircle = board.circle(state.B, Core.dist(state.B, state.C), "guide-circle", guides);
  const guideLine = board.line(state.A, state.C, "guide-line", guides);
  const names = ["A", "B", "C", "D"].map((k) => board.label(state.A, k, "point-label", 11, -10, texts));
  const fillPool = [], edgePool = [];

  const handle = (name) => board.handle(name, state[name], {
    r: 13, step: 5, shift: 15, layer: top,
    label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it along its guide.`,
    clamp: (p, which) => Core.constrained(state, which, p) || p,
    onMove: (p, which) => {
      state = Core.move(state, which, p);
      render();
    },
  });
  const handles = { A: handle("A"), B: handle("B"), C: handle("C") };

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function fillClass(color) {
    if (state.options.mode === 2) return "band band-" + (color % 10);
    return color === 1 ? "tile-b" : "tile-a";
  }

  function render() {
    for (const name of ["A", "B", "C"]) handles[name].set(state[name]);
    layersOut.textContent = String(state.options.layers);
    modeButtons.forEach((btn, i) => btn.setAttribute("aria-pressed", String(i === state.options.mode)));

    const drawn = Core.geometry(state);
    guideCircle.show(true).set(state.B, Core.dist(state.B, state.C));
    const mid = Core.midpoint(state.A, state.C);
    const perp = Core.constrained({ A: state.A, B: state.B, C: state.C }, "B",
      { x: mid.x - (state.C.y - state.A.y), y: mid.y + (state.C.x - state.A.x) });
    guideLine.show(!!perp).set(mid, perp || mid);

    let fi = 0, ei = 0;
    for (const tile of drawn.drawn) {
      for (const tri of tile.triangles) {
        if (!fillPool[fi]) fillPool[fi] = board.polygon([state.A, state.B, state.C], "tile-a", fills);
        fillPool[fi].show(true).set(tri.pts);
        fillPool[fi].node.setAttribute("class", fillClass(tri.color));
        fi++;
      }
      for (const line of tile.lines) {
        if (!edgePool[ei]) edgePool[ei] = board.segment(state.A, state.B, "edge", edges);
        edgePool[ei].show(true).set(line[0], line[1]);
        ei++;
      }
    }
    for (let k = fi; k < fillPool.length; k++) fillPool[k].show(false);
    for (let k = ei; k < edgePool.length; k++) edgePool[k].show(false);

    ["A", "B", "C", "D"].forEach((name, i) => {
      names[i].show(name !== "D").set(state[name], name);
    });

    say(Core.describe(state), state.explored ? "done" : null);
    // Board units, not screen pixels, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: state.A, B: state.B, C: state.C, D: state.D,
        options: Object.assign({}, state.options),
        step: drawn.v, rowStep: drawn.w,
        tilesDrawn: drawn.drawn.length, tilesTotal: drawn.total,
        measures: Core.measures(state),
      });
    }
  }

  layersInput.addEventListener("input", () => {
    state = Core.setOption(state, "layers", Number(layersInput.value));
    render();
  });
  modeButtons.forEach((btn, i) => btn.addEventListener("click", () => {
    state = Core.setOption(state, "mode", i);
    render();
  }));

  function newDiagram() {
    state = Core.reset(state);
    layersInput.value = String(state.options.layers);
    render();
  }
  resetBtn.addEventListener("click", newDiagram);
  document.addEventListener("keydown", (e) => {
    if ((e.key === "r" || e.key === "R") && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
      newDiagram();
    }
  });

  board.onTheme(render);
  render();
})();
