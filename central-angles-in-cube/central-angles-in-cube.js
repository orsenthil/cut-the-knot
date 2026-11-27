"use strict";

/*
 * Central Angles In Cube — drawing and input only. The geometry, the central
 * angles and the orthographic projection live in central-angles-in-cube-core.js.
 *
 * The SVG is a flat picture of the applet's 3-D scene: a transparent cube, the
 * centre O, three draggable points P, Q, R (the applet's P1, P2, P3), and the
 * two groups of segments the applet's checkboxes turn on. The obtuse group
 * draws the triangle O P Q; the acute group draws the two rays O Q and O R.
 * Faces are painted far first, using the core's depth, so the cube can be
 * turned and tilted without losing its 3-D reading.
 */

(function () {
  const Core = CentralAnglesInCubeCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const view = board.viewBox;
  let state = Core.start();

  const buttons = {
    none: document.getElementById("noneBtn"),
    obtuse: document.getElementById("obtuseBtn"),
    acute: document.getElementById("acuteBtn"),
    both: document.getElementById("bothBtn"),
    reset: document.getElementById("resetBtn"),
    snap: document.getElementById("snapBtn"),
    tetra: document.getElementById("tetraBtn"),
    turnLeft: document.getElementById("turnLeft"),
    turnRight: document.getElementById("turnRight"),
    tiltUp: document.getElementById("tiltUp"),
    tiltDown: document.getElementById("tiltDown"),
    zoomIn: document.getElementById("zoomIn"),
    zoomOut: document.getElementById("zoomOut"),
  };

  /* Layers, back to front. Handles are last so a redraw keeps their focus. */
  const faceLayer = board.layer("cube-faces");
  const edgeLayer = board.layer("cube-edges");
  const tetraLayer = board.layer("tetra-edges");
  const rayLayer = board.layer("rays");
  const arcLayer = board.layer("arcs");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const startAt = { x: view.x + 20, y: view.y + 20 };
  const pairsTetra = [[0, 2], [0, 5], [0, 7], [2, 5], [2, 7], [5, 7]];

  /* Every shape is made once and only updated on a redraw. */
  const cubeFaces = [0, 1, 2, 3, 4, 5].map(() =>
    board.polygon([startAt, startAt, startAt, startAt], "cube-face", faceLayer));
  const cubeEdges = Array.from({ length: 12 }, () =>
    board.segment(startAt, startAt, "cube-edge", edgeLayer));
  const tetraEdges = pairsTetra.map(() =>
    board.segment(startAt, startAt, "tetra-edge", tetraLayer));
  const rays = [0, 1, 2, 3, 4].map((i) =>
    board.segment(startAt, startAt, "ray ray-" + i, rayLayer));
  const obtuseArc = board.angleArc(startAt, startAt, startAt, 28, "angle-arc angle-arc-obtuse", arcLayer);
  const acuteArc = board.angleArc(startAt, startAt, startAt, 28, "angle-arc angle-arc-acute", arcLayer);
  const centreDot = board.point(startAt, "centre-dot", 5, dotLayer);
  const centreLabel = board.label(startAt, "O", "point-label", -15, 18, labelLayer);
  const pointDots = Core.HANDLES.map(() => board.point(startAt, "ray-end", 4, dotLayer));
  const pointLabels = Core.HANDLES.map((name) =>
    board.label(startAt, name, "point-label", 10, -10, labelLayer));
  const angleLabels = [
    board.label(startAt, "", "angle-label angle-label-obtuse", 0, 0, labelLayer),
    board.label(startAt, "", "angle-label angle-label-acute", 0, 0, labelLayer),
  ];
  const vertexLabels = Core.NAMES.map((name) =>
    board.label(startAt, name, "vertex-label", 7, -6, labelLayer));

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
    // Keep the point's depth: dragging moves it in the plane facing us.
    const depth = Core.project(state, state.points[name]).depth;
    state = Core.movePoint(state, name, Core.unproject(state, p, depth));
    render();
  }

  const handles = {};
  for (const name of Core.HANDLES) {
    handles[name] = board.handle(name, Core.handlePoint(state, name), {
      r: 9, step: 4, shift: 12, layer: handleLayer,
      clamp: inside,
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to move the rays`,
      describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y) + " in the picture",
      onMove: handleMoved,
    });
  }

  /** Where to park the number on an angle arc, along the two rays' bisector. */
  function bisector(v, a, b, radius) {
    const va = { x: a.x - v.x, y: a.y - v.y };
    const vb = { x: b.x - v.x, y: b.y - v.y };
    const na = Math.hypot(va.x, va.y) || 1;
    const nb = Math.hypot(vb.x, vb.y) || 1;
    let dx = va.x / na + vb.x / nb, dy = va.y / na + vb.y / nb;
    const l = Math.hypot(dx, dy);
    if (l < 1e-6) { dx = -va.y / na; dy = va.x / na; }
    else { dx /= l; dy /= l; }
    return { x: v.x + dx * radius, y: v.y + dy * radius };
  }

  /**
   * Shows a line under the picture. "done" tells the player's record that this
   * illustration has been explored; there is no win or loss in a theorem.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function updateButtons() {
    for (const mode of ["none", "obtuse", "acute", "both"]) {
      buttons[mode].setAttribute("aria-pressed", String(state.mode === mode));
    }
    buttons.snap.setAttribute("aria-pressed", String(state.snap));
    buttons.snap.textContent = state.snap ? "Snap to corners" : "Free drag";
    buttons.tetra.setAttribute("aria-pressed", String(state.showTetra));
    buttons.tetra.textContent = state.showTetra ? "Hide tetrahedron" : "Show tetrahedron";
  }

  function render() {
    const g = Core.geometry(state);

    if (!g) {
      for (const shape of cubeFaces.concat(cubeEdges, tetraEdges, rays,
        [obtuseArc, acuteArc, centreDot, centreLabel], pointDots, pointLabels, angleLabels, vertexLabels)) {
        shape.show(false);
      }
      for (const name of Core.HANDLES) handles[name].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state({ points: state.points, mode: state.mode });
      updateButtons();
      return;
    }

    /* The transparent cube, its twelve edges, then the optional tetrahedron. */
    for (let i = 0; i < cubeFaces.length; i++) {
      cubeFaces[i].set(g.cubeFaces[i].points).show(true);
    }
    depthOrder(cubeFaces, g.cubeFaces);
    for (let i = 0; i < cubeEdges.length; i++) {
      const ids = g.cubeEdges[i].indices;
      const a = Core.project(state, g.vertices[ids[0]]);
      const b = Core.project(state, g.vertices[ids[1]]);
      cubeEdges[i].set(a, b).show(true);
      cubeEdges[i].node.setAttribute("class",
        a.depth + b.depth < 0 ? "cube-edge back" : "cube-edge");
    }
    for (let i = 0; i < tetraEdges.length; i++) {
      const ids = pairsTetra[i];
      const a = Core.project(state, g.vertices[ids[0]]);
      const b = Core.project(state, g.vertices[ids[1]]);
      tetraEdges[i].set(a, b).show(state.showTetra);
      tetraEdges[i].node.setAttribute("class",
        a.depth + b.depth < 0 ? "tetra-edge back" : "tetra-edge");
    }

    /* The five segments of the applet, including the duplicate S1/S2 ray. */
    const showObtuse = state.mode === "obtuse" || state.mode === "both";
    const showAcute = state.mode === "acute" || state.mode === "both";
    for (let i = 0; i < rays.length; i++) {
      const inObtuse = g.groups.obtuse.indexOf(i) >= 0;
      const inAcute = g.groups.acute.indexOf(i) >= 0;
      const on = (inObtuse && showObtuse) || (inAcute && showAcute);
      rays[i].set(Core.project(state, g.segments[i].a),
        Core.project(state, g.segments[i].b)).show(on);
      rays[i].node.setAttribute("class",
        "ray ray-" + i + (inObtuse ? " ray-obtuse" : " ray-acute"));
    }

    /* The coloured angle arcs at O and their numbers. */
    const o = g.screen.O;
    obtuseArc.set(o, g.screen.P, g.screen.Q, 28).show(showObtuse && !g.claims.degenerate);
    acuteArc.set(o, g.screen.Q, g.screen.R, 34).show(showAcute && !g.claims.degenerate);
    angleLabels[0].set(bisector(o, g.screen.P, g.screen.Q, 44),
      Math.round(g.obtuseDeg) + "°").show(showObtuse && !g.claims.degenerate);
    angleLabels[1].set(bisector(o, g.screen.Q, g.screen.R, 52),
      Math.round(g.acuteDeg) + "°").show(showAcute && !g.claims.degenerate);

    centreDot.set(o).show(true);
    centreLabel.set(o).show(true);
    for (let i = 0; i < Core.HANDLES.length; i++) {
      const name = Core.HANDLES[i];
      const at = g.screen[name];
      pointDots[i].set(at).show(true);
      pointLabels[i].set(at).show(true);
      handles[name].set(at).show(true);
    }
    for (let i = 0; i < vertexLabels.length; i++) {
      vertexLabels[i].set(g.vertexLabels[i].at).show(true);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in plain data, for the player's record and the tutor.
    if (window.Track) window.Track.state({
      side: g.measures.side, points: { P: g.P, Q: g.Q, R: g.R },
      mode: state.mode, snap: state.snap, showTetra: state.showTetra,
      yaw: state.yaw, pitch: state.pitch, zoom: state.zoom,
      vertexNames: g.vertexNames, segments: g.segments,
      angles: { obtuse: g.obtuseDeg, acute: g.acuteDeg },
      cosines: { obtuse: g.obtuseCos, acute: g.acuteCos },
      claims: g.claims,
    });
    updateButtons();
  }

  function setMode(mode) { state = Core.setMode(state, mode); render(); }
  function reset() { state = Core.reset(state); render(); }
  function snap() { state = Core.setSnap(state, !state.snap); render(); }
  function tetra() { state = Core.setTetra(state, !state.showTetra); render(); }
  function turn(d) { state = Core.rotate(state, d, 0); render(); }
  function tilt(d) { state = Core.rotate(state, 0, d); render(); }
  function zoom(f) { state = Core.zoomBy(state, f); render(); }

  buttons.none.addEventListener("click", () => setMode("none"));
  buttons.obtuse.addEventListener("click", () => setMode("obtuse"));
  buttons.acute.addEventListener("click", () => setMode("acute"));
  buttons.both.addEventListener("click", () => setMode("both"));
  buttons.reset.addEventListener("click", reset);
  buttons.snap.addEventListener("click", snap);
  buttons.tetra.addEventListener("click", tetra);
  buttons.turnLeft.addEventListener("click", () => turn(-Math.PI / 12));
  buttons.turnRight.addEventListener("click", () => turn(Math.PI / 12));
  buttons.tiltUp.addEventListener("click", () => tilt(Math.PI / 12));
  buttons.tiltDown.addEventListener("click", () => tilt(-Math.PI / 12));
  buttons.zoomIn.addEventListener("click", () => zoom(1.15));
  buttons.zoomOut.addEventListener("click", () => zoom(1 / 1.15));

  document.addEventListener("keydown", (e) => {
    if (e.target !== document.body) return; // a focused handle keeps its arrows
    const k = e.key.toLowerCase();
    if (k === "1") setMode("none");
    else if (k === "2") setMode("obtuse");
    else if (k === "3") setMode("acute");
    else if (k === "4") setMode("both");
    else if (k === "r") reset();
    else if (k === "s") snap();
    else if (k === "t") tetra();
    else if (k === "[") turn(-Math.PI / 12);
    else if (k === "]") turn(Math.PI / 12);
    else if (k === ",") tilt(-Math.PI / 12);
    else if (k === ".") tilt(Math.PI / 12);
    else if (k === "-") zoom(1 / 1.15);
    else if (k === "=" || k === "+") zoom(1.15);
    else return;
    e.preventDefault();
  });

  board.onTheme(render);
  render();
})();
