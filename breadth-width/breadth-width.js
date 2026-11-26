"use strict";

/*
 * The page for the Height/Width Interplay Illusion: drawing and input only;
 * the applet's arithmetic is in breadth-width-core.js.
 *
 * One SVG shows the applet's three barrels: an upright stack with N lines, a
 * single layer, and a stack with N curved lines. A draggable point on the
 * ruler under them sets N from 1 to 20 (the applet's horizontal scrollbar),
 * and a second draggable point is a probe: put it on a stack to see its true
 * width and height. The buttons do the same jobs for keyboards and touch.
 */

(function () {
  const Core = BreadthWidthCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const lessBtn = document.getElementById("lessBtn");
  const moreBtn = document.getElementById("moreBtn");
  const resetBtn = document.getElementById("resetBtn");

  const background = board.layer("barrels");
  const marksLayer = board.layer("marks");
  const measureLayer = board.layer("measure");
  const rulerLayer = board.layer("ruler");
  const handlesLayer = board.layer("handles");

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

  /* Three barrels, each with a body, two oval caps and two side lines. */
  const barrels = [0, 1, 2].map((k) => ({
    body: shapeEl("rect", "barrel-body" + (k === 1 ? " single" : ""), background),
    top: shapeEl("ellipse", "cap-top", background),
    bottom: shapeEl("ellipse", "cap-bottom", background),
    rim: shapeEl("path", "cap-rim", background),
    left: board.segment({ x: 0, y: 0 }, { x: 0, y: 1 }, "barrel-side", background),
    right: board.segment({ x: 0, y: 0 }, { x: 0, y: 1 }, "barrel-side", background),
  }));

  /* Up to 20 layer marks per stack; unused ones are hidden, never rebuilt. */
  const uprights = [];
  const curves = [[], []];
  for (let i = 0; i <= Core.MAX_LAYERS; i++) {
    uprights.push(board.segment({ x: 0, y: 0 }, { x: 0, y: 1 }, "layer-line", marksLayer));
  }
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < Core.MAX_LAYERS; i++) {
      curves[k].push(shapeEl("path", "layer-line", marksLayer));
    }
  }

  /* The ruler below the barrels, with a tick for every scrollbar position. */
  const rulerLine = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "ruler-line", rulerLayer);
  const ticks = [];
  for (let n = 1; n <= Core.MAX_LAYERS; n++) {
    ticks.push(board.segment({ x: 0, y: 0 }, { x: 0, y: 1 }, "ruler-tick", rulerLayer));
  }
  const tickLabels = [1, 5, 10, 15, 20].map((n) =>
    board.label({ x: 0, y: 0 }, String(n), "ruler-label", 0, 18, rulerLayer));

  /* A square bracket shows that the probed stack is as tall as it is wide. */
  const widthBar = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "measure-bar", measureLayer);
  const widthLabel = board.label({ x: 0, y: 0 }, "", "measure-label", 0, 14, measureLayer);
  const heightBar = board.segment({ x: 0, y: 0 }, { x: 0, y: 1 }, "measure-bar", measureLayer);
  const heightLabel = board.label({ x: 0, y: 0 }, "", "measure-label", -10, 0, measureLayer);

  let state = Core.start();
  const seen = new Set();

  /**
   * `kind` is "done" once both stacks have been measured; that is how the
   * player's record learns that this illustration has been explored. There is
   * no win or loss here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** Java's drawArc(x,y,w,h,180,175): the lower half of an oval. */
  function lowerArc(arc) {
    const cx = arc.x + arc.width / 2, cy = arc.y + arc.height / 2;
    const rx = arc.width / 2, ry = arc.height / 2;
    let d = "";
    for (let i = 0; i <= 24; i++) {
      const t = ((arc.start + (arc.extent * i) / 24) * Math.PI) / 180;
      const x = cx + rx * Math.cos(t), y = cy - ry * Math.sin(t);
      d += (i ? " L " : "M ") + x.toFixed(2) + " " + y.toFixed(2);
    }
    return d;
  }

  function render() {
    const p = Core.picture(state);
    const g = p.geo;

    for (let k = 0; k < 3; k++) {
      const x = g.xs[k];
      const barrel = barrels[k];
      barrel.body.set({ x: x, y: g.Y0, width: g.S, height: g.S });
      barrel.top.set({ cx: x + g.S / 2, cy: g.Y0, rx: g.S / 2, ry: g.cap });
      barrel.bottom.set({ cx: x + g.S / 2, cy: g.Y0 + g.S, rx: g.S / 2, ry: g.cap });
      barrel.rim.set({ d: lowerArc({ x: x, y: g.Y0 + g.S - g.cap, width: g.S, height: 2 * g.cap, start: 180, extent: 175 }) });
      barrel.left.set({ x: x, y: g.Y0 }, { x: x, y: g.Y0 + g.S });
      barrel.right.set({ x: x + g.S, y: g.Y0 }, { x: x + g.S, y: g.Y0 + g.S });
      for (const node of [barrel.body.node, barrel.top.node, barrel.bottom.node, barrel.rim.node,
        barrel.left.node, barrel.right.node]) {
        node.classList.toggle("probed", p.stack === ["left", "middle", "right"][k]);
      }
    }

    p.leftLines.forEach((line, i) => {
      uprights[i].show(i < p.leftLines.length);
      if (i < p.leftLines.length) uprights[i].set({ x: line.x, y: line.y1 }, { x: line.x, y: line.y2 });
    });
    for (let i = uprights.length - 1; i >= p.leftLines.length; i--) uprights[i].show(false);

    [p.middleArcs, p.rightArcs].forEach((arcs, k) => {
      curves[k].forEach((shape, i) => {
        shape.show(i < arcs.length);
        if (i < arcs.length) shape.set({ d: lowerArc(arcs[i]) });
      });
    });

    const r = p.ruler;
    rulerLine.set({ x: r.x0, y: r.y }, { x: r.x1, y: r.y });
    ticks.forEach((tick, i) => {
      const x = r.x0 + i * r.step;
      tick.set({ x: x, y: r.y - 4 }, { x: x, y: r.y + 4 });
    });
    tickLabels.forEach((label, i) => label.set({ x: r.x0 + ([0, 4, 9, 14, 19][i]) * r.step, y: r.y }));

    if (p.stack) {
      const m = Core.measure(state, p.stack);
      widthBar.show(true).set({ x: m.x, y: g.Y0 + g.S + g.cap + 12 },
        { x: m.x + m.width, y: g.Y0 + g.S + g.cap + 12 });
      widthLabel.show(true).set({ x: m.x + m.width / 2, y: g.Y0 + g.S + g.cap + 12 }, `${m.width} wide`);
      heightBar.show(true).set({ x: m.x - 12, y: g.Y0 }, { x: m.x - 12, y: g.Y0 + m.height });
      heightLabel.show(true).set({ x: m.x - 12, y: g.Y0 + m.height / 2 }, `${m.height} tall`);
    } else {
      widthBar.show(false); widthLabel.show(false);
      heightBar.show(false); heightLabel.show(false);
    }

    lessBtn.disabled = state.layers <= Core.MIN_LAYERS;
    moreBtn.disabled = state.layers >= Core.MAX_LAYERS;
    lessBtn.setAttribute("aria-label", `Use one fewer layer, from ${state.layers}`);
    moreBtn.setAttribute("aria-label", `Use one more layer, from ${state.layers}`);

    const square = p.claims.leftSquare && p.claims.rightSquare;
    if (p.stack === "left" || p.stack === "right") seen.add(p.stack);
    if (seen.has("left") && seen.has("right")) {
      say(`Both stacks measure ${g.S} by ${g.S}: as tall as they are wide. The layer lines only fool the eye.`, "done");
    } else if (p.stack) {
      const m = Core.measure(state, p.stack);
      say(`The ${p.stack} stack is ${m.width} wide and ${m.height} tall, with ${m.layers} ${m.layers === 1 ? "layer" : "layers"}.`, null);
    } else if (square) {
      say(`${state.layers} ${state.layers === 1 ? "layer" : "layers"}. Both stacks are drawn in the same square — put the probe on one to measure it.`, null);
    } else {
      say("Move the probe onto a stack to measure it.", null);
    }

    if (window.Track) window.Track.state(state);
  }

  function setLayers(n) {
    state = Core.setLayers(state, n);
    hLayers.set(Core.layerPoint(state));
    render();
    return state.layers;
  }

  const snap = (q) => ({
    x: Geom.clamp(q.x, Core.ruler(state).x0, Core.ruler(state).x1),
    y: Core.ruler(state).y,
  });

  const hLayers = board.handle("Layers", Core.layerPoint(state), {
    r: 14, step: 17, shift: 85, cls: "geom-handle layer-handle", layer: handlesLayer,
    label: "Layer handle. Drag along the ruler, or focus and use the arrow keys, to change the number of layers from 1 to 20",
    describe: (q) => `at ${Core.layerFromX(state, q.x)} layers`,
    clamp: snap,
    onMove: (q) => setLayers(Core.layerFromX(state, q.x)),
  });

  const hProbe = board.handle("Probe", state.probe, {
    r: 10, step: 4, shift: 16, cls: "geom-handle probe-handle", layer: handlesLayer,
    label: "Measuring probe. Drag onto a barrel, or focus and use the arrow keys, to read its width and height",
    describe: (q) => `at ${Math.round(q.x)}, ${Math.round(q.y)}`,
    clamp: (q) => ({
      x: Geom.clamp(q.x, 4, state.width - 4),
      y: Geom.clamp(q.y, 4, state.height - 4),
    }),
    onMove: (q) => { state = Core.moveProbe(state, q); render(); },
  });

  function reset() {
    seen.clear();
    state = Core.start({ width: state.width, height: state.height });
    hLayers.set(Core.layerPoint(state));
    hProbe.set(state.probe);
    render();
    hProbe.node.focus();
  }

  lessBtn.addEventListener("click", () => setLayers(state.layers - 1));
  moreBtn.addEventListener("click", () => setLayers(state.layers + 1));
  resetBtn.addEventListener("click", reset);
  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "+" || k === "=") { e.preventDefault(); setLayers(state.layers + 1); }
    else if (k === "-" || k === "_") { e.preventDefault(); setLayers(state.layers - 1); }
    else if (k === "r") { e.preventDefault(); reset(); }
  });

  board.onTheme(render);
  render();
})();
