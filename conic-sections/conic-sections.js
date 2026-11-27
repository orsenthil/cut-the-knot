"use strict";

/*
 * Conic Sections: drawing and input only. The algebra lives in
 * conic-sections-core.js. The left half of the board is the side view of the
 * double cone and its cutting plane; the right half shows the section in the
 * plane's own coordinates. Dragging the tilt dot or the plane dot, using the
 * sliders, or pressing a preset all change the same plain-data state. There is
 * no win and no loss: this is an illustration of the page's angle comparison.
 */

(() => {
  const Core = ConicSectionsCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const betaRange = document.getElementById("betaRange");
  const offsetRange = document.getElementById("offsetRange");
  const betaOut = document.getElementById("betaOut");
  const offsetOut = document.getElementById("offsetOut");
  const opaqueBtn = document.getElementById("opaqueBtn");
  const linkBtn = document.getElementById("linkBtn");
  const familyOut = document.getElementById("familyOut");

  let state = Core.start({});

  /* The left panel uses cone units: x along the axis, y up. */
  const O = { x: 160, y: 175 };
  const S = 10;
  const PIVOT = { x: 52, y: 78 };
  const ARC_R = 38;
  const TILT_MAX = Core.MAX_BETA;
  const toScreen = (p) => ({ x: O.x + S * p.x, y: O.y - S * p.y });
  const toUnits = (p) => ({ x: (p.x - O.x) / S, y: (O.y - p.y) / S });
  const arcPoint = (deg) => ({
    x: PIVOT.x + ARC_R * Math.sin(Core.radians(deg)),
    y: PIVOT.y - ARC_R * Math.cos(Core.radians(deg)),
  });

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Paint order: guides, cone, plane, curve, labels, then the handles. */
  const guides = board.layer("guides");
  const coneLayer = board.layer("cone");
  const planeLayer = board.layer("plane");
  const curveLayer = board.layer("curve");
  const textLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const axis = board.segment({ x: 14, y: O.y }, { x: 306, y: O.y }, "axis", guides);
  const baseL = board.segment(toScreen({ x: -Core.CONE_HEIGHT, y: -Core.CONE_RADIUS }),
    toScreen({ x: -Core.CONE_HEIGHT, y: Core.CONE_RADIUS }), "base-mark", guides);
  const baseR = board.segment(toScreen({ x: Core.CONE_HEIGHT, y: -Core.CONE_RADIUS }),
    toScreen({ x: Core.CONE_HEIGHT, y: Core.CONE_RADIUS }), "base-mark", guides);
  const arcNode = board.el("path", null, "tilt-arc", guides);
  const pivotDot = board.point(PIVOT, "pivot", 3, guides);

  const nappeL = board.polygon([], "nappe", coneLayer);
  const nappeR = board.polygon([], "nappe", coneLayer);
  const generators = [];
  for (let i = 0; i < 4; i++) generators.push(board.segment(O, O, "generator", coneLayer));
  const apex = board.point(O, "apex", 4, coneLayer);

  const planeLine = board.segment(O, O, "plane-line", planeLayer);
  const planeBand = board.polygon([], "plane-band", planeLayer);
  const positionDot = board.point(O, "position-dot", 5, planeLayer);

  const curveAxesH = board.segment({ x: 350, y: O.y }, { x: 614, y: O.y }, "curve-axis", guides);
  const curveAxesV = board.segment({ x: 482, y: 38 }, { x: 482, y: 312 }, "curve-axis", guides);
  const curveA = board.el("path", null, "curve", curveLayer);
  const curveB = board.el("path", null, "curve curve-b", curveLayer);
  const sectionDot = board.point(O, "section-vertex", 4, curveLayer);

  const labelTilt = board.label(arcPoint(0), "tilt", "small-label", -6, -12, textLayer);
  const labelCone = board.label({ x: 268, y: O.y + 8 }, "cone", "small-label", 0, 0, textLayer);
  const labelPlane = board.label(toScreen({ x: 5, y: 7 }), "cut", "small-label", 4, -4, textLayer);
  const labelCurve = board.label({ x: 480, y: 32 }, "", "curve-title", 0, 0, textLayer);
  const labelHint = board.label({ x: 482, y: 326 }, "the cut, seen flat", "small-label", 0, 0, textLayer);

  /* Arc guide from 0 to the largest allowed tilt. */
  {
    let d = "";
    for (let i = 0; i <= 32; i++) {
      const p = arcPoint((TILT_MAX * i) / 32);
      d += (i ? " L " : "M ") + p.x.toFixed(2) + " " + p.y.toFixed(2);
    }
    arcNode.setAttribute("d", d);
  }

  /* The tilt dot lives on its arc; only its x/y on the arc matter. */
  const tiltHandle = board.handle("tilt", arcPoint(state.beta), {
    r: 14, step: 4, shift: 12, cls: "geom-handle", layer: handleLayer,
    label: "Plane tilt. Drag around the arc, or focus and use the arrow keys, to tilt the cutting plane",
    describe: () => `now ${Core.analyse(state).beta.toFixed(1)} degrees`,
    clamp: (q) => {
      let deg = Math.atan2(q.x - PIVOT.x, PIVOT.y - q.y) * 180 / Math.PI;
      deg = Core.clamp(deg, 0, TILT_MAX);
      return arcPoint(deg);
    },
    onMove: (p) => {
      const deg = Core.clamp(Math.atan2(p.x - PIVOT.x, PIVOT.y - p.y) * 180 / Math.PI, 0, TILT_MAX);
      state = Core.setBeta(state, deg);
      render();
    },
  });

  /* The plane dot slides along the axis, changing the distance from the vertex. */
  const offsetHandle = board.handle("position", toScreen({ x: state.offset, y: 0 }), {
    r: 14, step: 4, shift: 12, cls: "geom-handle", layer: handleLayer,
    label: "Plane position. Drag sideways, or focus and use the left and right arrow keys, to move the plane along the cone",
    describe: () => `plane ${Core.analyse(state).offset.toFixed(1)} units from the vertex`,
    clamp: (q) => {
      const d = Core.clamp(toUnits(q).x, Core.MIN_OFFSET, Core.MAX_OFFSET);
      return toScreen({ x: d, y: 0 });
    },
    onMove: (p) => {
      state = Core.setOffset(state, toUnits(p).x);
      render();
    },
  });

  /** Screen path for one or two branches of the section, fitted to the panel. */
  function drawCurve(lines) {
    const all = lines.reduce((acc, line) => acc.concat(line), []);
    if (!all.length) {
      curveA.setAttribute("d", "");
      curveB.setAttribute("d", "");
      return;
    }
    const us = all.map((p) => p.u), vs = all.map((p) => p.v);
    const minU = Math.min(...us), maxU = Math.max(...us);
    const minV = Math.min(...vs), maxV = Math.max(...vs);
    const scale = Math.min(9, 128 / Math.max(maxU - minU, 1e-6), 108 / Math.max(maxV - minV, 1e-6));
    const midU = (minU + maxU) / 2, midV = (minV + maxV) / 2;
    const map = (p) => ({ x: 482 + (p.u - midU) * scale, y: O.y - (p.v - midV) * scale });
    const path = (line) => line.map((p, i) => {
      const q = map(p);
      return (i ? " L " : "M ") + q.x.toFixed(2) + " " + q.y.toFixed(2);
    }).join("");
    curveA.setAttribute("d", lines[0] ? path(lines[0]) : "");
    curveB.setAttribute("d", lines[1] ? path(lines[1]) : "");
    curveB.style.display = lines[1] ? "" : "none";
    const vertex = map({ u: 0, v: 0 });
    sectionDot.set(vertex);
    sectionDot.show(vertex.x > 350 && vertex.x < 614 && vertex.y > 38 && vertex.y < 312);
  }

  function render() {
    const a = Core.analyse(state);
    const label = Core.describe(state);

    const rimTopL = toScreen({ x: -Core.CONE_HEIGHT, y: Core.CONE_RADIUS });
    const rimBottomL = toScreen({ x: -Core.CONE_HEIGHT, y: -Core.CONE_RADIUS });
    const rimTopR = toScreen({ x: Core.CONE_HEIGHT, y: Core.CONE_RADIUS });
    const rimBottomR = toScreen({ x: Core.CONE_HEIGHT, y: -Core.CONE_RADIUS });
    nappeL.set([O, rimTopL, rimBottomL]);
    nappeR.set([O, rimTopR, rimBottomR]);
    [rimTopL, rimBottomL, rimTopR, rimBottomR].forEach((p, i) => generators[i].set(O, p));

    const seg = Core.planeSegment(state, { xMin: -14, xMax: 14, yMin: -8, yMax: 8 });
    if (seg) {
      const s = Math.tan(Core.radians(state.beta));
      const a1 = toScreen(seg[0]), a2 = toScreen(seg[1]);
      planeLine.set(a1, a2);
      planeLine.node.setAttribute("class", state.transparent ? "plane-line" : "plane-line solid");
      const half = 7;
      planeBand.set([
        { x: a1.x - half * s, y: a1.y - half },
        { x: a2.x - half * s, y: a2.y - half },
        { x: a2.x + half * s, y: a2.y + half },
        { x: a1.x + half * s, y: a1.y + half },
      ]);
      planeBand.node.setAttribute("class", state.transparent ? "plane-band" : "plane-band solid");
      labelPlane.set({ x: a2.x, y: a2.y }, "cut");
    }

    drawCurve(Core.sectionPoints(a, 80));
    labelCurve.set({ x: 480, y: 32 }, label.title);

    tiltHandle.set(arcPoint(state.beta));
    offsetHandle.set(toScreen({ x: state.offset, y: 0 }));
    labelTilt.set(arcPoint(0), "tilt");

    betaRange.value = String(state.beta);
    offsetRange.value = String(state.offset);
    betaOut.textContent = `${state.beta.toFixed(1)}\u00b0`;
    offsetOut.textContent = state.offset.toFixed(1);
    opaqueBtn.textContent = state.transparent ? "Show plane as opaque" : "Show plane as transparent";
    opaqueBtn.setAttribute("aria-pressed", String(!state.transparent));
    linkBtn.textContent = state.linked ? "Objects move together" : "Move objects separately";
    linkBtn.setAttribute("aria-pressed", String(state.linked));
    familyOut.textContent = label.title + (a.detail && a.detail !== label.title
      ? ` (${a.detail})` : "");

    say(label.text, null);
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  betaRange.addEventListener("input", () => {
    state = Core.setBeta(state, Number(betaRange.value));
    render();
  });
  offsetRange.addEventListener("input", () => {
    state = Core.setOffset(state, Number(offsetRange.value));
    render();
  });
  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state = Core.preset(state, btn.dataset.preset);
      render();
    });
  });
  opaqueBtn.addEventListener("click", () => {
    state = Core.toggleTransparent(state);
    render();
  });
  linkBtn.addEventListener("click", () => {
    state = Core.toggleLinked(state);
    render();
  });
  document.getElementById("newBtn").addEventListener("click", () => {
    state = Core.start({ transparent: state.transparent, linked: state.linked });
    render();
  });

  board.onTheme(render);
  render();
})();
