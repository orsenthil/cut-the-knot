"use strict";

/*
 * Cut the Cylinder: drawing and input only; the maths is in
 * cut-cylinder-core.js. The left of the board is a side view of the cylinder
 * with its moving sheet; the right shows the cut face-on. The two handles,
 * the sliders and the preset buttons all change the same plain-data position.
 * There is no win and no loss: this is an illustration of the page's claim.
 */

(() => {
  const Core = CutCylinderCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const tiltRange = document.getElementById("tiltRange");
  const offsetRange = document.getElementById("offsetRange");
  const tiltOut = document.getElementById("tiltOut");
  const offsetOut = document.getElementById("offsetOut");
  const opaqueBtn = document.getElementById("opaqueBtn");
  const linkBtn = document.getElementById("linkBtn");
  const familyOut = document.getElementById("familyOut");

  let state = Core.start({});

  /**
   * Shows a line under the picture. `kind` is "win", "lose", "done" or
   * nothing; those three classes tell the player's record a play has ended.
   * An illustration never ends, so every message here has no kind.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Screen units: the cylinder is 18 long and 12 thick in the side view. */
  const O = { x: 165, y: 170 };
  const S = 10;
  const FACE = { x: 480, y: 170 };
  const toScreen = (p) => ({ x: O.x + S * p.x, y: O.y - S * p.y });
  const toUnits = (p) => ({ x: (p.x - O.x) / S, y: (O.y - p.y) / S });
  const ARC = { x: 44, y: 252 };
  const ARC_R = 32;
  const arcPoint = (deg) => ({
    x: ARC.x + ARC_R * Math.cos(Core.radians(deg)),
    y: ARC.y - ARC_R * Math.sin(Core.radians(deg)),
  });

  /* Paint order: guides, cylinder, sheet, cut, labels, then the handles. */
  const guides = board.layer("guides");
  const cylinderLayer = board.layer("cylinder");
  const planeLayer = board.layer("plane");
  const cutLayer = board.layer("cut");
  const textLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const axis = board.segment({ x: 40, y: O.y }, { x: 290, y: O.y }, "axis", guides);
  const faceH = board.segment({ x: 350, y: FACE.y }, { x: 612, y: FACE.y }, "cut-axis", guides);
  const faceV = board.segment({ x: FACE.x, y: 42 }, { x: FACE.x, y: 298 }, "cut-axis", guides);
  const tiltArcNode = board.el("path", null, "tilt-arc", guides);
  const rimL = board.el("ellipse", null, "rim", guides);
  const rimR = board.el("ellipse", null, "rim", guides);

  const body = board.polygon([], "cylinder-body", cylinderLayer);
  const edgeTop = board.segment(O, O, "cylinder-outline", cylinderLayer);
  const edgeBottom = board.segment(O, O, "cylinder-outline", cylinderLayer);

  const planeLine = board.segment(O, O, "plane-line", planeLayer);
  const normal = board.segment(O, O, "normal", planeLayer);
  const rightAngle = board.el("path", null, "right-angle", planeLayer);
  const footDot = board.point(O, "plane-foot", 5, planeLayer);

  const cutA = board.el("path", null, "cut", cutLayer);
  const cutB = board.el("path", null, "cut", cutLayer);

  const labelTilt = board.label(ARC, "tilt", "small-label", -2, 26, textLayer);
  const labelCylinder = board.label(toScreen({ x: 5, y: 7 }), "cylinder", "small-label", 0, -8, textLayer);
  const labelPlane = board.label(toScreen({ x: -10, y: -8 }), "sheet", "small-label", 0, 0, textLayer);
  const labelFace = board.label({ x: FACE.x, y: 322 }, "the cut, seen flat", "small-label", 0, 0, textLayer);
  const labelName = board.label(FACE, "", "cut-title", 0, -14, textLayer);

  /* Arc from a square cut (0 degrees) to a sheet along the axis (90). */
  {
    let d = "";
    for (let i = 0; i <= 36; i++) {
      const p = arcPoint((Core.MAX_TILT * i) / 36);
      d += (i ? " L " : "M ") + p.x.toFixed(2) + " " + p.y.toFixed(2);
    }
    tiltArcNode.setAttribute("d", d);
  }

  /* Drag around the small arc, or focus it and use the arrow keys, to tilt. */
  const tiltHandle = board.handle("tilt", arcPoint(state.tilt), {
    r: 13, step: 4, shift: 10, layer: handleLayer,
    label: "Sheet tilt. Drag around the arc, or focus and use the arrow keys, from straight across to along the cylinder",
    describe: () => `now ${state.tilt.toFixed(0)} degrees`,
    clamp: (q) => {
      const deg = Core.clamp(Math.atan2(ARC.y - q.y, q.x - ARC.x) * 180 / Math.PI,
        Core.MIN_TILT, Core.MAX_TILT);
      return arcPoint(deg);
    },
    onMove: (p) => {
      const deg = Core.clamp(Math.atan2(ARC.y - p.y, p.x - ARC.x) * 180 / Math.PI,
        Core.MIN_TILT, Core.MAX_TILT);
      state = Core.setTilt(state, deg);
      render();
    },
  });

  /* Drag the dot on the sheet's perpendicular, or use the arrow keys, to slide
     the sheet. The dot is the foot of the perpendicular from the centre. */
  const footPoint = (s) => {
    const a = Core.analyse(s);
    return toScreen({ x: a.foot.x, y: a.foot.y });
  };
  const offsetHandle = board.handle("position", footPoint(state), {
    r: 13, step: 2, shift: 8, layer: handleLayer,
    label: "Sheet position. Drag the dot, or focus and use the arrow keys, to slide the cutting sheet away from the centre",
    describe: () => `now ${state.offset.toFixed(1)} units from the centre`,
    clamp: (q) => {
      const u = toUnits(q);
      const a = Core.analyse(state);
      const d = Core.clamp(u.x * a.cos + u.y * a.sin, Core.MIN_OFFSET, Core.MAX_OFFSET);
      return toScreen({ x: d * a.cos, y: d * a.sin });
    },
    onMove: (p) => {
      const u = toUnits(p);
      const a = Core.analyse(state);
      state = Core.setOffset(state, u.x * a.cos + u.y * a.sin);
      render();
    },
  });

  /** Fit the face-on cut into its half of the board, keeping lines visible. */
  function drawCut(lines, title, visible) {
    if (!visible || !lines.length) {
      cutA.setAttribute("d", "");
      cutB.setAttribute("d", "");
      labelName.set(FACE, title || "", 0, -14);
      return;
    }
    const pts = lines.reduce((all, line) => all.concat(line), []);
    const us = pts.map((p) => p.u), vs = pts.map((p) => p.v);
    const minU = Math.min(...us), maxU = Math.max(...us);
    const minV = Math.min(...vs), maxV = Math.max(...vs);
    const scale = Math.min(9, 120 / Math.max(maxU - minU, 1e-6), 110 / Math.max(maxV - minV, 1e-6));
    const midU = (minU + maxU) / 2, midV = (minV + maxV) / 2;
    const map = (p) => ({ x: FACE.x + (p.u - midU) * scale, y: FACE.y - (p.v - midV) * scale });
    const path = (line) => line.map((p, i) => {
      const q = map(p);
      return (i ? " L " : "M ") + q.x.toFixed(2) + " " + q.y.toFixed(2);
    }).join("");
    cutA.setAttribute("d", lines[0] ? path(lines[0]) : "");
    cutB.setAttribute("d", lines[1] ? path(lines[1]) : "");
    labelName.set(FACE, title, 0, -14);
  }

  function render() {
    const a = Core.analyse(state);
    const label = Core.describe(state);

    const left = toScreen({ x: -Core.HALF_HEIGHT, y: -Core.RADIUS });
    const right = toScreen({ x: Core.HALF_HEIGHT, y: -Core.RADIUS });
    const bottom = toScreen({ x: -Core.HALF_HEIGHT, y: Core.RADIUS });
    body.set([left, right, toScreen({ x: Core.HALF_HEIGHT, y: Core.RADIUS }), bottom]);
    edgeTop.set(left, right);
    edgeBottom.set(bottom, toScreen({ x: Core.HALF_HEIGHT, y: Core.RADIUS }));
    for (const [rim, p] of [[rimL, left], [rimR, bottom]]) {
      rim.setAttribute("cx", p.x);
      rim.setAttribute("cy", O.y);
      rim.setAttribute("rx", 7);
      rim.setAttribute("ry", Core.RADIUS * S);
    }

    const seg = Core.planeSegment(state, { xMin: -12, xMax: 12, yMin: -9, yMax: 9 });
    if (seg) {
      planeLine.set(toScreen(seg[0]), toScreen(seg[1]));
      planeLine.node.setAttribute("class",
        state.transparent ? "plane-line" : "plane-line solid");
    } else {
      planeLine.set(O, O);
    }
    const foot = footPoint(state);
    normal.set(O, foot);
    footDot.set(foot);
    normal.show(Math.abs(state.offset) > 0.2);
    footDot.show(Math.abs(state.offset) > 0.2);
    if (seg && Math.abs(state.offset) > 0.2) {
      const v = dirAt(foot, toScreen(seg[1]), 12);
      const u = dirAt(foot, O, 12);
      rightAngle.setAttribute("d",
        `M ${foot.x + u.x} ${foot.y + u.y} L ${foot.x + u.x + v.x} ${foot.y + u.y + v.y} L ${foot.x + v.x} ${foot.y + v.y}`);
      rightAngle.style.display = "";
    } else {
      rightAngle.style.display = "none";
    }
    labelPlane.set(toScreen(seg ? seg[1] : { x: -10, y: -8 }), "sheet", 4, -6);

    drawCut(Core.sectionPoints(state, 180), label.title, a.visible);

    tiltHandle.set(arcPoint(state.tilt));
    offsetHandle.set(foot);
    labelCylinder.set(toScreen({ x: 5, y: 7 }), "cylinder", 0, -8);

    tiltRange.value = String(state.tilt);
    offsetRange.value = String(state.offset);
    tiltOut.textContent = `${state.tilt.toFixed(0)}\u00b0`;
    offsetOut.textContent = state.offset.toFixed(1);
    opaqueBtn.textContent = state.transparent ? "Show sheet as opaque" : "Show sheet as transparent";
    opaqueBtn.setAttribute("aria-pressed", String(!state.transparent));
    linkBtn.textContent = state.linked ? "Objects move together" : "Move objects separately";
    linkBtn.setAttribute("aria-pressed", String(state.linked));
    familyOut.textContent = label.title;

    say(`${label.title}. ${label.text}`, null);
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  /** Unit vector from `from` towards `to`, scaled to `size` (screen units). */
  function dirAt(from, to, size) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: (dx / len) * size, y: (dy / len) * size };
  }

  tiltRange.addEventListener("input", () => {
    state = Core.setTilt(state, Number(tiltRange.value));
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
    state = Core.preset(state, "reset");
    render();
  });

  board.onTheme(render);
  render();
})();
