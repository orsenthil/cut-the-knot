"use strict";

/*
 * The page for Contrast: drawing and input only. All the numbers come from
 * contrast-core.js, which re-creates ContrastCanvas.Draw. A 500 x 300 SVG
 * board holds a piecewise-constant gradient like the applet's painted lines
 * and the two bars of one gray. The five range inputs are the applet's five
 * scrollbars; the extra probe dot reads the gray under it without changing
 * the picture. Drag the dot, or focus it and use the arrow keys.
 */

(function () {
  const Core = ContrastCore;
  const W = Core.BOARD.width;
  const H = Core.BOARD.height;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const sliders = {};
  const readouts = {};

  for (const key of Core.OPTIONS) {
    sliders[key] = document.getElementById(key);
    readouts[key] = document.getElementById(key + "Out");
  }

  const board = Geom.board(document.getElementById("board"));
  const defs = board.el("defs");
  const clip = board.el("clipPath", { id: "contrast-clip" }, null, defs);
  board.el("rect", { x: 0, y: 0, width: W, height: H }, null, clip);
  const gradient = board.el("linearGradient", {
    id: "contrast-gradient",
    gradientUnits: "userSpaceOnUse",
    x1: 0, y1: 0, x2: W, y2: 0,
  }, null, defs);

  const background = board.layer("background");
  const bgRect = board.el("rect", { x: 0, y: 0, width: W, height: H }, "gradient-bg", background);
  bgRect.setAttribute("fill", "url(#contrast-gradient)");

  const barsLayer = board.layer("bars");
  barsLayer.setAttribute("clip-path", "url(#contrast-clip)");
  const guides = board.layer("guides");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const frame = board.el("rect", { x: 0.5, y: 0.5, width: W - 1, height: H - 1 }, "frame", guides);
  const probeLine = board.line({ x: 250, y: 0 }, { x: 250, y: H }, "probe-line", guides);
  const probeLabel = board.label({ x: 250, y: H - 10 }, "probe", "probe-label", 9, -8, labels);

  // The two bars are made once and only their points and gray change, so a
  // focused handle keeps its focus across every redraw.
  const barShapes = [0, 1].map(() => board.polygon(
    [{ x: 0, y: 0 }, { x: 0, y: 0 }], "bar", barsLayer,
  ));

  let state = { ...Core.start(), probe: { x: 250, y: H - 10 } };

  /**
   * Shows a line under the picture. `kind` is "win", "lose", "done" or
   * nothing; those classes are how the player's record sees a play end. This
   * is an illustration with no win or loss, so no kind is ever passed.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** Painted columns become hard-edged stops, exactly one gray per column. */
  function paintGradient(cols) {
    while (gradient.firstChild) gradient.removeChild(gradient.firstChild);
    if (!cols.length) return;
    const first = Core.gray(cols[0].index).css;
    board.el("stop", { offset: 0, "stop-color": first }, null, gradient);
    for (const col of cols) {
      const colour = Core.gray(col.index).css;
      board.el("stop", { offset: col.x / W, "stop-color": colour }, null, gradient);
      board.el("stop", { offset: (col.x + 1) / W, "stop-color": colour }, null, gradient);
    }
    const last = Core.gray(cols[cols.length - 1].index).css;
    board.el("stop", { offset: 1, "stop-color": last }, null, gradient);
  }

  function rectPoints(p) {
    return [
      { x: p.x, y: p.y },
      { x: p.x + p.w, y: p.y },
      { x: p.x + p.w, y: p.y + p.h },
      { x: p.x, y: p.y + p.h },
    ];
  }

  function render() {
    const f = Core.compute(state);
    paintGradient(f.columns);

    for (let i = 0; i < barShapes.length; i++) {
      const piece = f.pieces[i];
      barShapes[i].set(rectPoints(piece));
      barShapes[i].node.setAttribute("fill", Core.gray(piece.index).css);
    }

    const at = state.probe;
    probeLine.set({ x: at.x, y: 0 }, { x: at.x, y: H });
    probeLabel.set(at, "probe", 9, -8);
    probe.set(at);

    for (const key of Core.OPTIONS) {
      sliders[key].value = String(state[key]);
      readouts[key].textContent = String(state[key]);
    }

    say(Core.describe(state, f, at));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const probe = board.handle("Probe", state.probe, {
    r: 8,
    step: 5,
    shift: 25,
    cls: "geom-handle probe-handle",
    label: "Probe dot. Drag it, or focus it and use the arrow keys to read the gray behind it.",
    describe: (p) => `at ${Math.round(p.x)}, background gray ${Core.grayAt(state, p.x).index}`,
    clamp: (p) => ({ x: Geom.clamp(p.x, 0, W), y: H - 10 }),
    layer: handlesLayer,
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

  resetBtn.addEventListener("click", () => {
    state = { ...Core.start(), probe: { ...state.probe } };
    render();
  });

  // A theme flip changes only CSS here, but re-running render also refreshes
  // the spoken position and the saved state for the tutor.
  board.onTheme(render);

  frame.setAttribute("x", 0.5);
  render();
})();
