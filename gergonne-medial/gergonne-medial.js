"use strict";

/*
 * The page for Gergonne Medial: drawing and input only. All geometry lives in
 * gergonne-medial-core.js. The SVG holds a triangle with three draggable
 * corners, its incircle, the contact triangle A'B'C', the medial triangle,
 * the three perpendiculars from the midpoints to the opposite contact sides,
 * and their common point T. The two switches are the applet's "names" and
 * "hint" checkboxes; the hint draws the equal tangent lines and equal-angle
 * marks used in Groenman's proof.
 */

(function () {
  const Core = GergonneMedialCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const hintBtn = document.getElementById("hintBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 10, view.x + view.width - 10),
    y: Geom.clamp(p.y, view.y + 10, view.y + view.height - 10),
  });

  let state = Core.start({});
  let checked = false;

  /**
   * Shows the status line. `kind` is "done" once the claim has been checked;
   * this is a demo, so there is no win or loss. The shared record reads the
   * class, so use the three result classes only for a real result.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* --------------------------------- build the drawing once -------------------- */

  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  const tri = board.polygon([state.A, state.B, state.C], "tri", shapes);
  const incircle = board.circle(state.A, 1, "incircle", shapes);
  const contact = board.polygon([state.A, state.B, state.C], "contact", shapes);
  const medial = board.polygon([state.A, state.B, state.C], "medial", shapes);

  const perpendiculars = [
    board.segment(state.A, state.B, "perpendicular", shapes),
    board.segment(state.A, state.B, "perpendicular", shapes),
    board.segment(state.A, state.B, "perpendicular", shapes),
  ];
  const concurrencyLines = [
    board.segment(state.A, state.B, "concurrency", shapes),
    board.segment(state.A, state.B, "concurrency", shapes),
    board.segment(state.A, state.B, "concurrency", shapes),
  ];
  const feet = [
    board.point(state.A, "foot-dot", 4, marks),
    board.point(state.A, "foot-dot", 4, marks),
    board.point(state.A, "foot-dot", 4, marks),
  ];
  const rightMarks = [];
  for (let i = 0; i < 6; i++) rightMarks.push(board.rightAngle(state.A, state.B, state.C, 9, "right-mark", marks));
  const incenterDot = board.point(state.A, "incenter-dot", 4.5, marks);
  const centerDot = board.point(state.A, "center-dot", 6, marks);
  const touchDots = [
    board.point(state.A, "touch-dot", 4, marks),
    board.point(state.A, "touch-dot", 4, marks),
    board.point(state.A, "touch-dot", 4, marks),
  ];

  /* The hint: equal tangents from a vertex, then the equal angles they make. */
  const hintLines = [];
  for (let i = 0; i < 6; i++) hintLines.push(board.segment(state.A, state.B, "hint-line", guides));
  const hintArcs = [];
  for (let i = 0; i < 6; i++) hintArcs.push(board.angleArc(state.A, state.B, state.C, 20, "hint-arc", guides));

  const diagramObjects = [
    incircle, contact, medial, ...perpendiculars, ...concurrencyLines, ...feet,
    ...rightMarks, incenterDot, centerDot, ...touchDots,
  ];

  const label = (text, dx, dy, cls) => board.label(state.A, text, cls || "glabel", dx, dy, marks);
  const labels = {
    A: label("A", -18, 24), B: label("B", 10, 22), C: label("C", -4, -14),
    Ma: label("Mₐ", -16, 20, "glabel small"), Mb: label("Mᵦ", -16, -10, "glabel small"),
    Mc: label("M𝚌", 8, 18, "glabel small"),
    Ga: label("A′", 8, -8, "glabel small touch-label"),
    Gb: label("B′", -20, -8, "glabel small touch-label"),
    Gc: label("C′", 6, 18, "glabel small touch-label"),
    D: label("D", 7, -6, "glabel small foot-label"),
    E: label("E", 7, -6, "glabel small foot-label"),
    F: label("F", 7, 18, "glabel small foot-label"),
    T: label("T", 9, -8, "glabel center-label"),
    I: label("I", -16, 16, "glabel incenter-label"),
  };

  /* ---------------------------------------- render -------------------------------- */

  function render() {
    const m = Core.compute(state);
    const q = Core.claims(state);
    const ok = Boolean(q && q.all);

    // A flat triangle has no usable incircle or feet. Hide the diagram before
    // setting any SVG attribute with a NaN, then explain what to do.
    if (!m.valid) {
      for (const obj of diagramObjects) obj.show(false);
      for (const key of Object.keys(labels)) labels[key].show(state.showNames && ["A", "B", "C"].includes(key));
      for (const obj of [...hintLines, ...hintArcs]) obj.show(false);
      namesBtn.setAttribute("aria-pressed", String(state.showNames));
      namesBtn.textContent = state.showNames ? "Hide names" : "Show names";
      hintBtn.setAttribute("aria-pressed", String(state.showHint));
      hintBtn.textContent = state.showHint ? "Hide hint" : "Show hint";
      say("Pull the corners into a proper triangle: these lines need a real incircle.", null);
      checked = false;
      if (window.Track) window.Track.state(state);
      return;
    }

    tri.set([m.A, m.B, m.C]);
    contact.set([m.Ga, m.Gb, m.Gc]);
    medial.set([m.Ma, m.Mb, m.Mc]);
    incircle.set(m.I, m.radius);

    const feetList = [m.D, m.E, m.F];
    const starts = [m.Ma, m.Mb, m.Mc];
    const ends = [[m.Gb, m.Gc], [m.Ga, m.Gc], [m.Ga, m.Gb]];
    for (let i = 0; i < 3; i++) {
      perpendiculars[i].set(starts[i], feetList[i]);
      concurrencyLines[i].set(starts[i], m.T);
      feet[i].set(feetList[i]);
      rightMarks[2 * i].set(feetList[i], ends[i][0], starts[i], 9);
      rightMarks[2 * i + 1].set(feetList[i], ends[i][1], starts[i], 9);
      touchDots[i].set([m.Ga, m.Gb, m.Gc][i]);
    }
    incenterDot.set(m.I);
    centerDot.set(m.T);

    const hintPairs = [
      [m.A, m.Gb], [m.A, m.Gc], [m.B, m.Gc], [m.B, m.Ga], [m.C, m.Ga], [m.C, m.Gb],
    ];
    for (let i = 0; i < 6; i++) hintLines[i].set(hintPairs[i][0], hintPairs[i][1]);
    const arcAt = [m.A, m.A, m.B, m.B, m.C, m.C];
    const arcTo = [
      [m.Gb, m.Gc], [m.Gc, m.Gb], [m.Gc, m.Ga], [m.Ga, m.Gc], [m.Ga, m.Gb], [m.Gb, m.Ga],
    ];
    for (let i = 0; i < 6; i++) hintArcs[i].set(arcAt[i], arcTo[i][0], arcTo[i][1], 20);

    const points = { ...m };
    for (const key of Object.keys(labels)) labels[key].set(points[key]);

    for (const obj of diagramObjects) obj.show(true);
    for (const obj of [...hintLines, ...hintArcs]) obj.show(state.showHint);
    for (const key of Object.keys(labels)) labels[key].show(state.showNames);

    namesBtn.setAttribute("aria-pressed", String(state.showNames));
    namesBtn.textContent = state.showNames ? "Hide names" : "Show names";
    hintBtn.setAttribute("aria-pressed", String(state.showHint));
    hintBtn.textContent = state.showHint ? "Hide hint" : "Show hint";

    if (checked && ok) {
      say("All three perpendiculars pass through T. T is the incenter of the medial triangle.", "done");
    } else {
      say("Drag A, B or C. The three red perpendiculars always meet at the magenta point T.", null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  /* --------------------------------- input ------------------------------------- */

  const clampCorner = (p) => inside(p);
  const handles = ["A", "B", "C"].map((name) => board.handle(name, state[name], {
    r: 11, step: 3, shift: 12, layer: handlesLayer, clamp: clampCorner,
    label: `Corner ${name}. Drag, or focus and use the arrow keys to move it.`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => {
      state = Core.withPoint(state, name, p);
      checked = false;
      render();
    },
  }));
  const [hA, hB, hC] = handles;

  function reset() {
    state = Core.reset(state);
    checked = false;
    render();
    hA.node.focus();
  }

  function toggle(name) {
    state = Core.withOption(state, name === "names" ? "names" : "hint",
      !(name === "names" ? state.showNames : state.showHint));
    render();
  }

  function checkClaim() {
    checked = true;
    render();
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", () => toggle("names"));
  hintBtn.addEventListener("click", () => toggle("hint"));
  checkBtn.addEventListener("click", checkClaim);
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLButtonElement) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    else if (key === "n") toggle("names");
    else if (key === "h") toggle("hint");
    else if (key === "c") checkClaim();
  });

  board.onTheme(render);
  render();
})();
