"use strict";

/*
 * The page for Iterations on Euler Lines: drawing and input only; the geometry
 * is in euler-to-euler-core.js. An SVG holds a draggable triangle ABC, the
 * Euler line through its centroid, circumcentre and orthocentre, the crossings
 * M and N with AB and AC, and the second Euler line of AMN. Six buttons switch
 * the same overlays as the applet's five checkboxes plus Reset, and corner
 * handles can be dragged or moved with the arrow keys.
 */

(function () {
  const Core = EulerToEulerCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 22, view.x + view.width - 22),
    y: Geom.clamp(p.y, view.y + 22, view.y + view.height - 22),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");

  let state = Core.start();
  let showNames = false;
  let showEuler = false;
  let showCentroid = false;
  let showCircumcenter = false;
  let showOrthocenter = false;

  /* Painted back to front: lines, marks, labels, handles. */
  const guides = board.layer("guides");
  const marks = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const triSides = [
    board.segment(state.A, state.B, "tri-side", guides),
    board.segment(state.B, state.C, "tri-side", guides),
    board.segment(state.C, state.A, "tri-side", guides),
  ];
  const euler1 = board.line(state.A, state.B, "euler-line", guides);
  const euler2 = board.line(state.A, state.B, "euler2-line", guides);

  const g1 = board.point(state.A, "centroid-dot", 4.5, marks);
  const o1 = board.point(state.A, "circum-dot", 5, marks);
  const h1 = board.point(state.A, "ortho-dot", 5, marks);
  const g2 = board.point(state.A, "centroid-dot two", 4.5, marks);
  const o2 = board.point(state.A, "circum-dot two", 5, marks);
  const h2 = board.point(state.A, "ortho-dot two", 5, marks);
  const mDot = board.point(state.A, "cross-dot", 4.5, marks);
  const nDot = board.point(state.A, "cross-dot", 4.5, marks);

  const arcM = board.angleArc(state.A, state.B, state.C, 18, "angle-arc", marks);
  const arcN = board.angleArc(state.A, state.B, state.C, 18, "angle-arc", marks);

  const vertexLabels = [
    board.label(state.A, "A", "glabel", -17, 22, labelsLayer),
    board.label(state.B, "B", "glabel", 9, 22, labelsLayer),
    board.label(state.C, "C", "glabel", -4, -12, labelsLayer),
  ];
  const crossLabels = [
    board.label(state.A, "M", "glabel cross-label", -18, -9, labelsLayer),
    board.label(state.A, "N", "glabel cross-label", 8, -9, labelsLayer),
  ];

  /**
   * Shows a line under the picture. "done" marks an explored illustration;
   * the shared record reads that class, so no win or loss is ever reported.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const d = Core.diagram(state);
    const cl = Core.claims(state);
    const firstLive = d.first.defined;
    const secondLive = showEuler && d.second.defined && d.mnFinite;

    triSides[0].set(d.A, d.B);
    triSides[1].set(d.B, d.C);
    triSides[2].set(d.C, d.A);

    euler1.show(firstLive);
    if (firstLive) euler1.set(d.first.O, d.first.H);
    euler2.show(secondLive);
    if (secondLive) euler2.set(d.second.O, d.second.H);

    g1.show(firstLive && showCentroid);
    o1.show(firstLive && showCircumcenter);
    h1.show(firstLive && showOrthocenter);
    g2.show(secondLive && showCentroid);
    o2.show(secondLive && showCircumcenter);
    h2.show(secondLive && showOrthocenter);
    if (firstLive) {
      g1.set(d.first.G); o1.set(d.first.O); h1.set(d.first.H);
    }
    if (secondLive) {
      g2.set(d.second.G); o2.set(d.second.O); h2.set(d.second.H);
    }

    mDot.show(showNames && d.mnFinite);
    nDot.show(showNames && d.mnFinite);
    crossLabels[0].show(showNames && d.mnFinite);
    crossLabels[1].show(showNames && d.mnFinite);
    if (d.mnFinite) {
      mDot.set(d.M); nDot.set(d.N);
      crossLabels[0].set(d.M); crossLabels[1].set(d.N);
    }
    vertexLabels[0].set(d.A);
    vertexLabels[1].set(d.B);
    vertexLabels[2].set(d.C);
    for (const label of vertexLabels) label.show(showNames);

    /* The applet puts small angle marks where the new line crosses AB and AC. */
    let arcLive = false;
    if (secondLive) {
      const m2 = Geom.lineIntersection(d.second.O, d.second.H, d.A, d.B);
      const n2 = Geom.lineIntersection(d.second.O, d.second.H, d.A, d.C);
      arcLive = Boolean(m2 && n2 && Core.finite(m2) && Core.finite(n2) &&
        Core.distance(m2, d.A) > 1e-6 && Core.distance(n2, d.A) > 1e-6);
      if (arcLive) {
        arcM.set(m2, d.A, n2, 18);
        arcN.set(n2, d.A, m2, 18);
      }
    }
    arcM.show(arcLive);
    arcN.show(arcLive);

    if (!firstLive) {
      say("This triangle is too close to equilateral, so the applet draws no Euler line.", null);
    } else if (!d.mnFinite) {
      say("The Euler line almost follows one of the sides here, so M or N cannot be found.", null);
    } else if (!cl.distinct) {
      say("M and N fall on A in this symmetric triangle, so there is no new triangle to measure.", null);
    } else if (!d.second.defined) {
      say("Triangle AMN is too close to equilateral, so the applet draws no second Euler line.", null);
    } else if (showEuler && cl.parallel) {
      say("The red Euler line of AMN is parallel to BC. Drag a corner and it stays parallel.", "done");
    } else if (showEuler) {
      say(`The orange line crosses AB at M (x ${fmt(d.M.x)}) and AC at N (x ${fmt(d.N.x)}); compare it with BC.`, null);
    } else {
      say("The first Euler line cuts AB at M and AC at N. Show Euler line to see the new triangle's own line.", null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function moveVertex(name, p) {
    state = Core.withPoint(state, name, inside(p));
    render();
  }

  const handleOpts = (name) => ({
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
    label: `Corner ${name}. Drag, or focus and use the arrow keys to move it.`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  });
  const hA = board.handle("A", state.A, { ...handleOpts("A"), onMove: (p) => moveVertex("A", p) });
  const hB = board.handle("B", state.B, { ...handleOpts("B"), onMove: (p) => moveVertex("B", p) });
  const hC = board.handle("C", state.C, { ...handleOpts("C"), onMove: (p) => moveVertex("C", p) });

  function reset() {
    state = Core.start();
    hA.set(state.A); hB.set(state.B); hC.set(state.C);
    render();
    hA.node.focus();
  }

  function toggle(button, get, set, onText, offText) {
    set(!get());
    button.setAttribute("aria-pressed", String(get()));
    button.textContent = get() ? offText : onText;
    render();
  }

  const eulerBtn = document.getElementById("eulerBtn");
  const namesBtn = document.getElementById("namesBtn");
  const centroidBtn = document.getElementById("centroidBtn");
  const circumBtn = document.getElementById("circumBtn");
  const orthoBtn = document.getElementById("orthoBtn");

  document.getElementById("newBtn").addEventListener("click", reset);
  eulerBtn.addEventListener("click", () =>
    toggle(eulerBtn, () => showEuler, (v) => { showEuler = v; }, "Show Euler line", "Hide Euler line"));
  namesBtn.addEventListener("click", () =>
    toggle(namesBtn, () => showNames, (v) => { showNames = v; }, "Show names", "Hide names"));
  centroidBtn.addEventListener("click", () =>
    toggle(centroidBtn, () => showCentroid, (v) => { showCentroid = v; }, "Show centroid", "Hide centroid"));
  circumBtn.addEventListener("click", () =>
    toggle(circumBtn, () => showCircumcenter, (v) => { showCircumcenter = v; }, "Show circumcenter", "Hide circumcenter"));
  orthoBtn.addEventListener("click", () =>
    toggle(orthoBtn, () => showOrthocenter, (v) => { showOrthocenter = v; }, "Show orthocenter", "Hide orthocenter"));

  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "e") eulerBtn.click();
    else if (k === "n") namesBtn.click();
    else if (k === "c") centroidBtn.click();
    else if (k === "o") circumBtn.click();
    else if (k === "h") orthoBtn.click();
  });

  board.onTheme(render);
  render();
})();
