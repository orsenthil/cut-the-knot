"use strict";

/*
 * The page for Judd Illusion: drawing and input only. Every drawing number
 * comes from judd-illusion-core.js, which re-creates the applet's Draw, Arrow
 * and Bob methods. A 500 x 300 SVG holds the bar, its four end strokes and
 * the middle mark; the five range inputs are the applet's five scrollbars and
 * the checkbox is its (unlabelled) Bob checkbox. The extra probe dot can be
 * dragged or nudged with the arrow keys so a player can measure the halves.
 */

(function () {
  const Core = JuddIllusionCore;
  const W = Core.BOARD.width;
  const H = Core.BOARD.height;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const bobEl = document.getElementById("bob");
  const sliders = {};
  const readouts = {};

  for (const key of Core.OPTIONS) {
    sliders[key] = document.getElementById(key);
    readouts[key] = document.getElementById(key + "Out");
  }

  const board = Geom.board(document.getElementById("board"));
  const shapes = board.layer("shapes");
  const handles = board.layer("handles");

  const bar = board.polygon([
    { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },
  ], "bar", shapes);
  const strokes = [];

  let state = Core.start();

  /** Shows a line under the picture. This illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function strokeAt(i) {
    if (!strokes[i]) strokes[i] = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "arrow-stroke", shapes);
    return strokes[i];
  }

  /** Repaint everything from the position; the only place that speaks. */
  function render() {
    const f = Core.geometry(state, W, H);
    const r = f.bar;
    bar.set([
      { x: r.x, y: r.y }, { x: r.x + r.width, y: r.y },
      { x: r.x + r.width, y: r.y + r.height }, { x: r.x, y: r.y + r.height },
    ]);

    for (let i = 0; i < strokes.length; i++) strokes[i].show(false);
    f.lines.forEach((ln, i) => {
      const shape = strokeAt(i);
      shape.set({ x: ln.x1, y: ln.y1 }, { x: ln.x2, y: ln.y2 });
      shape.node.setAttribute("class", i < 4 * state.B ? "arrow-stroke" : "mark-stroke");
      shape.show(true);
    });

    probe.set(state.probe);
    for (const key of Core.OPTIONS) {
      sliders[key].value = String(state[key]);
      readouts[key].textContent = String(state[key]);
    }
    bobEl.checked = state.bob;

    say(Core.describe(state, f, state.probe));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const probe = board.handle("probe", state.probe, {
    r: 8,
    step: 5,
    shift: 20,
    layer: handles,
    label: "Probe dot. Drag it along the bottom, or focus it and use the arrow keys to read the two halves of the bar",
    describe: (p) => `probe at x ${Math.round(p.x)} of ${W}`,
    clamp: (p) => ({ x: Geom.clamp(p.x, 0, W), y: H - 10 }),
    onMove: (p) => {
      state = { ...state, probe: { x: p.x, y: p.y } };
      render();
    },
  });

  for (const key of Core.OPTIONS) {
    sliders[key].addEventListener("input", () => {
      state = Core.option(state, key, sliders[key].value);
      render();
    });
  }
  bobEl.addEventListener("change", () => {
    state = Core.option(state, "bob", bobEl.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start();
    render();
  });

  // A theme flip changes only CSS here, but redraw through the same path.
  board.onTheme(render);

  render();
})();
