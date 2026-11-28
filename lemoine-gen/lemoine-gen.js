"use strict";

/*
 * The page for Lemoine Gen: drawing and input only; all the geometry is in
 * lemoine-gen-core.js. The stage holds a triangle ABC and a free point M as
 * draggable SVG handles. Two coloured paths follow the applet's two walks,
 * and the checkboxes reveal the cevians, the links, the centre and the
 * reflected triangle exactly as the applet's six checkboxes did.
 */

(function () {
  const Core = LemoineGenCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const stepBtn = document.getElementById("stepBtn");
  const runBtn = document.getElementById("runBtn");
  const boxes = {
    red: document.getElementById("redBox"),
    connections: document.getElementById("connectionsBox"),
    center: document.getElementById("centerBox"),
    blue: document.getElementById("blueBox"),
    cevians: document.getElementById("ceviansBox"),
    reflection: document.getElementById("reflectionBox"),
  };
  const WIDTH = 480, HEIGHT = 360, MAX_POINTS = 24;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const onBoard = (p) => ({
    x: clamp(p.x, 10, WIDTH - 10),
    y: clamp(p.y, 10, HEIGHT - 10),
  });
  const fmt = (p) => `(${Math.round(p.x)}, ${Math.round(p.y)})`;
  let state = Core.start({ width: WIDTH, height: HEIGHT });
  let timer = null;

  /* Layers are created in paint order; shapes come before the handles. */
  const guides = board.layer("guides");
  const walks = board.layer("walks");
  const links = board.layer("links");
  const extras = board.layer("extras");
  const labels = board.layer("labels");
  const tops = board.layer("handles");

  const sides = [0, 1, 2].map(() => board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "side", guides));
  const redPath = board.el("path", null, "walk-red", walks);
  const bluePath = board.el("path", null, "walk-blue", walks);
  const redGuides = [], blueGuides = [], connectors = [];
  for (let i = 0; i < MAX_POINTS; i++) {
    redGuides.push(board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "walk-guide", guides));
    blueGuides.push(board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "walk-guide", guides));
    connectors.push(board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "walk-link", links));
  }
  const cevians = [0, 1, 2].map(() =>
    board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "cevian", extras));
  const reflected = board.polygon([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    "reflected", extras);
  const centerDot = board.point({ x: 0, y: 0 }, "center-dot", 5, extras);
  const names = ["A", "B", "C", "M"].map((letter) =>
    board.label({ x: 0, y: 0 }, letter, "pt-name", 10, -9, labels));
  const centerName = board.label({ x: 0, y: 0 }, "O", "center-name", 9, -9, labels);

  /** Show a line under the board. An illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function stopAnimation() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    state = { ...state, running: false };
    runBtn.setAttribute("aria-pressed", "false");
    runBtn.textContent = "Animate";
  }

  function pathOf(points) {
    if (!points.length) return "";
    return points.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  }

  function showWalk(points, guidesForWalk, pathNode, show) {
    const n = points.length;
    pathNode.setAttribute("d", show && n > 1 ? pathOf(points) : "");
    for (let i = 0; i < guidesForWalk.length; i++) {
      const idx = i + 1;
      const on = show && idx < n;
      guidesForWalk[i].show(on);
      if (!on) continue;
      const k = (idx - 1) % 3;
      const side = Core.SIDES[k];
      guidesForWalk[i].set(points[idx], state.ABC[side[0]]);
      guidesForWalk[i].node.setAttribute("x2", state.ABC[side[1]].x);
      guidesForWalk[i].node.setAttribute("y2", state.ABC[side[1]].y);
    }
  }

  function render() {
    const [A, B, C] = state.ABC;
    const m = state.point;
    state.ABC.forEach((p, i) => sides[i].set(p, state.ABC[(i + 1) % 3]));

    showWalk(state.red, redGuides, redPath, state.show.red);
    showWalk(state.blue, blueGuides, bluePath, state.show.blue);

    for (let i = 0; i < connectors.length; i++) {
      const idx = i + 1;
      const on = state.show.connections && idx < state.red.length && idx < state.blue.length;
      connectors[i].show(on);
      if (on) connectors[i].set(state.red[idx], state.blue[idx]);
    }

    const O = Core.center(state.ABC, m);
    for (let i = 0; i < 3; i++) {
      const on = state.show.cevians;
      cevians[i].show(on);
      if (!on) continue;
      const vertex = state.ABC[i];
      const opposite = Core.SIDES[i];
      const foot = Geom.lineIntersection(vertex, m,
        state.ABC[opposite[0]], state.ABC[opposite[1]]);
      cevians[i].set(vertex, foot || m);
    }
    const hasCenter = !!(O && Number.isFinite(O.x));
    centerDot.show(state.show.center && hasCenter);
    centerName.show(state.show.center && hasCenter);
    reflected.show(state.show.reflection && hasCenter);
    if (hasCenter) {
      centerDot.set(O);
      centerName.set(O);
      reflected.set(state.ABC.map((p) => Core.reflect(p, O)));
    }

    [A, B, C, m].forEach((p, i) => {
      names[i].set(p);
      handles[i].set(p);
    });

    const lastRed = state.red[state.red.length - 1];
    const lastBlue = state.blue[state.blue.length - 1];
    const bits = [`Red ${state.red.length - 1} steps at ${fmt(lastRed)}`,
      `blue ${state.blue.length - 1} steps at ${fmt(lastBlue)}`];
    if (state.show.center && hasCenter) bits.push(`centre ${fmt(O)}`);
    say(`${bits.join("; ")}.`);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const handleNames = ["A", "B", "C", "M"];
  const handles = handleNames.map((name, i) => board.handle(name, state.ABC[i] || state.point, {
    r: 11, step: 4, shift: 12, cls: "geom-handle", layer: tops,
    label: `${name === "M" ? "Free point M" : "Triangle corner " + name}. Drag it, or focus it and use the arrow keys.`,
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    clamp: onBoard,
    onMove: (p) => {
      stopAnimation();
      state = Core.move(state, { name, point: p });
      render();
    },
  }));

  function advance() {
    state = Core.move(state, { type: "step" });
    render();
  }

  function restart() {
    stopAnimation();
    const show = { ...state.show };
    state = { ...Core.start({ width: WIDTH, height: HEIGHT }), show };
    render();
  }

  newBtn.addEventListener("click", restart);
  stepBtn.addEventListener("click", () => {
    stopAnimation();
    advance();
  });
  runBtn.addEventListener("click", () => {
    if (timer !== null) {
      stopAnimation();
      render();
      return;
    }
    state = { ...state, running: true };
    runBtn.setAttribute("aria-pressed", "true");
    runBtn.textContent = "Stop";
    timer = setInterval(advance, 120);
  });
  Object.keys(boxes).forEach((name) => {
    boxes[name].addEventListener("change", () => {
      if (timer !== null) stopAnimation();
      state = Core.move(state, { type: "toggle", name, on: boxes[name].checked });
      render();
    });
  });
  board.onTheme(() => render());

  render();
})();
