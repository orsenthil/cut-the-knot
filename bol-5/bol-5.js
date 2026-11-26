"use strict";

/*
 * The page for BOL5: drawing and input only; the mathematics is in
 * bol-5-core.js. An SVG holds the big semicircle on AB, the two smaller
 * semicircles on AC and CB, the perpendicular CD and the two twin circles,
 * one on each side of CD. Drag C along AB to see that the circles stay equal.
 */
(function () {
  const Core = Bol5Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const hintBtn = document.getElementById("hintBtn");
  const checkBtn = document.getElementById("checkBtn");

  let state = Core.start();
  let checked = false;

  const shapes = board.layer("shapes");
  const proof = board.layer("proof");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  const start = Core.measurements(state);
  const bigArc = board.arc(start.M, start.R, Math.PI, 2 * Math.PI, "big-semi", shapes);
  const leftArc = board.arc(start.O1, start.r1, Math.PI, 2 * Math.PI, "small-semi", shapes);
  const rightArc = board.arc(start.O2, start.r2, Math.PI, 2 * Math.PI, "small-semi", shapes);
  const diameter = board.segment(state.A, state.B, "diameter", shapes);
  const perpendicular = board.segment(state.C, start.D, "perpendicular", shapes);
  const twinLeft = board.circle(start.left.c, start.r, "twin-circle", shapes);
  const twinRight = board.circle(start.right.c, start.r, "twin-circle twin-right", shapes);

  /* The hint lines of the applet's proof. */
  const proofLines = [
    board.line(start.A, start.H, "proof-line", proof),
    board.line(start.A, start.E, "proof-line", proof),
    board.line(start.C, start.H, "proof-line", proof),
    board.line(start.B, start.E, "proof-line", proof),
    board.line(start.B, start.Dp, "proof-line", proof),
  ];
  const proofDots = ["E", "F", "G", "H", "I", "Dp"].map((key) =>
    board.point(start[key], "proof-dot", 3.5, marks));
  const proofLabels = [
    ["E", start.E, "E", -12, -6],
    ["F", start.F, "F", 5, -10],
    ["G", start.G, "G", 5, 14],
    ["H", start.H, "H", -14, -8],
    ["I", start.I, "I", 7, 0],
    ["Dp", start.Dp, "D", 6, -8],
  ].map(([key, at, text, dx, dy]) => board.label(at, text, "glabel proof-label", dx, dy, marks));

  const baseLabels = [
    board.label(state.A, "A", "glabel", -18, 20, marks),
    board.label(state.B, "B", "glabel", 5, 20, marks),
    board.label(state.C, "C", "glabel", -4, 20, marks),
  ];

  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");

  /** Status line; "done" means a claim has been checked, never win or lose. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    if (!m) {
      say("Move the ends of the diameter apart.", null);
      if (window.Track) window.Track.state(state);
      return;
    }

    bigArc.set(m.M, m.R, Math.PI, 2 * Math.PI);
    leftArc.set(m.O1, m.r1, Math.PI, 2 * Math.PI);
    rightArc.set(m.O2, m.r2, Math.PI, 2 * Math.PI);
    diameter.set(m.A, m.B);
    perpendicular.set(m.C, m.D);
    twinLeft.set(m.left.c, m.left.r);
    twinRight.set(m.right.c, m.right.r);
    baseLabels[0].set(m.A);
    baseLabels[1].set(m.B);
    baseLabels[2].set(m.C);
    baseLabels.forEach((l) => l.show(state.showNames));
    hC.set(m.C);

    const showProof = state.showHint && Boolean(m.F && m.I && m.G && m.Dp);
    proofLines[0].set(m.A, m.H);
    proofLines[1].set(m.A, m.E);
    proofLines[2].set(m.C, m.H);
    proofLines[3].set(m.B, m.E);
    proofLines[4].set(m.B, m.Dp);
    proofLines.forEach((l) => l.show(showProof));
    const proofPoints = [m.E, m.F, m.G, m.H, m.I, m.Dp];
    proofDots.forEach((dot, i) => {
      dot.show(showProof && Boolean(proofPoints[i]));
      if (proofPoints[i]) dot.set(proofPoints[i]);
    });
    proofLabels.forEach((label, i) => {
      label.show(showProof && state.showNames && Boolean(proofPoints[i]));
      if (proofPoints[i]) label.set(proofPoints[i]);
    });

    const claims = Core.claims(state);
    const allTrue = Object.keys(claims).every((key) => claims[key]);
    if (checked && allTrue) {
      say(`The circles are equal: both have radius ${fmt(m.r)}, so HE = ${fmt(m.HE)} = AC·CB/AB.`, "done");
    } else if (showProof) {
      say("The straight lines of the proof are drawn; press Check the claim to read the result.", null);
    } else {
      say(`AC = ${fmt(m.AC)}, CB = ${fmt(m.CB)}: each twin circle has radius ${fmt(m.r)}. Drag C or press Check the claim.`, null);
    }
    if (window.Track) window.Track.state(state);
  }

  const hC = board.handle("C", state.C, {
    r: 8, step: 2, shift: 10, layer: handlesLayer,
    label: "Point C on the diameter AB. Drag, or focus and use the arrow keys to move it",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    clamp: (p) => Core.clampC(p, state),
    onMove: (p) => {
      checked = false;
      state = Core.withPoint(state, "C", p);
      render();
    },
  });

  function reset() {
    state = Core.start({ showNames: state.showNames, showHint: state.showHint });
    checked = false;
    render();
    hC.node.focus();
  }
  function toggleNames() {
    state = Core.withOption(state, "showNames", !state.showNames);
    namesBtn.setAttribute("aria-pressed", String(state.showNames));
    namesBtn.textContent = state.showNames ? "Hide names" : "Show names";
    render();
  }
  function toggleHint() {
    state = Core.withOption(state, "showHint", !state.showHint);
    hintBtn.setAttribute("aria-pressed", String(state.showHint));
    hintBtn.textContent = state.showHint ? "Hide hint" : "Show hint";
    render();
  }
  function checkClaim() {
    checked = true;
    render();
  }

  resetBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", toggleNames);
  hintBtn.addEventListener("click", toggleHint);
  checkBtn.addEventListener("click", checkClaim);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    if (key === "n") toggleNames();
    if (key === "h") toggleHint();
    if (key === "c") checkClaim();
  });

  board.onTheme(render);
  render();
})();
