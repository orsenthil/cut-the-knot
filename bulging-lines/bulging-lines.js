"use strict";

/*
 * The page for Bulging Lines: drawing and input only. The geometry of the
 * checkerboard, the 64 circles, the 16 lines and the half-transparent top
 * layer all come from bulging-lines-core.js. An SVG holds two copies of the
 * picture; a draggable, focusable dot moves the top copy over the bottom one.
 */

(function () {
  const Core = BulgingLinesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const orderSel = document.getElementById("order");
  const radiusInput = document.getElementById("radius");
  const radiusVal = document.getElementById("radiusVal");
  const newBtn = document.getElementById("newBtn");

  /* The applet centres its 9x9 grid in its canvas. Our canvas is a 320x320
     square placed at this point of the SVG's viewBox (400x360). */
  const CANVAS = { width: 320, height: 320 };
  const ORIGIN = { x: 40, y: 20 };
  const METRICS = Core.metrics(Core.start(), CANVAS);
  const CENTER = {
    x: ORIGIN.x + METRICS.x0 + (METRICS.n * METRICS.side) / 2,
    y: ORIGIN.y + METRICS.y0 + (METRICS.n * METRICS.side) / 2,
  };

  const baseLayer = board.layer("base");
  const topLayer = board.layer("top");
  const guides = board.layer("guides");
  const handlesLayer = board.layer("handles");

  const sqNodes = [[], []];
  const dotShapes = [[], []];
  const lineShapes = [[], []];

  let state = Core.start();

  for (const order of Core.ORDERS) {
    const opt = document.createElement("option");
    opt.value = order;
    const words = { G: "grey", L: "light grey", W: "white", B: "black" };
    opt.textContent = `${order} — ${[...order].map((c) => words[c]).join(", ")}`;
    orderSel.appendChild(opt);
  }
  orderSel.value = state.order;

  /** Status text, never a win or a loss: this is an illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function rect(layer) {
    return board.el("rect", { x: 0, y: 0, width: 0, height: 0 }, "square", layer);
  }

  function draw() {
    const L = Core.layout(state, CANVAS);
    for (let layerIndex = 0; layerIndex < 2; layerIndex++) {
      const layer = L.layers[layerIndex];
      const parent = layerIndex === 0 ? baseLayer : topLayer;

      for (let i = 0; i < layer.squares.length; i++) {
        const sq = layer.squares[i];
        if (!sqNodes[layerIndex][i]) sqNodes[layerIndex][i] = rect(parent);
        const node = sqNodes[layerIndex][i];
        node.setAttribute("class", "square s" + sq.color);
        node.setAttribute("x", ORIGIN.x + sq.x);
        node.setAttribute("y", ORIGIN.y + sq.y);
        node.setAttribute("width", sq.size);
        node.setAttribute("height", sq.size);
      }
      for (let i = 0; i < layer.dots.length; i++) {
        const dot = layer.dots[i];
        if (!dotShapes[layerIndex][i]) {
          dotShapes[layerIndex][i] = board.circle({ x: 0, y: 0 }, dot.r, "dot", parent);
        }
        dotShapes[layerIndex][i]
          .set({ x: ORIGIN.x + dot.x, y: ORIGIN.y + dot.y }, dot.r)
          .node.setAttribute("class", "dot s" + dot.color);
        dotShapes[layerIndex][i].show(true);
      }
      for (let i = 0; i < layer.lines.length; i++) {
        const ln = layer.lines[i];
        if (!lineShapes[layerIndex][i]) {
          lineShapes[layerIndex][i] = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "gridline", parent);
        }
        lineShapes[layerIndex][i].set(
          { x: ORIGIN.x + ln.x1, y: ORIGIN.y + ln.y1 },
          { x: ORIGIN.x + ln.x2, y: ORIGIN.y + ln.y2 },
        ).node.setAttribute("class", "gridline s" + ln.color);
        lineShapes[layerIndex][i].show(true);
      }
    }
    return L;
  }

  function render() {
    const L = draw();
    const offset = state.offset;
    topHandle.set({ x: CENTER.x + offset.x, y: CENTER.y + offset.y });
    orderSel.value = state.order;
    radiusInput.value = String(state.radius);
    radiusVal.textContent = String(state.radius);
    const dx = offset.x, dy = offset.y;
    const where = dx === 0 && dy === 0
      ? "lined up exactly with the bottom one"
      : `moved ${Math.abs(dx)} steps ${dx < 0 ? "left" : "right"} and ${Math.abs(dy)} steps ${dy < 0 ? "up" : "down"}`;
    say(`${state.order}: ${L.side}-pixel squares, dots of radius ${state.radius}. The top layer is ${where}. Its lines are still straight.`);
    if (window.Track) window.Track.state(state);
  }

  const topHandle = board.handle("Top layer", { x: CENTER.x, y: CENTER.y }, {
    r: 11, step: 4, shift: 16, layer: handlesLayer, cls: "geom-handle top-handle",
    label: "Top layer. Drag this dot, or focus it and use the arrow keys, to slide the transparent copy over the picture.",
    describe: (p) => `Offset ${Math.trunc(p.x - CENTER.x)} right, ${Math.trunc(p.y - CENTER.y)} down from the bottom layer.`,
    clamp: (p) => ({ x: Geom.clamp(p.x, 12, 388), y: Geom.clamp(p.y, 12, 348) }),
    onMove: (p) => {
      state = Core.withSetting(state, "offset", {
        x: Math.trunc(p.x - CENTER.x), y: Math.trunc(p.y - CENTER.y),
      });
      render();
    },
  });

  board.point({ x: CENTER.x, y: CENTER.y }, "base-mark", 3, guides);

  orderSel.addEventListener("change", () => {
    state = Core.withSetting(state, "order", orderSel.value);
    render();
  });
  radiusInput.addEventListener("input", () => {
    state = Core.withSetting(state, "radius", radiusInput.value);
    render();
  });
  newBtn.addEventListener("click", () => {
    state = Core.start();
    render();
    topHandle.node.focus();
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "r" || e.key === "R") && e.target !== orderSel && e.target !== radiusInput) {
      state = Core.start();
      render();
    }
  });

  board.onTheme(render);
  render();
})();
