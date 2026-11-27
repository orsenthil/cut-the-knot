"use strict";

/*
 * The page for Delboeuf: drawing and input only. Every drawing number comes
 * from delboeuf-core.js, which re-creates DelboeufCanvas.Draw and DrawOval.
 * A 500 x 300 SVG board holds the four rings and the optional guide lines;
 * the five range inputs are the applet's five scrollbars. A probe dot, added
 * for this site like the one on Contrast, can be dragged or moved with the
 * arrow keys to read which ring is nearest; it never changes the picture.
 */

(function () {
  const Core = DelboeufCore;
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
  const guides = board.layer("guides");
  const rings = board.layer("rings");
  const handles = board.layer("handles");

  const frame = board.el("rect", { x: 0.5, y: 0.5, width: W - 1, height: H - 1 }, "frame", guides);
  frame.setAttribute("rx", "4");
  const bandLines = [
    board.line({ x: 0, y: 0 }, { x: W, y: 0 }, "band-line", guides),
    board.line({ x: 0, y: 0 }, { x: W, y: 0 }, "band-line", guides),
  ];

  // Each Java DrawOval is an outer disc in its colour with an inner disc in
  // the background. Two circles do exactly that, and the hole also erases
  // any earlier ring the way the applet's background fill does.
  const ringShapes = [0, 1, 2, 3].map(() => ({
    outer: board.circle({ x: 0, y: 0 }, 0, "ring", rings),
    inner: board.circle({ x: 0, y: 0 }, 0, "hole", rings),
  }));

  let state = { ...Core.start(), probe: { x: 150, y: 268 } };

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

  /** The stage token, so the applet's CI scaling follows the theme too. */
  function stageRGB() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--stage").trim();
    const match = /^#([0-9a-f]{6})$/i.exec(raw);
    if (!match) return [255, 255, 255];
    const n = parseInt(match[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function render() {
    const f = Core.compute(state, W, H, stageRGB());

    for (let i = 0; i < f.ovals.length; i++) {
      const o = f.ovals[i];
      const half = Math.trunc(o.thickness / 2);
      const shapes = ringShapes[i];
      // SVG rejects a negative radius even on a hidden circle, so clamp the
      // attribute while show() below keeps the applet's paint/no-paint choice.
      shapes.outer.set({ x: o.cx, y: o.cy }, Math.max(0, o.r + half));
      shapes.inner.set({ x: o.cx, y: o.cy }, Math.max(0, o.r - half));
      // The applet's foreground is the page's FCOLOR; on this site that ink
      // follows the theme. A Ci tint is a real colour of its own.
      if (o.palette === "target" && state.Ci !== 0) {
        shapes.outer.node.style.fill = f.colors.target;
      } else {
        shapes.outer.node.style.removeProperty("fill");
      }
      shapes.outer.show(o.r + half > 0);
      shapes.inner.show(o.r - half > 0);
    }

    if (f.band) {
      bandLines[0].set({ x: 0, y: f.band.y1 }, { x: W, y: f.band.y1 });
      bandLines[1].set({ x: 0, y: f.band.y2 }, { x: W, y: f.band.y2 });
      for (const line of bandLines) {
        line.node.style.stroke = f.colors.band;
        line.show(true);
      }
    } else {
      for (const line of bandLines) line.show(false);
    }

    probe.set(state.probe);

    for (const key of Core.OPTIONS) {
      sliders[key].value = String(state[key]);
      readouts[key].textContent = String(state[key]);
    }

    say(Core.describe(state, f, state.probe));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const probe = board.handle("Probe", state.probe, {
    r: 8,
    step: 5,
    shift: 25,
    label: "Probe dot. Drag it, or focus it and use the arrow keys to read the nearest circle",
    describe: (p) => `probe at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    clamp: (p) => ({ x: Geom.clamp(p.x, 0, W), y: Geom.clamp(p.y, 0, H) }),
    layer: handles,
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

  // A theme flip changes the stage token, so the CI lines are recomputed.
  board.onTheme(render);

  render();
})();
