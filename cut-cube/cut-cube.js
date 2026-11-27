"use strict";

/*
 * The page for Cut Cube: drawing and input only; the geometry lives in
 * cut-cube-core.js. The stage is one SVG: a wireframe cube, the applet's
 * quad-shaped plane, and the polygon where they meet. Two Geom handles slide
 * and tilt the plane; dragging the background turns, slides or zooms whatever
 * a radio button or the picked object selects. The four applet radio choices
 * (transparent/opaque, separate/combined) and five cuts from the page are
 * buttons here. There is no win or loss: it is an illustration.
 */

(function () {
  const Core = CutCubeCore;
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const readout = document.getElementById("readout");
  const board = Geom.board(svg);
  const view = board.viewBox;
  const PX = 22;                       // pixels per world unit before outer scale
  const CX = view.x + view.width / 2;
  const CY = view.y + view.height / 2;

  // A fixed, gentle view of 3-space; objects, not the camera, are what move.
  const CAM = Core.multiply(Core.rotationX(-0.55), Core.rotationZ(0.7));
  const CAM_INV = Core.inverse(CAM);
  const RIGHT = Core.applyPoint(CAM_INV, [1, 0, 0]);
  const UP = Core.applyPoint(CAM_INV, [0, 0, 1]);

  const FACES = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];

  const grid = board.layer("grid");
  const faces = board.layer("faces");
  const edges = board.layer("edges");
  const planeLayer = board.layer("plane");
  const sectionLayer = board.layer("section");
  const handleLayer = board.layer("handles");

  const planePoly = board.polygon([{ x: 0, y: 0 }], "plane-face", planeLayer);
  const faceShapes = FACES.map(() => board.polygon([{ x: 0, y: 0 }], "cube-face", faces));
  const edgeShapes = Core.CONST.CUBE_EDGES.map(() => board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "cube-edge", edges));
  const sectionPoly = board.polygon([{ x: 0, y: 0 }], "section-face", sectionLayer);
  const sectionDots = Array.from({ length: 6 }, () => board.point({ x: 0, y: 0 }, "section-dot", 3.4, sectionLayer));

  let state = Core.start({});

  /** Show a line under the board. A demo never sets win/lose/done. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function project(p) {
    const q = Core.applyLinear(CAM, p);
    return { x: CX + PX * q[0], y: CY - PX * q[2], depth: q[1] };
  }

  function pickedTarget(e, fallback) {
    const c = e.target && e.target.getAttribute && e.target.getAttribute("class") || "";
    if (/\bcube-(?:face|edge)\b/.test(c)) return "cube";
    if (/\bplane-face\b/.test(c)) return "plane";
    return fallback;
  }

  function target() {
    return document.querySelector('input[name="target"]:checked').value;
  }

  function move(targetName, delta) {
    state = Core.apply(state, targetName, delta);
    render();
  }

  /* ---- handles: one slides the plane, one turns it, both keyboard friendly */

  const handleAt = { slide: { x: CX, y: CY }, tilt: { x: CX + 70, y: CY } };
  const slide = board.handle("slide", handleAt.slide, {
    r: 11, step: 4, layer: handleLayer, cls: "geom-handle slide-handle",
    label: "Slide the plane. Drag it, or focus it and use the arrow keys.",
    onMove: (q) => {
      const p = handleAt.slide;
      const dx = (q.x - p.x) / PX, dy = -(q.y - p.y) / PX;
      const v = [
        RIGHT[0] * dx + UP[0] * dy, RIGHT[1] * dx + UP[1] * dy, RIGHT[2] * dx + UP[2] * dy,
      ];
      move("plane", Core.translation(v));
    },
  });
  const tilt = board.handle("tilt", handleAt.tilt, {
    r: 10, step: 2, layer: handleLayer, cls: "geom-handle tilt-handle",
    label: "Tilt the plane. Drag it, or focus it and use the arrow keys.",
    onMove: (q) => {
      const p = handleAt.tilt;
      const a = (q.x - p.x) * 0.012, b = -(q.y - p.y) * 0.012;
      move("plane", Core.multiply(Core.rotation(UP, a), Core.rotation(RIGHT, b)));
    },
  });

  /* ---- pointer play on the background, matching the applet's three gestures */

  let drag = null;
  svg.addEventListener("contextmenu", (e) => e.preventDefault());
  svg.addEventListener("pointerdown", (e) => {
    if (e.target.closest && e.target.closest(".geom-handle")) return;
    const at = board.toLocal(e.clientX, e.clientY);
    drag = {
      x: at.x, y: at.y, target: pickedTarget(e, target()),
      kind: e.button === 2 ? "translate" : e.altKey ? "zoom" : "rotate",
    };
    if (svg.setPointerCapture) svg.setPointerCapture(e.pointerId);
    svg.focus();
    e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const at = board.toLocal(e.clientX, e.clientY);
    const dx = at.x - drag.x, dy = at.y - drag.y;
    drag.x = at.x; drag.y = at.y;
    if (drag.kind === "rotate") {
      move(drag.target, Core.multiply(
        Core.rotation(UP, dx * 0.009), Core.rotation(RIGHT, -dy * 0.009),
      ));
    } else if (drag.kind === "translate") {
      const a = dx / PX, b = -dy / PX;
      move(drag.target, Core.translation([
        RIGHT[0] * a + UP[0] * b, RIGHT[1] * a + UP[1] * b, RIGHT[2] * a + UP[2] * b,
      ]));
    } else {
      move(drag.target, Core.scaling(Math.exp(-dy * 0.012)));
    }
    e.preventDefault();
  });
  const stopDrag = () => { drag = null; };
  svg.addEventListener("pointerup", stopDrag);
  svg.addEventListener("pointercancel", stopDrag);
  svg.addEventListener("lostpointercapture", stopDrag);

  /* ---- keyboard play: focus the board, then arrows, +/- and , / . */

  svg.addEventListener("keydown", (e) => {
    if (e.target !== svg) return;              // the handles own their arrow keys
    const k = e.shiftKey ? 0.2 : 0.08;
    const which = target();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      move(which, Core.rotation(UP, (e.key === "ArrowLeft" ? -1 : 1) * k));
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      move(which, Core.rotation(RIGHT, (e.key === "ArrowUp" ? -1 : 1) * k));
    } else if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") {
      move(which, Core.scaling(e.key === "-" || e.key === "_" ? 1 / 1.2 : 1.2));
    } else if (e.key === "," || e.key === ".") {
      const n = Core.snapshot(state).normal;
      move("plane", Core.translation(n.map((v) => v * (e.key === "," ? -0.5 : 0.5))));
    } else return;
    e.preventDefault();
  });

  /* ---- controls: the applet's two radio pairs and the page's five cuts ---- */

  document.querySelectorAll('input[name="style"]').forEach((r) => r.addEventListener("change", () => {
    if (r.checked) { state = Core.setStyle(state, r.value); render(); }
  }));
  document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", () => {
    if (r.checked) { state = Core.setMode(state, r.value); render(); }
  }));
  document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    state = Core.preset(state, b.dataset.preset);
    document.querySelector('input[name="mode"][value="separate"]').checked = true;
    render();
    b.focus();
  }));
  document.getElementById("resetBtn").addEventListener("click", () => {
    state = Core.start({});
    document.querySelector('input[name="mode"][value="separate"]').checked = true;
    document.querySelector('input[name="style"][value="transparent"]').checked = true;
    document.querySelector('input[name="target"][value="cube"]').checked = true;
    render();
  });
  document.querySelectorAll('input[name="target"]').forEach((r) => r.addEventListener("change", render));

  function render() {
    const snap = Core.snapshot(state);
    const P = snap.cubePoints.map(project);
    FACES.forEach((face, i) => {
      faceShapes[i].set(face.map((j) => ({ x: P[j].x, y: P[j].y })));
    });
    Core.CONST.CUBE_EDGES.forEach(([a, b], i) => {
      const hidden = (P[a].depth + P[b].depth) / 2 > 0;
      edgeShapes[i].set({ x: P[a].x, y: P[a].y }, { x: P[b].x, y: P[b].y });
      edgeShapes[i].node.classList.toggle("hidden-edge", hidden);
    });
    planePoly.set(snap.planeCorners.map(project));
    planePoly.node.classList.toggle("opaque", state.style === "opaque");
    sectionPoly.set(snap.section.map(project));
    sectionPoly.show(snap.section.length > 2);
    sectionDots.forEach((dot, i) => {
      dot.show(i < snap.section.length);
      if (i < snap.section.length) {
        const p = project(snap.section[i]);
        dot.set({ x: p.x, y: p.y });
      }
    });

    const mid = snap.planeCorners.reduce((s, p) => [
      s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4,
    ], [0, 0, 0]);
    const centre = project(mid);
    handleAt.slide = { x: centre.x, y: centre.y };
    handleAt.tilt = { x: centre.x, y: centre.y - 58 };
    slide.set(handleAt.slide);
    tilt.set(handleAt.tilt);

    const shape = Core.classify(snap.section);
    const words = snap.section.length > 2
      ? `The plane cuts the cube in ${shape} (${snap.section.length} sides).`
      : "The plane misses the cube: move it closer for a cut.";
    say(words);
    readout.textContent = words + " " + (state.combined
      ? "Combined: moving the plane carries the cube with it."
      : "Separate: the plane and cube move on their own.");
    document.querySelector('input[name="mode"][value="' + (state.combined ? "combined" : "separate") + '"]').checked = true;
    document.querySelector('input[name="style"][value="' + state.style + '"]').checked = true;

    // The plain position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state({
      cube: state.cube, plane: state.plane, combined: state.combined,
      style: state.style, section: snap.section,
    });
  }

  board.onTheme(render);
  render();
})();
