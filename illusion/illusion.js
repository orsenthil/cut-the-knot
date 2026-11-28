"use strict";

/*
 * Browser UI for Illusion: drawing and input only. The picture's geometry and
 * the applet's four scrollbar ranges live in illusion-core.js.
 *
 * The SVG shows the applet's two families of straight lines: slanted
 * transversals first, then the vertical bars that hide pieces of them. Two
 * focusable dots change the slant and the gap between slanted lines; four
 * labelled sliders set all the applet's options. "Lift the bars" draws them
 * as outlines so the hidden parts can be seen. There is nothing to win.
 */

(() => {
  const Core = IllusionCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const revealBtn = document.getElementById("revealBtn");
  const inputs = {
    dist: document.getElementById("distRange"),
    angle: document.getElementById("angleRange"),
    space: document.getElementById("spaceRange"),
    width: document.getElementById("widthRange"),
  };
  const readouts = {
    dist: document.getElementById("distOut"),
    angle: document.getElementById("angleOut"),
    space: document.getElementById("spaceOut"),
    width: document.getElementById("widthOut"),
  };

  const linesLayer = board.layer("transversals");
  const barsLayer = board.layer("bars");
  const handlesLayer = board.layer("handles");

  /** A named SVG element for markup Geom does not make itself. */
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

  // One guide line plus a pool of the applet's transversals and bars. The
  // pools are created once, so dragging never loses keyboard focus.
  const guide = board.segment({ x: 0, y: 150 }, { x: 400, y: 150 }, "guide", linesLayer);
  const segments = [];
  for (let i = 0; i < Core.maxLineCount(); i++) {
    segments.push(board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "transversal", linesLayer));
  }
  const barShapes = [];
  for (let i = 0; i < Core.maxBarCount(); i++) {
    barShapes.push(shapeEl("rect", "bar", barsLayer));
  }

  let state = Core.start();

  /**
   * Shows a line under the picture. `kind` is "win", "lose", "done" or
   * nothing; those classes are how the player's record sees a finished play.
   * This illustration has no winner, so no kind is ever passed here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const clampHandle = (p, name) => name === "angle"
    ? Core.clampAngleHandle(p)
    : Core.clampSpacingHandle(state, p);

  const describe = (name) => () => name === "angle"
    ? `Slant ${state.angle} degrees from horizontal.`
    : `Gap between slanted lines ${state.dist} drawing units.`;

  const onMove = (p, name) => {
    const change = Core.paramFromHandle(state, name, p);
    if (!change) return;
    state = Core.setParam(state, change.name, change.value);
    render();
  };

  const angleH = board.handle("angle", Core.angleHandle(state), {
    r: 9, step: 2, shift: 8, layer: handlesLayer, clamp: clampHandle, onMove,
    cls: "geom-handle angle-handle",
    describe: describe("angle"),
    label: "Slant point on the dashed line. Drag it, or focus it and use the arrow keys, to change the slant.",
  });
  const gapH = board.handle("spacing", Core.spacingHandle(state), {
    r: 8, step: 2, shift: 6, layer: handlesLayer, clamp: clampHandle, onMove,
    cls: "geom-handle gap-handle",
    describe: describe("spacing"),
    label: "Line-gap point. Drag it left or right, or focus it and use the arrow keys, to change the gap between slanted lines.",
  });

  function render() {
    const g = Core.geometry(state);

    guide.set({ x: 0, y: Core.lineY(state, 0) }, { x: Core.VIEW.width, y: Core.lineY(state, Core.VIEW.width) });
    segments.forEach((seg, i) => {
      const line = g.lines[i];
      seg.show(Boolean(line));
      if (line) seg.set(line.clipped[0], line.clipped[1]);
    });
    barShapes.forEach((shape, i) => {
      const bar = g.bars[i];
      shape.show(Boolean(bar));
      if (!bar) return;
      shape.set(bar);
      shape.node.setAttribute("class", state.reveal ? "bar bar-open" : "bar");
    });

    angleH.set(Core.angleHandle(state));
    gapH.set(Core.spacingHandle(state));

    for (const name of ["dist", "angle", "space", "width"]) {
      inputs[name].value = String(state[name]);
      readouts[name].textContent = String(state[name]);
    }
    revealBtn.setAttribute("aria-pressed", String(state.reveal));
    revealBtn.textContent = state.reveal ? "Drop the bars back" : "Lift the bars";

    if (state.reveal) {
      say(`The bars are outlines now: the slanted lines run straight through them at ${state.angle} degrees. ` +
        "Nothing bends or jumps; the break is only how the picture looks.", null);
    } else {
      say(`Slanted lines at ${state.angle} degrees with a gap of ${state.dist}; upright bars ` +
        `${state.space} apart and ${state.width} wide. The bars hide the middle of every slanted line.`, null);
    }

    // The position, for the player's record and the tutor (board units).
    if (window.Track) window.Track.state(state);
  }

  for (const name of ["dist", "angle", "space", "width"]) {
    inputs[name].addEventListener("input", () => {
      state = Core.setParam(state, name, inputs[name].value);
      render();
    });
  }

  revealBtn.addEventListener("click", () => {
    state = Core.setReveal(state, !state.reveal);
    render();
  });

  newBtn.addEventListener("click", () => {
    state = Core.start();
    render();
  });

  board.onTheme(render);
  render();
})();
