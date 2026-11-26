"use strict";

/*
 * Bimedians in a Tetrahedron — drawing and input only. The geometry and the
 * orthographic projection live in bimedians-in-tetrahedron-core.js.
 *
 * The SVG is a flat picture of a 3-D figure: four draggable corner handles,
 * the six edges and four faces of the tetrahedron, an optional box through
 * its corners, and the three bimedians joining midpoints of opposite edges.
 * Faces are painted back to front using the depth the core computes, so the
 * shape can be turned and tilted without losing its 3-D reading.
 */

(function () {
  const Core = BimediansInTetrahedronCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");

  const buttons = {
    reset: document.getElementById("resetBtn"),
    skew: document.getElementById("skewBtn"),
    cube: document.getElementById("cubeBtn"),
    turnLeft: document.getElementById("turnLeft"),
    turnRight: document.getElementById("turnRight"),
    tiltUp: document.getElementById("tiltUp"),
    tiltDown: document.getElementById("tiltDown"),
    zoomIn: document.getElementById("zoomIn"),
    zoomOut: document.getElementById("zoomOut"),
  };

  const view = board.viewBox;
  let state = Core.start();

  /* Layers, back to front. Handles are last so a redraw keeps their focus. */
  const cubeFaceLayer = board.layer("cube-faces");
  const cubeEdgeLayer = board.layer("cube-edges");
  const tetraFaceLayer = board.layer("tetra-faces");
  const tetraEdgeLayer = board.layer("tetra-edges");
  const bimedianLayer = board.layer("bimedians");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const startAt = { x: view.x + 20, y: view.y + 20 };

  /* Every shape is made once and only updated on a redraw. */
  const cubeFaces = Core.CUBE_FACES.map(() =>
    board.polygon([startAt, startAt, startAt, startAt], "cube-face", cubeFaceLayer));
  const cubeEdges = Array.from({ length: 12 }, () =>
    board.segment(startAt, startAt, "cube-edge", cubeEdgeLayer));
  const tetraFaces = [0, 1, 2, 3].map(() =>
    board.polygon([startAt, startAt, startAt], "tetra-face", tetraFaceLayer));
  const tetraEdges = Core.EDGES.map(() =>
    board.segment(startAt, startAt, "tetra-edge", tetraEdgeLayer));
  const bimedians = [0, 1, 2].map((i) =>
    board.segment(startAt, startAt, "bimedian bimedian-" + (i + 1), bimedianLayer));
  const edgeDots = [0, 1, 2, 3, 4, 5].map(() =>
    board.point(startAt, "edge-midpoint", 3.5, dotLayer));
  const centerDot = board.point(startAt, "barycenter", 5, dotLayer);
  const cornerLabels = Core.NAMES.map((name) =>
    board.label(startAt, name, "point-label", name === "A" || name === "D" ? -19 : 9,
      name === "A" || name === "B" ? -10 : 17, labelLayer));
  const bimedLabels = [0, 1, 2].map((i) =>
    board.label(startAt, "m" + (i + 1), "bimed-label", 6, -7, labelLayer));

  /** Paint a layer's shapes far first, near last, using the core's depths. */
  function depthOrder(shapes, drawn) {
    const order = shapes.map((shape, i) => ({ shape: shape, depth: drawn[i].depth }));
    order.sort((a, b) => a.depth - b.depth);
    for (const item of order) item.shape.node.parentNode.appendChild(item.shape.node);
  }

  function inside(p) {
    return {
      x: Geom.clamp(p.x, view.x + 18, view.x + view.width - 18),
      y: Geom.clamp(p.y, view.y + 18, view.y + view.height - 18),
    };
  }

  function handleMoved(p, name) {
    const i = Core.NAMES.indexOf(name);
    if (i < 0) return;
    // Keep the corner's depth: dragging moves it in the plane facing us.
    const depth = Core.project(state, state.vertices[i]).depth;
    state = Core.moveVertex(state, name, Core.unproject(state, p, depth));
    render();
  }

  const handles = {};
  for (const name of Core.NAMES) {
    handles[name] = board.handle(name, Core.handlePoint(state, name), {
      r: 9, step: 4, shift: 12, layer: handleLayer,
      clamp: inside,
      label: `Corner ${name}. Drag it, or focus it and use the arrow keys to move the tetrahedron`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)} in the picture`,
      onMove: handleMoved,
    });
  }

  /**
   * The line under the picture. "done" tells the player's record that this
   * illustration has been explored; there is no win or loss in a theorem.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function updateButtons() {
    buttons.cube.setAttribute("aria-pressed", String(state.showCube));
    buttons.cube.textContent = state.showCube ? "Hide cube" : "Show cube";
  }

  function render() {
    const g = Core.geometry(state);

    if (!g) {
      for (const shape of cubeFaces.concat(cubeEdges, tetraFaces, tetraEdges,
        bimedians, edgeDots, [centerDot])) shape.show(false);
      for (const label of cornerLabels.concat(bimedLabels)) label.show(false);
      for (const name of Core.NAMES) handles[name].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state({ vertices: state.vertices, showCube: state.showCube });
      updateButtons();
      return;
    }

    /* Box faces and their 12 edges, sorted so nearer faces cover farther ones. */
    for (let i = 0; i < cubeFaces.length; i++) {
      cubeFaces[i].set(g.cubeFaces[i].points).show(state.showCube);
    }
    depthOrder(cubeFaces, g.cubeFaces);
    for (let i = 0; i < cubeEdges.length; i++) {
      const ids = g.cubeEdges[i];
      const a = Core.project(state, g.box.corners[ids[0]]);
      const b = Core.project(state, g.box.corners[ids[1]]);
      cubeEdges[i].set(a, b).show(state.showCube);
      cubeEdges[i].node.setAttribute("class",
        a.depth + b.depth < 0 ? "cube-edge back" : "cube-edge");
    }

    /* The tetrahedron: four translucent faces, six edges, near ones solid. */
    for (let i = 0; i < tetraFaces.length; i++) tetraFaces[i].set(g.tetraFaces[i].points).show(true);
    depthOrder(tetraFaces, g.tetraFaces);
    for (let i = 0; i < tetraEdges.length; i++) {
      const e = g.edges[i];
      tetraEdges[i].set(e.screenA, e.screenB).show(true);
      tetraEdges[i].node.setAttribute("class",
        e.screenA.depth + e.screenB.depth < 0 ? "tetra-edge back" : "tetra-edge");
    }

    for (let i = 0; i < bimedians.length; i++) {
      const m = g.bimedians[i];
      bimedians[i].set(m.screenA, m.screenB).show(true);
      bimedLabels[i].set({
        x: (m.screenA.x + m.screenB.x) / 2 + 6,
        y: (m.screenA.y + m.screenB.y) / 2 - 7,
      }).show(true);
    }
    for (let i = 0; i < edgeDots.length; i++) {
      const m = g.bimedians[i >> 1];
      const at = (i & 1) ? m.screenB : m.screenA;
      edgeDots[i].set(at).show(true);
    }
    centerDot.set(Core.project(state, g.barycenter)).show(true);

    for (let i = 0; i < Core.NAMES.length; i++) {
      const name = Core.NAMES[i];
      const at = Core.handlePoint(state, name);
      handles[name].set(at).show(true);
      cornerLabels[i].set(at).show(true);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in plain data, for the player's record and the tutor.
    if (window.Track) window.Track.state({
      vertices: state.vertices,
      yaw: state.yaw, pitch: state.pitch, zoom: state.zoom,
      showCube: state.showCube,
      barycenter: g.barycenter,
      bimedians: g.bimedians.map((m) => ({ pair: m.pair, a: m.a, b: m.b })),
      angles: g.angles, claims: g.claims,
    });
    updateButtons();
  }

  function reset() { state = Core.reset(state); render(); }
  function skew() { state = Core.preset(state, "skew"); render(); }
  function cube() { state = Core.setCube(state, !state.showCube); render(); }
  function turn(d) { state = Core.rotate(state, d, 0); render(); }
  function tilt(d) { state = Core.rotate(state, 0, d); render(); }
  function zoom(f) { state = Core.zoomBy(state, f); render(); }

  buttons.reset.addEventListener("click", reset);
  buttons.skew.addEventListener("click", skew);
  buttons.cube.addEventListener("click", cube);
  buttons.turnLeft.addEventListener("click", () => turn(-Math.PI / 12));
  buttons.turnRight.addEventListener("click", () => turn(Math.PI / 12));
  buttons.tiltUp.addEventListener("click", () => tilt(Math.PI / 12));
  buttons.tiltDown.addEventListener("click", () => tilt(-Math.PI / 12));
  buttons.zoomIn.addEventListener("click", () => zoom(1.15));
  buttons.zoomOut.addEventListener("click", () => zoom(1 / 1.15));

  document.addEventListener("keydown", (e) => {
    if (e.target !== document.body) return; // a focused handle keeps its arrows
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "s") skew();
    else if (k === "c") cube();
    else if (k === "[") turn(-Math.PI / 12);
    else if (k === "]") turn(Math.PI / 12);
    else if (k === "-") zoom(1 / 1.15);
    else if (k === "=" || k === "+") zoom(1.15);
    else return;
    e.preventDefault();
  });

  board.onTheme(render);
  render();
})();
