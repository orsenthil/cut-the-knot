"use strict";

/*
 * The page for Hinged Tessellation 2: drawing and input only. All geometry,
 * hinge constraints, layers and colours come from hinged-tessellation-2-core.js.
 *
 * The SVG shows the motif built on the draggable hinge triangle A-B-C and as
 * many translated copies as the Layers control asks for. A, B and C are real
 * focusable handles; D and the squares are computed. Nothing is won or lost:
 * the status line says which polygon arrangement the current hinge makes.
 */

(function () {
  const Core = HingedTessellation2Core;
  const board = Geom.board(document.getElementById("board"));
  const view = board.viewBox;
  const statusEl = document.getElementById("status");
  const layersInput = document.getElementById("layersInput");
  const layersOut = document.getElementById("layersOut");
  const oneColor = document.getElementById("oneColor");
  const twoColors = document.getElementById("twoColors");
  const colorLayers = document.getElementById("colorLayers");
  const lockHinges = document.getElementById("lockHinges");
  const regularBtn = document.getElementById("regularBtn");
  const squareBtn = document.getElementById("squareBtn");
  const newBtn = document.getElementById("newBtn");

  let state = Core.start();

  const fillsLayer = board.layer("fills");
  const strokesLayer = board.layer("strokes");
  const guidesLayer = board.layer("guides");
  const handlesLayer = board.layer("handles");
  const triPool = [];
  const edgePool = [];

  /** A pooled <path> wrapper, so a motif's 26 edges are one SVG element. */
  function makeEdgePath() {
    const node = board.el("path", null, "motif-edge", strokesLayer);
    const api = {
      node: node,
      set: function (edges) {
        node.setAttribute("d", edges.map((e) =>
          "M " + e[0].x + " " + e[0].y + " L " + e[1].x + " " + e[1].y).join(" "));
        return api;
      },
      show: function (on) { node.style.display = on ? "" : "none"; return api; },
    };
    return api;
  }

  /* Marks that stay on the base motif: two square corners and one triangle angle. */
  const corner1 = board.rightAngle(state.A, state.B, state.C, 11, "corner-mark", guidesLayer);
  const corner2 = board.rightAngle(state.A, state.C, state.B, 11, "corner-mark", guidesLayer);
  const apexArc = board.angleArc(state.A, state.B, state.C, 20, "angle-arc", guidesLayer);

  const hingeEdges = [
    board.segment(state.A, state.B, "hinge-edge", guidesLayer),
    board.segment(state.B, state.C, "hinge-edge", guidesLayer),
    board.segment(state.C, state.C, "hinge-edge", guidesLayer),
    board.segment(state.C, state.A, "hinge-edge", guidesLayer),
    board.segment(state.A, state.C, "hinge-diagonal", guidesLayer),
  ];
  const dDot = board.point(state.A, "d-dot", 5, guidesLayer);
  const labels = [
    board.label(state.A, "A", "point-label", -19, -12, guidesLayer),
    board.label(state.B, "B", "point-label", 10, -12, guidesLayer),
    board.label(state.C, "C", "point-label", -19, 23, guidesLayer),
    board.label(state.A, "D", "point-label", -19, 23, guidesLayer),
  ];

  /** Show a line under the board; a demo has no win or loss to announce. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function onScreen(motif) {
    const pts = motif.triangles.reduce((all, t) => all.concat(t.points), []);
    const pad = 6;
    return Math.max(...pts.map((p) => p.x)) >= view.x - pad &&
      Math.min(...pts.map((p) => p.x)) <= view.x + view.width + pad &&
      Math.max(...pts.map((p) => p.y)) >= view.y - pad &&
      Math.min(...pts.map((p) => p.y)) <= view.y + view.height + pad;
  }

  const modeName = ["one colour", "two colours", "colour bands"];

  function render() {
    const pattern = Core.tessellate(state);
    const base = pattern.base;

    let used = 0;
    for (const motif of pattern.motifs) {
      if (!onScreen(motif)) continue;
      for (let k = 0; k < motif.triangles.length; k++) {
        let tri = triPool[used];
        if (!tri) {
          tri = board.polygon(motif.triangles[k].points, "tri", fillsLayer);
          triPool.push(tri);
        }
        tri.node.setAttribute("class", "tri tri-c" + motif.triangles[k].color);
        tri.set(motif.triangles[k].points);
        tri.show(true);
        used++;
      }
      let path = edgePool[used / 8 - 1];
      if (!path) {
        path = makeEdgePath();
        edgePool.push(path);
      }
      path.set(motif.edges);
      path.show(true);
    }
    for (let i = used; i < triPool.length; i++) triPool[i].show(false);
    for (let i = Math.ceil(used / 8); i < edgePool.length; i++) edgePool[i].show(false);

    const corners = [state.A, state.B, state.C, base.D];
    for (let i = 0; i < 4; i++) hingeEdges[i].set(corners[i], corners[(i + 1) % 4]);
    hingeEdges[4].set(state.A, state.C);
    dDot.set(base.D);
    labels[0].set(state.A);
    labels[1].set(state.B);
    labels[2].set(state.C);
    labels[3].set(base.D);
    corner1.set(state.A, state.B, base.L, 11);
    corner2.set(state.A, base.D, base.K, 11);
    apexArc.set(state.A, state.B, state.C, 20);

    hA.set(state.A);
    hB.set(state.B);
    hC.set(state.C);

    if (String(layersInput.value) !== String(state.layers)) layersInput.value = String(state.layers);
    layersOut.textContent = String(state.layers);
    if (lockHinges.checked !== !state.loose) lockHinges.checked = !state.loose;

    const v = Core.vertexAngles(state.A, state.B, state.C);
    let arrangement;
    if (Math.abs(v.apex - 60) < 0.5) {
      arrangement = "Semi-regular (4,3,3,4,3): at A, square, triangle, triangle, square, triangle fill 360°.";
    } else if (Math.abs(v.apex - 90) < 0.5) {
      arrangement = "Square derivative (4,4,4,4): the triangles opened to 45°–45°–90°, so pairs make squares.";
    } else {
      arrangement = `Hinges at ${v.apex.toFixed(0)}°: the squares are still square and the five angles still fill 360°.`;
    }
    const count = pattern.motifs.length;
    say(`${arrangement} Showing ${count} ${count === 1 ? "motif" : "motifs"} at ${state.layers} ` +
      `${state.layers === 1 ? "layer" : "layers"} in ${modeName[state.colorMode]}; ` +
      `${state.loose ? "loose" : "locked"} hinges.`);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function movePoint(name, p) {
    state = Core.withPoint(state, name, p);
    render();
  }

  const clampPoint = (p, name) => Core.constrainPoint(state, name, p);
  const describe = (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`;
  const handleLabel = (name) => "Point " + name +
    ". Drag, or focus it and use the arrow keys to move this hinge.";

  const hA = board.handle("A", state.A, {
    r: 13, step: 4, shift: 16, layer: handlesLayer, clamp: clampPoint,
    label: handleLabel("A"), describe: describe, onMove: (p) => movePoint("A", p),
  });
  const hB = board.handle("B", state.B, {
    r: 13, step: 4, shift: 16, layer: handlesLayer, clamp: clampPoint,
    label: handleLabel("B"), describe: describe, onMove: (p) => movePoint("B", p),
  });
  const hC = board.handle("C", state.C, {
    r: 13, step: 4, shift: 16, layer: handlesLayer, clamp: clampPoint,
    label: handleLabel("C"), describe: describe, onMove: (p) => movePoint("C", p),
  });

  function chooseMode(mode) {
    state = Core.withOption(state, "colorMode", mode);
    render();
  }

  layersInput.addEventListener("input", () => {
    state = Core.withOption(state, "layers", Number(layersInput.value));
    render();
  });
  oneColor.addEventListener("change", () => { if (oneColor.checked) chooseMode(0); });
  twoColors.addEventListener("change", () => { if (twoColors.checked) chooseMode(1); });
  colorLayers.addEventListener("change", () => { if (colorLayers.checked) chooseMode(2); });
  lockHinges.addEventListener("change", () => {
    state = Core.withOption(state, "loose", !lockHinges.checked);
    render();
  });
  regularBtn.addEventListener("click", () => {
    state = Core.withApex(state, 60);
    render();
    hA.node.focus();
  });
  squareBtn.addEventListener("click", () => {
    state = Core.withApex(state, 90);
    render();
    hA.node.focus();
  });
  newBtn.addEventListener("click", () => {
    const opts = {
      layers: state.layers, colorMode: state.colorMode, loose: state.loose,
      width: state.width, height: state.height,
    };
    state = Core.start(opts);
    render();
    hA.node.focus();
  });
  document.addEventListener("keydown", (e) => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") newBtn.click();
    if (e.key === "1") regularBtn.click();
    if (e.key === "2") squareBtn.click();
  });

  board.onTheme(render);
  render();
})();
