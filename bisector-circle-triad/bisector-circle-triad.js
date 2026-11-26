"use strict";

/*
 * The page for Bisector Circle Triad: drawing and input only; the geometry is
 * in bisector-circle-triad-core.js. Three draggable corners set a triangle. The
 * three congruent circles are always shown; seven buttons switch the same
 * guide layers on and off as the applet's seven checkboxes (names, angle
 * bisectors, reflections, small circumcircles, triangles, big circumcircles
 * and the isogonal conjugate of infinity). Nothing here can be won or lost.
 */

(function () {
  const Core = BisectorCircleTriadCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const view = board.viewBox;
  const box = { x: view.x, y: view.y, width: view.width, height: view.height };
  const options = Core.options();
  const maxRadius = 4 * Math.max(view.width, view.height);
  const fits = (c) => Boolean(c) && Number.isFinite(c.radius) && c.radius < maxRadius
    && Number.isFinite(c.center.x) && Number.isFinite(c.center.y);
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");

  let state = Core.start({ width: view.width, height: view.height });
  let checked = false;

  /* Painted back to front: circles, guides, triangles, dots, labels, handles. */
  const circleLayer = board.layer("circles");
  const guideLayer = board.layer("guides");
  const triLayer = board.layer("triangles");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const sides = [
    board.segment(state.A, state.B, "tri-side", triLayer),
    board.segment(state.B, state.C, "tri-side", triLayer),
    board.segment(state.C, state.A, "tri-side", triLayer),
  ];
  const triad = [
    board.circle(state.A, 1, "triad-circle", circleLayer),
    board.circle(state.A, 1, "triad-circle", circleLayer),
    board.circle(state.A, 1, "triad-circle", circleLayer),
  ];
  const small = [
    board.circle(state.A, 1, "small-circle", circleLayer),
    board.circle(state.A, 1, "small-circle", circleLayer),
    board.circle(state.A, 1, "small-circle", circleLayer),
  ];
  const big = [
    board.circle(state.A, 1, "big-circle", circleLayer),
    board.circle(state.A, 1, "big-circle alt", circleLayer),
  ];
  const bisectors = [
    board.line(state.A, state.B, "bisector", guideLayer),
    board.line(state.B, state.C, "bisector", guideLayer),
    board.line(state.C, state.A, "bisector", guideLayer),
  ];
  const reflectSegs = [];
  for (let i = 0; i < 6; i++) reflectSegs.push(board.segment(state.A, state.B, "reflect-line", guideLayer));
  const isoLines = [
    board.line(state.A, state.B, "iso-line", guideLayer),
    board.line(state.B, state.C, "iso-line", guideLayer),
    board.line(state.C, state.A, "iso-line", guideLayer),
  ];
  const primedTris = [
    board.polygon([state.A, state.B, state.C], "aux-tri", triLayer),
    board.polygon([state.A, state.B, state.C], "aux-tri", triLayer),
    board.polygon([state.A, state.B, state.C], "aux-tri", triLayer),
  ];
  const xyzTri = board.polygon([state.A, state.B, state.C], "xyz-tri", triLayer);
  const incenterDot = board.point(state.A, "incenter-dot", 5, dotLayer);
  const circumDot = board.point(state.A, "circum-dot", 5, dotLayer);
  const reflectedDots = [];
  for (let i = 0; i < 6; i++) reflectedDots.push(board.point(state.A, "aux-dot", 3.6, dotLayer));
  const primedDots = [];
  for (let i = 0; i < 6; i++) primedDots.push(board.point(state.A, "primed-dot", 3.6, dotLayer));
  const xyzDots = [
    board.point(state.A, "xyz-dot", 4, dotLayer),
    board.point(state.A, "xyz-dot", 4, dotLayer),
    board.point(state.A, "xyz-dot", 4, dotLayer),
  ];
  const isoDot = board.point(state.A, "iso-dot", 5, dotLayer);

  /* One label per named point; each is shown with its own layer. */
  const labelDefs = [
    ["A", (d) => d.A, -16, 21], ["B", (d) => d.B, -16, -9], ["C", (d) => d.C, 9, 6],
    ["L", (d) => d.L, 8, -8], ["O", (d) => d.O, 8, 16],
    ["A_b", (d) => d.reflected.Ab, 5, -7], ["A_c", (d) => d.reflected.Ac, 5, -7],
    ["B_a", (d) => d.reflected.Ba, 5, -7], ["B_c", (d) => d.reflected.Bc, 5, -7],
    ["C_a", (d) => d.reflected.Ca, 5, -7], ["C_b", (d) => d.reflected.Cb, 5, -7],
    ["A'_b", (d) => d.primed.A1b, 5, -7], ["A'_c", (d) => d.primed.A1c, 5, -7],
    ["B'_a", (d) => d.primed.B1a, 5, -7], ["B'_c", (d) => d.primed.B1c, 5, -7],
    ["C'_a", (d) => d.primed.C1a, 5, -7], ["C'_b", (d) => d.primed.C1b, 5, -7],
    ["X", (d) => d.X, 7, -8], ["Y", (d) => d.Y, 7, -8], ["Z", (d) => d.Z, 7, -8],
    ["P", (d) => d.P, 7, -8],
  ];
  const labels = labelDefs.map(([text, at, dx, dy]) =>
    board.label(state.A, text, "glabel", dx, dy, labelLayer));

  /** The status line. "done" is the only class an illustration ever uses. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const d = Core.compute(state, box);
    const hideAll = [
      ...sides, ...triad, ...small, ...big, ...bisectors, ...reflectSegs, ...isoLines,
      ...primedTris, xyzTri, incenterDot, circumDot, ...reflectedDots, ...primedDots,
      ...xyzDots, isoDot, ...labels,
    ];
    hideAll.forEach((obj) => obj.show(false));

    if (!d.valid) {
      say("Move the corners apart to make a triangle.", null);
      if (window.Track) window.Track.state(state);
      return;
    }

    sides[0].set(d.A, d.B);
    sides[1].set(d.B, d.C);
    sides[2].set(d.C, d.A);
    sides.forEach((s) => s.show(true));

    const circles = [d.circles.A, d.circles.B, d.circles.C];
    circles.forEach((c, i) => {
      triad[i].show(fits(c));
      if (fits(c)) triad[i].set(c.center, c.radius);
    });
    const primed = [d.circles.A1, d.circles.B1, d.circles.C1];
    primed.forEach((c, i) => {
      small[i].show(options.small && fits(c));
      if (fits(c)) small[i].set(c.center, c.radius);
    });
    big[0].show(options.big && fits(d.circles.abc));
    if (fits(d.circles.abc)) big[0].set(d.circles.abc.center, d.circles.abc.radius);
    big[1].show(options.big && fits(d.circles.one));
    if (fits(d.circles.one)) big[1].set(d.circles.one.center, d.circles.one.radius);

    const feet = [d.feet.La, d.feet.Lb, d.feet.Lc];
    const vertices = [d.A, d.B, d.C];
    bisectors.forEach((line, i) => {
      line.show(options.bisectors);
      if (options.bisectors) line.set(vertices[i], feet[i]);
    });

    const images = [d.reflected.Ab, d.reflected.Ac, d.reflected.Ba,
      d.reflected.Bc, d.reflected.Ca, d.reflected.Cb];
    const sources = [d.A, d.A, d.B, d.B, d.C, d.C];
    reflectSegs.forEach((seg, i) => {
      seg.show(options.reflections);
      if (options.reflections) seg.set(sources[i], images[i]);
      reflectedDots[i].show(options.reflections);
      if (options.reflections) reflectedDots[i].set(images[i]);
    });

    const primedImages = [d.primed.A1b, d.primed.A1c, d.primed.B1a,
      d.primed.B1c, d.primed.C1a, d.primed.C1b];
    primedDots.forEach((dot, i) => {
      dot.show((options.triangles || options.small) && Boolean(primedImages[i]));
      if (primedImages[i]) dot.set(primedImages[i]);
    });
    const tris = [
      [d.A, d.primed.C1b, d.primed.B1c],
      [d.B, d.primed.A1c, d.primed.C1a],
      [d.C, d.primed.B1a, d.primed.A1b],
    ];
    primedTris.forEach((poly, i) => {
      poly.show(options.triangles && tris[i].every(Boolean));
      if (tris[i].every(Boolean)) poly.set(tris[i]);
    });
    xyzTri.show(options.triangles && Boolean(d.X && d.Y && d.Z));
    if (d.X && d.Y && d.Z) xyzTri.set([d.X, d.Y, d.Z]);
    [d.X, d.Y, d.Z].forEach((p, i) => {
      xyzDots[i].show(options.triangles && Boolean(p));
      if (p) xyzDots[i].set(p);
    });

    isoLines.forEach((line, i) => {
      line.show(options.isogonal && Boolean(d.P));
      if (d.P) line.set(vertices[i], d.P);
    });
    isoDot.show(options.isogonal && Boolean(d.P));
    if (d.P) isoDot.set(d.P);

    incenterDot.show(options.bisectors || options.names);
    incenterDot.set(d.L);
    circumDot.show(options.big || options.names);
    circumDot.set(d.O);

    labelDefs.forEach(([text, at], i) => {
      const p = at(d);
      const vertex = i < 3;
      const center = i === 3 || i === 4;
      const reflected = i >= 5 && i < 11;
      const primedLabel = i >= 11 && i < 17;
      const xyz = i >= 17 && i < 20;
      const on = options.names && (
        vertex ||
        (center && (options.bisectors || options.big)) ||
        (reflected && options.reflections) ||
        (primedLabel && (options.triangles || options.small)) ||
        (xyz && options.triangles) ||
        (i === 20 && options.isogonal)
      );
      labels[i].show(Boolean(on && p));
      if (p) labels[i].set(p);
    });

    const r = circles[0] && circles[1] && circles[2]
      ? [circles[0].radius, circles[1].radius, circles[2].radius] : null;
    if (checked) {
      const cl = Core.claims(state);
      const pass = Object.values(cl).every(Boolean);
      if (pass) {
        say(`Confirmed: all six circles have radius ${fmt(r[0])} = |LO|, and their centres lie ${fmt(d.R)} from L.`, "done");
      } else {
        say("The circles have collapsed to points here; drag a corner a little and check again.", null);
      }
    } else if (!r) {
      say("The circles have collapsed to points here. Drag a corner a little.", null);
    } else {
      say(`The three circles each have radius ${fmt(r[0])}. Drag a corner, or check the claims.`, null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const clampVertex = (p) => ({
    x: Geom.clamp(p.x, view.x + 10, view.x + view.width - 10),
    y: Geom.clamp(p.y, view.y + 10, view.y + view.height - 10),
  });
  const vertexOptions = (name) => ({
    r: 9, step: 3, shift: 12, layer: handleLayer, clamp: clampVertex,
    label: `Corner ${name}. Drag, or focus and use the arrow keys to move it`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => {
      state = Core.withPoint(state, name, p);
      checked = false;
      render();
    },
  });
  const hA = board.handle("A", state.A, vertexOptions("A"));
  const hB = board.handle("B", state.B, vertexOptions("B"));
  const hC = board.handle("C", state.C, vertexOptions("C"));

  function reset() {
    state = Core.start({ width: view.width, height: view.height });
    checked = false;
    hA.set(state.A); hB.set(state.B); hC.set(state.C);
    render();
    hA.node.focus();
  }
  function checkClaims() {
    checked = true;
    render();
  }

  document.getElementById("newBtn").addEventListener("click", reset);
  document.getElementById("checkBtn").addEventListener("click", checkClaims);

  const switches = [
    ["names", "namesBtn"], ["bisectors", "bisectorsBtn"],
    ["reflections", "reflectionsBtn"], ["small", "smallBtn"],
    ["triangles", "trianglesBtn"], ["big", "bigBtn"],
    ["isogonal", "isogonalBtn"],
  ];
  switches.forEach(([key, id]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const label = btn.dataset.label;
    const sync = () => {
      btn.setAttribute("aria-pressed", String(options[key]));
      btn.textContent = `${options[key] ? "Hide" : "Show"} ${label}`;
      btn.setAttribute("aria-label", `${options[key] ? "Hide" : "Show"} ${label} in the diagram`);
    };
    sync();
    btn.addEventListener("click", () => {
      options[key] = !options[key];
      sync();
      render();
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "c" || e.key === "C") checkClaims();
  });

  board.onTheme(render);
  render();
})();
