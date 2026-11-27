"use strict";

/*
 * The page for Four NPCircles: drawing and input only. The geometry is in
 * four-np-circles-core.js. The SVG holds four draggable corners A, B, C, D of
 * a quadrilateral; the four nine-point circles (one for each triangle formed
 * by three corners) and the four pedal circles of the remaining corner are
 * built from the core. A canvas click, as in the applet, steps a triangle
 * highlight; six checkboxes switch the applet's six overlays on and off.
 */

(function () {
  const Core = FourNpCirclesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const cycleBtn = document.getElementById("cycleBtn");
  const boxes = {
    showNineCenters: document.getElementById("centersBox"),
    showNineCircles: document.getElementById("circlesBox"),
    showMidpoints: document.getElementById("midsBox"),
    showCenterQuad: document.getElementById("centerQuadBox"),
    showPedalCircles: document.getElementById("pedalBox"),
    showPedalPoints: document.getElementById("pedalPointsBox"),
  };

  let state = Core.start();

  /* Paint order: the quadrilateral, the two families of circles, the small
     points, the optional highlight, then the focusable handles. */
  const quadLayer = board.layer("quad");
  const nineLayer = board.layer("nine");
  const pedalLayer = board.layer("pedal");
  const centerQuadLayer = board.layer("center-quad");
  const midLayer = board.layer("midpoints");
  const footLayer = board.layer("feet");
  const centerLayer = board.layer("centers");
  const commonLayer = board.layer("common");
  const highlightLayer = board.layer("highlight");
  const labelLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const corners = () => [state.A, state.B, state.C, state.D];
  const quad = board.polygon(corners(), "quad-edge", quadLayer);
  const diagonals = [
    board.line(state.A, state.C, "quad-diagonal", quadLayer),
    board.line(state.B, state.D, "quad-diagonal", quadLayer),
  ];
  const nineCircles = [0, 1, 2, 3].map(() => board.circle(state.A, 1, "nine-circle", nineLayer));
  const pedalCircles = [0, 1, 2, 3].map(() => board.circle(state.A, 1, "pedal-circle", pedalLayer));
  const centerQuad = board.polygon([state.A, state.B, state.C, state.D], "center-edge", centerQuadLayer);
  const centerDots = [0, 1, 2, 3].map(() => board.point(state.A, "nine-dot", 4, centerLayer));
  const midDots = [0, 1, 2, 3, 4, 5].map(() => board.point(state.A, "mid-dot", 3.5, midLayer));
  const footDots = Array.from({ length: 12 }, () => board.point(state.A, "foot-dot", 3.2, footLayer));
  const commonHalo = board.circle(state.A, 11, "common-halo", commonLayer);
  const commonDot = board.point(state.A, "common-dot", 5, commonLayer);

  /* The optional triangle highlight: three fat triangle edges, six short
     pieces along the sides and three lines from the left-out corner. */
  const triEdges = [0, 1, 2].map(() => board.segment(state.A, state.B, "tri-edge", highlightLayer));
  const sidePerps = [0, 1, 2, 3, 4, 5].map(() => board.segment(state.A, state.B, "perp-side", highlightLayer));
  const vertexPerps = [0, 1, 2].map(() => board.segment(state.A, state.B, "perp-vertex", highlightLayer));

  const cornerLabels = [0, 1, 2, 3].map((i) =>
    board.label(corners()[i], Core.NAMES[i], "glabel corner-label", i === 0 || i === 1 ? -16 : 8,
      i === 1 ? 18 : -11, labelLayer));
  const centerLabels = [0, 1, 2, 3].map((i) =>
    board.label(state.A, "N" + (i + 1), "glabel center-label", 7, -7, labelLayer));
  const commonLabel = board.label(state.A, "M", "glabel common-label", 9, -9, labelLayer);

  const handles = Core.NAMES.map((name, i) => board.handle(name, corners()[i], {
    r: 10, step: 4, shift: 16, layer: handlesLayer,
    label: "Point " + name + ". Drag it, or focus it and use the arrow keys to move it",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
    onMove: (p) => {
      state = Core.withPoint(state, name, p);
      render();
    },
  }));

  /**
   * Shows the line under the picture. `kind` is "win", "lose", "done" or
   * nothing; those classes are how the player's record learns a play ended.
   * This is an illustration, so it never ends and `kind` is always null.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const d = Core.compute(state);
    const pts = corners();
    const m = d.common;
    const canShow = (c) => Core.finiteCircle(c) && Number.isFinite(c.r) && c.r < 2000;

    quad.set(pts);
    diagonals[0].set(pts[0], pts[2]);
    diagonals[1].set(pts[1], pts[3]);

    for (let i = 0; i < 4; i++) {
      const nine = d.nine[i];
      const pedal = d.pedal[i];
      nineCircles[i].show(state.showNineCircles && canShow(nine));
      if (state.showNineCircles && canShow(nine)) nineCircles[i].set(nine, nine.r);
      pedalCircles[i].show(state.showPedalCircles && canShow(pedal));
      if (state.showPedalCircles && canShow(pedal)) pedalCircles[i].set(pedal, pedal.r);

      centerDots[i].show(state.showNineCenters && Core.finite(nine));
      if (Core.finite(nine)) {
        centerDots[i].set(nine);
        centerLabels[i].set(nine);
      }
      centerLabels[i].show(state.showNineCenters && Core.finite(nine));

      for (let j = 0; j < 3; j++) {
        const dot = footDots[i * 3 + j];
        dot.show(state.showPedalPoints && Core.finite(pedal.feet[j]));
        if (Core.finite(pedal.feet[j])) dot.set(pedal.feet[j]);
      }
    }

    const nineCenters = d.nine.map((c) => ({ x: c.x, y: c.y }));
    centerQuad.show(state.showCenterQuad && nineCenters.every(Core.finite));
    if (state.showCenterQuad && nineCenters.every(Core.finite)) centerQuad.set(nineCenters);

    for (let i = 0; i < 6; i++) {
      midDots[i].show(state.showMidpoints);
      if (state.showMidpoints) midDots[i].set(d.mids[i]);
    }

    const commonOk = Core.finite(m) && Number.isFinite(m.error);
    commonHalo.show(commonOk);
    commonDot.show(commonOk);
    commonLabel.show(commonOk);
    if (commonOk) {
      const common = { x: m.x, y: m.y };
      commonHalo.set(common, 11);
      commonDot.set(common);
      commonLabel.set(common);
    }

    const hi = state.which;
    const triangle = hi >= 0 && hi < 4 ? d.triangles[hi] : null;
    const feet = hi >= 0 && hi < 4 ? d.pedal[hi].feet : null;
    for (let i = 0; i < 3; i++) {
      const ok = Boolean(triangle) && Core.finite(triangle[i]) && Core.finite(triangle[(i + 1) % 3]);
      triEdges[i].show(ok);
      if (ok) triEdges[i].set(triangle[i], triangle[(i + 1) % 3]);
    }
    for (let i = 0; i < 6; i++) {
      const k = Math.floor(i / 2);
      const end = i % 2 === 0 ? triangle && triangle[(k + 1) % 3] : triangle && triangle[(k + 2) % 3];
      const foot = feet && feet[k];
      const ok = Boolean(end) && Core.finite(end) && Core.finite(foot);
      sidePerps[i].show(ok);
      if (ok) sidePerps[i].set(end, foot);
    }
    for (let i = 0; i < 3; i++) {
      const ok = Boolean(triangle) && Core.finite(pts[hi]) && Core.finite(feet && feet[i]);
      vertexPerps[i].show(ok);
      if (ok) vertexPerps[i].set(pts[hi], feet[i]);
    }

    for (let i = 0; i < 4; i++) {
      cornerLabels[i].set(pts[i]);
      handles[i].set(pts[i]);
    }

    let message;
    if (!commonOk || !m.reliable) {
      message = "Move the corners farther apart so the circles can meet clearly.";
    } else {
      const count = d.nine.filter(Core.finiteCircle).length + d.pedal.filter(Core.finiteCircle).length;
      message = `The ${count} circles meet near (${Math.round(m.x)}, ${Math.round(m.y)}); the biggest gap is ${m.error.toExponential(1)} units.`;
      if (d.pedal.some((c) => !Core.finiteCircle(c))) {
        message += " On a circle the pedal circles flatten into straight lines.";
      }
    }
    if (triangle) {
      const names = Core.INDEX[hi].map((i) => Core.NAMES[i]).join("");
      message += ` Highlighting triangle ${names} and the lines from ${Core.NAMES[hi]}.`;
    }
    say(message, null);

    // The position, for the player's record and the tutor, in board units.
    if (window.Track) window.Track.state(state);
  }

  function syncControls() {
    for (const [name, input] of Object.entries(boxes)) input.checked = state[name];
  }

  function reset() {
    state = Core.start(); // Reset moves the four points; the applet keeps its checkboxes
    syncControls();
    render();
  }

  function cycle() {
    state = Core.cycleHighlight(state);
    render();
  }

  newBtn.addEventListener("click", reset);
  cycleBtn.addEventListener("click", cycle);
  for (const [name, input] of Object.entries(boxes)) {
    input.addEventListener("change", () => {
      state = Core.withOption(state, name, input.checked);
      render();
    });
  }

  // The applet's repeated clicks on the canvas step through the triangles.
  // A press that turns into a drag is not a click in the Java applet, so
  // ignore the click event a browser sends after a pointer drag.
  let pressStart = null;
  let wasDrag = false;
  board.root.addEventListener("pointerdown", (e) => {
    wasDrag = false;
    pressStart = { x: e.clientX, y: e.clientY };
  });
  board.root.addEventListener("pointermove", (e) => {
    if (pressStart && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 4) {
      wasDrag = true;
    }
  });
  board.root.addEventListener("pointerup", () => { pressStart = null; });
  board.root.addEventListener("click", (e) => {
    if (wasDrag) { wasDrag = false; return; }
    if (e.target && e.target.closest && e.target.closest(".geom-handle")) return;
    cycle();
  });
  document.addEventListener("keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "h" || e.key === "H") cycle();
    if (e.key === "r" || e.key === "R") reset();
  });

  board.onTheme(render);
  syncControls();
  render();
})();
