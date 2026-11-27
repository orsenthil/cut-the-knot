"use strict";

/*
 * The page for Four Incircles: drawing and input only. The geometry is in
 * four-incircles-core.js. The board holds an apex A above a horizontal base
 * with four draggable points B, C, D, E; the three level-1 incircles are always
 * drawn, and the two level-2 circles plus the whole triangle's circle appear
 * once the outer level-1 circles match, as in the applet. Every point is a
 * focusable handle, so it can be dragged or nudged with the arrow keys.
 */

(function () {
  const Core = FourIncirclesCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const equalBtn = document.getElementById("equalBtn");
  const resetBtn = document.getElementById("resetBtn");
  const board = Geom.board(document.getElementById("board"));

  const guides = board.layer("guides");
  const raysLayer = board.layer("rays");
  const circlesLayer = board.layer("circles");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start({});

  const baseLine = board.segment(
    { x: state.left, y: state.baseY },
    { x: state.right, y: state.baseY }, "base-line", guides);

  const rays = Core.NAMES.map(() => board.segment(state.apex, state.points[0], "ray", raysLayer));
  const circles = [];
  for (let level = 1; level < Core.N; level++) {
    const cls = level === 1 ? "incircle level1" :
      level === 2 ? "incircle level2" : "incircle level3";
    for (let i = 0; i + level < Core.N; i++) {
      circles.push({ level: level, index: i, shape: board.circle(state.apex, 1, cls, circlesLayer) });
    }
  }
  const labels = ["A"].concat(Core.NAMES).map(() =>
    board.label(state.apex, "", "point-label", -4, -12, labelsLayer));

  const baseNames = Core.NAMES.map((name) => ({
    name: name,
    handle: board.handle(name, state.points[Core.NAMES.indexOf(name)], {
      r: 8, step: 2, shift: 10, layer: handlesLayer,
      label: "Point " + name + " on the base line. Drag it, or focus it and use the arrow keys to move it.",
      clamp: (q) => ({ x: Geom.clamp(q.x, 3, state.width - 3), y: state.baseY }),
      onMove: (point, which) => {
        state = Core.movePoint(state, which, point);
        render();
      },
    }),
  }));
  const apexHandle = board.handle("A", state.apex, {
    r: 9, step: 2, shift: 10, cls: "geom-handle apex-handle", layer: handlesLayer,
    label: "Point A, the apex above the base. Drag it, or focus it and use the arrow keys to move it.",
    clamp: (q) => ({
      x: Geom.clamp(q.x, 3, state.width - 3),
      y: Geom.clamp(q.y, 3, state.height - 3),
    }),
    onMove: (point, which) => {
      state = Core.movePoint(state, which, point);
      render();
    },
  });

  /**
   * The shared status line. "done" tells the player's record that this
   * illustration has been explored; it is not a win or a loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const matched = Core.matched(state);
    baseLine.set({ x: state.left, y: state.baseY }, { x: state.right, y: state.baseY });

    for (let i = 0; i < Core.N; i++) {
      rays[i].set(state.apex, state.points[i]);
      baseNames[i].handle.set(state.points[i]);
    }
    apexHandle.set(state.apex);

    for (const item of circles) {
      const group = Core.circles(state, item.level);
      const c = group[item.index];
      item.shape.set(c.center, c.radius);
      item.shape.show(item.level === 1 || matched);
    }

    labels[0].set(state.apex, "A");
    for (let i = 0; i < Core.N; i++) {
      labels[i + 1].set(state.points[i], Core.NAMES[i]);
    }

    const level1 = Core.radii(state, 1);
    const level2 = Core.radii(state, 2);
    if (matched) {
      say("Outer circles: " + level1[0].toFixed(1) + " and " + level1[2].toFixed(1) +
        ", within a pixel. The two wider circles (" + level2[0].toFixed(1) +
        " and " + level2[1].toFixed(1) + ") match too.", "done");
    } else {
      say("Outer circles: " + level1[0].toFixed(1) + " and " + level1[2].toFixed(1) +
        ". They differ; move C or D and watch the two wider circles.");
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  equalBtn.addEventListener("click", () => {
    state = Core.makeEqual(state, 1.6);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state, {});
    render();
  });

  board.onTheme(() => render());
  render();
})();
