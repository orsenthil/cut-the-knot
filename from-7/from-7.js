"use strict";

/*
 * The page for From 7: drawing and input only. The geometry is in
 * from-7-core.js and follows the applet's Extend / LinComb methods exactly.
 * The SVG holds the original triangle, the three extensions, the outer
 * triangle and, when ticked, the applet's grid lines and shaded
 * parallelograms. The three corners are Geom handles, so a pointer drag and
 * the arrow keys both move them; every shape is made once and re-set on each
 * redraw, so the handle that has keyboard focus keeps it.
 */

(function () {
  const Core = From7Core;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");
  const numEl = document.getElementById("num");
  const lessBtn = document.getElementById("lessBtn");
  const moreBtn = document.getElementById("moreBtn");
  const gridBox = document.getElementById("gridBox");
  const colorBox = document.getElementById("colorBox");
  const resetBtn = document.getElementById("resetBtn");

  const layers = {
    fills: board.layer("fills"),
    grid: board.layer("grid"),
    outer: board.layer("outer"),
    sides: board.layer("sides"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geometry = Core.compute(state);

  /** Status line. A demo never ends in a win or a loss, so no such class. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const outerFill = board.polygon(geometry.X, "outer-fill", layers.fills);
  const smallFill = board.polygon([state.A, state.B, state.C], "small-fill", layers.fills);
  const paras = geometry.parallelograms.map((pts, i) =>
    board.polygon(pts, "para para-" + i, layers.fills));

  const outerSides = geometry.X.map((p, i) =>
    board.segment(p, geometry.X[(i + 1) % 3], "outer-side", layers.outer));
  const extensions = [
    board.segment(state.B, geometry.X[0], "extension", layers.outer),
    board.segment(state.C, geometry.X[1], "extension", layers.outer),
    board.segment(state.A, geometry.X[2], "extension", layers.outer),
  ];
  const sides = [
    board.segment(state.A, state.B, "side", layers.sides),
    board.segment(state.B, state.C, "side", layers.sides),
    board.segment(state.C, state.A, "side", layers.sides),
  ];
  const xDots = geometry.X.map((p) => board.point(p, "xdot", 4, layers.dots));
  const cornerLabels = ["A", "B", "C"].map((name, i) =>
    board.label(state.A, name, "point-label", -12, -10, layers.labels));
  const outerLabels = ["B′", "C′", "A′"].map((name, i) =>
    board.label(geometry.X[i], name, "point-label", 7, -7, layers.labels));

  // DrawGrid asks for 6N+9 lines. Grow the pool if a player types a big N.
  const gridPool = [];
  function ensureGrid(count) {
    while (gridPool.length < count) {
      gridPool.push(board.line({ x: 0, y: 0 }, { x: 0, y: 0 }, "grid-line", layers.grid));
    }
  }

  const handles = Core.NAMES.map((name) => board.handle(name, state[name], {
    r: 10,
    step: 4,
    shift: 5,
    cls: "geom-handle corner-handle",
    layer: layers.handles,
    label: "Corner " + name + ". Drag it, or focus it and use the arrow keys to move it.",
    describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
    clamp: (q) => ({
      x: Math.max(1, Math.min(state.width - 1, q.x)),
      y: Math.max(1, Math.min(state.height - 1, q.y)),
    }),
    onMove: (p, which) => apply({ type: "point", name: which, point: p }),
  }));

  function draw(g) {
    for (let i = 0; i < handles.length; i++) handles[i].set([state.A, state.B, state.C][i]);

    outerFill.set(g.X);
    smallFill.set([g.A, g.B, g.C]);
    for (let i = 0; i < 3; i++) {
      paras[i].set(g.parallelograms[i]).show(state.addColor);
      outerSides[i].set(g.X[i], g.X[(i + 1) % 3]);
      xDots[i].set(g.X[i]);
      cornerLabels[i].set([g.A, g.B, g.C][i]).show(!g.degenerate);
      outerLabels[i].set(g.X[i]).show(!g.degenerate);
    }
    extensions[0].set(g.B, g.X[0]);
    extensions[1].set(g.C, g.X[1]);
    extensions[2].set(g.A, g.X[2]);
    sides[0].set(g.A, g.B);
    sides[1].set(g.B, g.C);
    sides[2].set(g.C, g.A);

    ensureGrid(g.grid.length);
    for (let i = 0; i < gridPool.length; i++) {
      const line = g.grid[i];
      gridPool[i].show(state.showGrid && !!line);
      if (line) gridPool[i].set(line.a, line.b);
    }
  }

  function statusText(g) {
    if (g.degenerate) {
      return "The three corners lie on one line, so there is no triangle. Move one off the line.";
    }
    const measured = g.ratio.toFixed(3).replace(/\.000$/, "");
    return `N = ${g.N}. The outer triangle is ${g.expectedRatio} times the area of ABC ` +
      `(measured ${measured} times). Drag a corner: the ratio does not change.`;
  }

  /** Redraw, speak the picture and save the position for the record and tutor. */
  function render() {
    geometry = Core.compute(state);
    draw(geometry);
    numEl.value = String(state.N);
    lessBtn.disabled = state.N <= Core.MIN_N;
    gridBox.checked = state.showGrid;
    colorBox.checked = state.addColor;
    say(statusText(geometry));
    if (window.Track) window.Track.state({
      A: state.A, B: state.B, C: state.C,
      N: state.N, showGrid: state.showGrid, addColor: state.addColor,
    });
  }

  /** Apply one core move; an illegal one simply leaves the picture alone. */
  function apply(m) {
    const next = Core.move(state, m);
    if (!next) { render(); return false; }
    state = next;
    render();
    return true;
  }

  lessBtn.addEventListener("click", () => apply({ type: "step", delta: -1 }));
  moreBtn.addEventListener("click", () => apply({ type: "step", delta: 1 }));
  gridBox.addEventListener("change", () => apply({ type: "option", key: "showGrid", value: gridBox.checked }));
  colorBox.addEventListener("change", () => apply({ type: "option", key: "addColor", value: colorBox.checked }));
  numEl.addEventListener("change", () => {
    // Integer.parseInt then the Min test, as From7Panel.keyPressMNum does.
    const n = Number.parseInt(numEl.value, 10);
    if (!Number.isFinite(n) || n < Core.MIN_N) render(); // puts the old value back
    else apply({ type: "N", value: n });
  });
  resetBtn.addEventListener("click", () => apply({ type: "reset" }));

  // Classes are styled with CSS tokens, but redraw on a theme flip as the
  // illustration ports do, so any future computed style stays in step.
  board.onTheme(() => draw(geometry));

  render();
})();
