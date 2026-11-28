"use strict";

/*
 * Disappearing lines — the page.
 *
 * geometry, the strokes and the eyes live in lines-core.js. This file draws
 * the two triangles as SVG: a stationary lower one, a draggable upper one and
 * three pairs of eyes that open when the upper piece reaches the applet's
 * exact target corner. "One notch" (s pixels) comes from straighter.reset.
 * The arrow keys move the piece in snaps of one notch; Shift moves faster.
 * There is nothing to win: this is an illustration of a visual trick.
 */

(function () {
  const Core = LinesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const countEl = document.getElementById("count");
  const nInput = document.getElementById("nInput");
  const resetBtn = document.getElementById("resetBtn");
  const slideBtn = document.getElementById("slideBtn");
  const leftBtn = document.getElementById("leftBtn");
  const rightBtn = document.getElementById("rightBtn");
  const upBtn = document.getElementById("upBtn");
  const downBtn = document.getElementById("downBtn");

  let state = Core.start({});

  /** An illustration has no win or loss: "done" just says the trick is shown. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const lower = board.layer("lower");
  const upper = board.layer("upper");
  const strokes = board.layer("strokes");
  const eyesLayer = board.layer("eyes");
  const handles = board.layer("handles");

  const lowerShape = board.polygon([], "triangle", lower);
  const upperShape = board.polygon([], "triangle moving", upper);
  const strokeNodes = [];
  const eyeNodes = [];
  for (let i = 0; i < 2 * Core.MAX_N; i++) {
    strokeNodes.push(board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "stroke", strokes));
  }
  for (let i = 0; i < 3; i++) {
    const eye = {
      lid: board.el("circle", null, "eye-white", eyesLayer),
      iris: board.el("circle", null, "eye-iris", eyesLayer),
      pupil: board.el("circle", null, "eye-pupil", eyesLayer),
      upperLid: board.el("path", null, "eye-lid", eyesLayer),
      outline: board.el("circle", null, "eye-outline", eyesLayer),
    };
    eyeNodes.push(eye);
  }
  const dot = board.point({ x: 0, y: 0 }, "handle-dot", 8, handles);
  const grip = board.handle("Upper half", Core.handlePoint(state), {
    r: 16,
    step: Core.MOUSE_STEP,
    shift: Core.MOUSE_STEP * 5,
    cls: "grip",
    layer: handles,
    label: "Upper triangle. Drag it, or focus it and use the arrow keys; hold Shift for bigger steps.",
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    onMove: (p) => { state = Core.dragTo(state, p); render(); },
  });

  function arcPath(cx, cy, r, from, to) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 0 ${from === 0 ? 1 : 0} ${cx + r} ${cy} A ${r} ${r} 0 0 ${to === 0 ? 1 : 0} ${cx - r} ${cy}`;
  }

  function render() {
    board.root.setAttribute("viewBox", `0 0 ${Core.WIDTH} ${Core.HEIGHT}`);
    const g = Core.geometry(state);
    const poly = Core.polygons(g);
    lowerShape.set(poly.lower);
    upperShape.set(poly.upper);

    const segs = Core.segments(g);
    strokeNodes.forEach((node, i) => {
      if (i < segs.length) {
        const s = segs[i];
        node.set({ x: s.x, y: s.y0 }, { x: s.x, y: s.y1 });
        node.show(true);
      } else node.show(false);
    });

    const eyes = Core.eyes(state);
    eyeNodes.forEach((node, i) => {
      const e = eyes[i];
      const { x, y, w, h } = e.rect;
      const d = e.eyeR * 2;
      node.lid.setAttribute("cx", x + w / 2);
      node.lid.setAttribute("cy", y + h / 2);
      node.lid.setAttribute("r", e.eyeR);
      node.lid.setAttribute("class", "eye-white" + (e.full ? " open" : ""));
      node.iris.setAttribute("cx", e.irisLeft.x);
      node.iris.setAttribute("cy", e.irisLeft.y);
      node.iris.setAttribute("r", e.irisR);
      node.iris.setAttribute("class", "eye-iris" + (e.full ? " open" : ""));
      node.pupil.setAttribute("cx", e.irisRight.x);
      node.pupil.setAttribute("cy", e.irisRight.y);
      node.pupil.setAttribute("r", 2);
      node.upperLid.setAttribute("d", e.full
        ? `M ${x + w / 2 - e.eyeR} ${y + h / 2 - e.eyeR} A ${e.eyeR} ${e.eyeR} 0 0 1 ${x + w / 2 + e.eyeR} ${y + h / 2 - e.eyeR}`
        : arcPath(x + w / 2, y + h / 2, e.eyeR, 0, 1));
      node.outline.setAttribute("cx", x + w / 2);
      node.outline.setAttribute("cy", y + h / 2);
      node.outline.setAttribute("r", e.eyeR);
    });

    const h = Core.handlePoint(state);
    dot.set(h);
    grip.set(h);
    nInput.value = String(state.n);
    countEl.textContent = `${Core.countLines(g)} lines drawn · notches ${g.s}px`;
    say(Core.finished(state)
      ? `One line gone: ${Core.countLines(g)} instead of ${state.n}. The eyes are open.`
      : `${state.n} lines drawn. Slide the upper triangle up and right one notch.`,
      Core.finished(state) ? "done" : "");

    if (window.Track) window.Track.state(state);
  }

  function reset() {
    state = Core.start({ n: Number(nInput.value) });
    render();
  }

  function nudge(dx, dy) {
    state = Core.nudge(state, dx, dy);
    render();
  }

  for (let n = Core.MIN_N; n <= Core.MAX_N; n++) {
    const option = document.createElement("option");
    option.value = String(n);
    option.textContent = String(n);
    if (n === state.n) option.selected = true;
    nInput.appendChild(option);
  }
  nInput.addEventListener("change", reset);
  resetBtn.addEventListener("click", reset);
  slideBtn.addEventListener("click", () => { state = Core.slide(state); render(); });
  leftBtn.addEventListener("click", () => nudge(-Core.geometry(state).s, 0));
  rightBtn.addEventListener("click", () => nudge(Core.geometry(state).s, 0));
  upBtn.addEventListener("click", () => nudge(0, -Core.geometry(state).s));
  downBtn.addEventListener("click", () => nudge(0, Core.geometry(state).s));
  board.onTheme(render);
  render();
})();
