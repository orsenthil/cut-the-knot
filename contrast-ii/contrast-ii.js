"use strict";

/*
 * The page for Contrast II: drawing and input only. The applet's own geometry
 * is in contrast-ii-core.js.
 *
 * The SVG shows the applet's flat field, an N by N grid of small squares and
 * an (N-1) by (N-1) grid of larger squares between them. All squares carry the
 * same class and therefore the same colour. A handle on the ruler under the
 * picture, the two sliders and the buttons all set the applet's N and Part
 * values; the checkbox swaps the two colours just as "Switch colors" does.
 * Nothing is won or lost: the status line reports the sizes and the claim.
 */

(function () {
  const Core = ContrastIiCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");

  const nInput = document.getElementById("nInput");
  const partInput = document.getElementById("partInput");
  const switchBtn = document.getElementById("switchBtn");
  const nOut = document.getElementById("nOut");
  const partOut = document.getElementById("partOut");
  const lessN = document.getElementById("lessN");
  const moreN = document.getElementById("moreN");
  const lessPart = document.getElementById("lessPart");
  const morePart = document.getElementById("morePart");
  const resetBtn = document.getElementById("resetBtn");

  const fieldLayer = board.layer("field");
  const squaresLayer = board.layer("squares");
  const rulerLayer = board.layer("ruler");
  const handlesLayer = board.layer("handles");

  const RULER_Y = 376;
  const RULER_X0 = 20;
  const RULER_X1 = 340;
  const partPoint = (part) => ({ x: RULER_X0 + ((RULER_X1 - RULER_X0) * part) / 100, y: RULER_Y });
  const partFromX = (x) => Core.clampPart(Math.round(((x - RULER_X0) * 100) / (RULER_X1 - RULER_X0)));

  /** A named SVG element with Geom's shape interface, for markup Geom omits. */
  function shapeEl(tag, cls, layer) {
    const node = board.el(tag, null, cls, layer);
    return {
      node: node,
      set: function (attrs) {
        for (const k in attrs) node.setAttribute(k, attrs[k]);
        return this;
      },
      show: function (on) { node.style.display = on ? "" : "none"; return this; },
    };
  }

  const field = shapeEl("rect", "field", fieldLayer);
  const frame = shapeEl("rect", "frame", fieldLayer);
  /* Every square, small or large, is the same class: no difference in colour. */
  const pool = [];
  for (let i = 0; i < Core.MAX_N * Core.MAX_N + (Core.MAX_N - 1) * (Core.MAX_N - 1); i++) {
    pool.push(shapeEl("rect", "sq", squaresLayer));
  }

  const rulerLine = board.segment({ x: RULER_X0, y: RULER_Y }, { x: RULER_X1, y: RULER_Y }, "ruler-line", rulerLayer);
  const ticks = [0, 25, 50, 75, 100].map((v) =>
    board.segment(partPoint(v), { x: partPoint(v).x, y: RULER_Y + 6 }, "ruler-tick", rulerLayer));
  const tickLabels = [0, 50, 100].map((v) =>
    board.label(partPoint(v), String(v), "ruler-label", 0, 21, rulerLayer));

  let state = Core.start();
  const seen = { backgrounds: new Set(), nearlyEqual: false };

  /**
   * `kind` is "done" once the player has switched the colours and found the
   * nearly equal setting; that is how the record learns the demo was
   * explored. There is no win or loss, so "win" and "lose" are never used.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const picture = Core.squares(state);
    const g = picture.layout;
    board.root.classList.toggle("switched", state.swapped);

    field.set({ x: 0, y: 0, width: state.width, height: state.height });
    frame.set({ x: 0.5, y: 0.5, width: state.width - 1, height: state.height - 1 });

    const rects = picture.small.concat(picture.big);
    pool.forEach((node, i) => {
      node.show(i < rects.length);
      if (i < rects.length) {
        const r = rects[i];
        node.set({ x: r.x, y: r.y, width: r.size, height: r.size });
      }
    });

    hPart.set(partPoint(state.part));
    rulerLine.set({ x: RULER_X0, y: RULER_Y }, { x: RULER_X1, y: RULER_Y });
    ticks.forEach((tick, i) => {
      const x = partPoint([0, 25, 50, 75, 100][i]).x;
      tick.set({ x: x, y: RULER_Y }, { x: x, y: RULER_Y + 6 });
    });
    tickLabels.forEach((label, i) => label.set(partPoint([0, 50, 100][i])));

    if (String(nInput.value) !== String(state.n)) nInput.value = String(state.n);
    if (String(partInput.value) !== String(state.part)) partInput.value = String(state.part);
    switchBtn.checked = state.swapped;
    nOut.textContent = String(state.n);
    partOut.textContent = `${state.part}%`;
    lessN.disabled = state.n <= Core.MIN_N;
    moreN.disabled = state.n >= Core.MAX_N;
    lessPart.disabled = state.part <= Core.MIN_PART;
    morePart.disabled = state.part >= Core.MAX_PART;
    lessN.setAttribute("aria-label", `Use fewer squares across, from ${state.n}`);
    moreN.setAttribute("aria-label", `Use more squares across, from ${state.n}`);
    lessPart.setAttribute("aria-label", `Fill less of each cell, from ${state.part} percent`);
    morePart.setAttribute("aria-label", `Fill more of each cell, from ${state.part} percent`);

    seen.backgrounds.add(state.swapped ? "switched" : "normal");
    if (g.small === g.bigSide || Math.abs(g.small - g.bigSide) === 1) seen.nearlyEqual = true;
    const explored = seen.backgrounds.size === 2 && seen.nearlyEqual;

    let text = `${state.n} by ${state.n} small squares of ${g.small} units, and ` +
      `${state.n - 1} by ${state.n - 1} big squares of ${g.bigSide} units. ` +
      `Every square is painted the same colour on a flat background.`;
    if (Math.abs(g.small - g.bigSide) <= 1) {
      text += " The two sizes are nearly equal: watch the edges for Kitaoka's waves.";
    } else if (g.small > g.bigSide) {
      text += " The small squares are larger; do they look brighter than the big ones?";
    } else {
      text += " The big squares are larger; do the small ones look darker?";
    }
    say(text, explored ? "done" : null);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function setOption(key, value) {
    state = Core.withOption(state, key, value);
    render();
  }

  const hPart = board.handle("Fill", partPoint(state.part), {
    r: 13,
    step: (RULER_X1 - RULER_X0) / 100,
    shift: 16,
    cls: "geom-handle fill-handle",
    layer: handlesLayer,
    label: "Fill handle. Drag along the ruler, or focus it and use the arrow keys, to set how much of each cell the squares fill, from 0 to 100 percent",
    describe: (q) => `at ${partFromX(q.x)} percent`,
    clamp: (q) => ({ x: Geom.clamp(q.x, RULER_X0, RULER_X1), y: RULER_Y }),
    onMove: (q) => setOption("part", partFromX(q.x)),
  });

  nInput.addEventListener("input", () => setOption("n", Number(nInput.value)));
  partInput.addEventListener("input", () => setOption("part", Number(partInput.value)));
  switchBtn.addEventListener("change", () => setOption("swapped", switchBtn.checked));
  lessN.addEventListener("click", () => setOption("n", state.n - 1));
  moreN.addEventListener("click", () => setOption("n", state.n + 1));
  lessPart.addEventListener("click", () => setOption("part", state.part - 1));
  morePart.addEventListener("click", () => setOption("part", state.part + 1));
  resetBtn.addEventListener("click", () => {
    state = Core.start({ width: state.width, height: state.height });
    render();
    hPart.node.focus();
  });
  document.addEventListener("keydown", (e) => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === "[" || k === ",") { e.preventDefault(); setOption("n", state.n - 1); }
    else if (k === "]" || k === ".") { e.preventDefault(); setOption("n", state.n + 1); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); setOption("part", state.part - 1); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); setOption("part", state.part + 1); }
    else if (k === "s") { e.preventDefault(); setOption("swapped", !state.swapped); }
    else if (k === "r") {
      e.preventDefault();
      state = Core.start({ width: state.width, height: state.height });
      render();
      hPart.node.focus();
    }
  });

  board.onTheme(render);
  render();
})();
