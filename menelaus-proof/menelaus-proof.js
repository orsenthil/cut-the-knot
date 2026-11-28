"use strict";

/*
 * The page for Menelaus Proof: drawing and input only; the geometry is in
 * menelaus-proof-core.js. An SVG holds triangle ABC, the three side points
 * F on AB, D on BC and E on CA, and the transversal through them. Four
 * buttons choose the applet's Plain, Proof #1, Proof #2 and Proof #3 views;
 * a further button shows the point names and one restores the starting
 * diagram. Every point is a focusable handle with arrow-key movement.
 */

(function () {
  const Core = MenelausProofCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const modeBtns = [
    document.getElementById("plainBtn"),
    document.getElementById("proof1Btn"),
    document.getElementById("proof2Btn"),
    document.getElementById("proof3Btn"),
  ];

  const view = board.viewBox;
  const pad = 14;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + pad, view.x + view.width - pad),
    y: Geom.clamp(p.y, view.y + pad, view.y + view.height - pad),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");

  let state = Core.start();
  let explored = false;

  const shapes = board.layer("shapes");
  const spokesLayer = board.layer("spokes");
  const auxLayer = board.layer("aux");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /* Everything is created once; render only moves or hides it. */
  const triSides = [
    board.segment(state.A, state.B, "tri-side", shapes),
    board.segment(state.B, state.C, "tri-side", shapes),
    board.segment(state.C, state.A, "tri-side", shapes),
  ];
  const spokes = [];
  for (let i = 0; i < 6; i++) spokes.push(board.segment(state.A, state.B, "spoke", spokesLayer));
  const transversal = board.segment(state.D, state.E, "transversal", shapes);
  const sideDots = [
    board.point(state.D, "side-dot", 5, marks),
    board.point(state.E, "side-dot", 5, marks),
    board.point(state.F, "side-dot", 5, marks),
  ];

  // Proof 1: the parallel through A and its meeting point P on BC.
  const proof1Line = board.line(state.A, state.P || state.E, "aux-line", auxLayer);
  const p1Dot = board.point(state.A, "aux-dot", 5, marks);
  const p1Label = board.label(state.A, "P", "glabel aux-label", 8, -10, marks);

  // Proof 2: three perpendiculars from the vertices on line DE.
  const hSegs = [
    board.segment(state.A, state.D, "aux-line", auxLayer),
    board.segment(state.B, state.D, "aux-line", auxLayer),
    board.segment(state.C, state.D, "aux-line", auxLayer),
  ];
  const hDots = [
    board.point(state.D, "aux-dot", 4.5, marks),
    board.point(state.D, "aux-dot", 4.5, marks),
    board.point(state.D, "aux-dot", 4.5, marks),
  ];
  const hRight = [
    board.rightAngle(state.D, state.A, state.E, 11, "right-angle", marks),
    board.rightAngle(state.D, state.B, state.E, 11, "right-angle", marks),
    board.rightAngle(state.D, state.C, state.E, 11, "right-angle", marks),
  ];
  const hLabels = [
    board.label(state.D, "Ha", "glabel aux-label", 8, -10, marks),
    board.label(state.D, "Hb", "glabel aux-label", 8, -10, marks),
    board.label(state.D, "Hc", "glabel aux-label", 8, -10, marks),
  ];

  // Proof 3: a point K on the transversal, the line through K perpendicular
  // to it, and the three perpendiculars from the vertices onto that line.
  const proof3Line = board.line(state.D, state.E, "aux-line", auxLayer);
  const kSegs = [
    board.segment(state.A, state.D, "aux-line", auxLayer),
    board.segment(state.B, state.D, "aux-line", auxLayer),
    board.segment(state.C, state.D, "aux-line", auxLayer),
  ];
  const kDots = [
    board.point(state.D, "aux-dot", 4.5, marks),
    board.point(state.D, "aux-dot", 4.5, marks),
    board.point(state.D, "aux-dot", 4.5, marks),
    board.point(state.D, "aux-dot", 4.5, marks),
  ];
  const kLabels = [
    board.label(state.D, "Ka", "glabel aux-label", 8, -10, marks),
    board.label(state.D, "Kb", "glabel aux-label", 8, -10, marks),
    board.label(state.D, "Kc", "glabel aux-label", 8, -10, marks),
    board.label(state.D, "K", "glabel aux-label", 8, 20, marks),
  ];

  const vertexLabels = [
    board.label(state.A, "A", "glabel", -20, 24, marks),
    board.label(state.B, "B", "glabel", -20, 24, marks),
    board.label(state.C, "C", "glabel", -20, -10, marks),
  ];
  const sideLabels = [
    board.label(state.F, "F", "glabel side-label", -18, -10, marks),
    board.label(state.D, "D", "glabel side-label", 8, -8, marks),
    board.label(state.E, "E", "glabel side-label", 8, -8, marks),
  ];

  /** The line under the diagram. "done" is how a demo counts as explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const modeWords = [
    "Plain view: the three side points stay on one line.",
    "Proof #1: the line through A parallel to DE meets line BC at P.",
    "Proof #2: perpendiculars from A, B and C land on line DE at Ha, Hb and Hc.",
    "Proof #3: the perpendicular through K meets projections Ka, Kb and Kc.",
  ];

  function hideAux() {
    proof1Line.show(false); p1Dot.show(false); p1Label.show(false);
    hSegs.forEach((s) => s.show(false));
    hDots.forEach((d) => d.show(false));
    hRight.forEach((r) => r.show(false));
    hLabels.forEach((l) => l.show(false));
    proof3Line.show(false);
    kSegs.forEach((s) => s.show(false));
    kDots.forEach((d) => d.show(false));
    kLabels.forEach((l) => l.show(false));
  }

  function render() {
    const m = Core.measurements(state);
    const { A, B, C, D, E, F } = state;

    triSides[0].set(A, B);
    triSides[1].set(B, C);
    triSides[2].set(C, A);
    m.spokes.forEach(([p, q], i) => spokes[i].set(p, q));
    transversal.show(true);
    transversal.set(m.line.p, m.line.q);
    [D, E, F].forEach((p, i) => sideDots[i].set(p));

    hideAux();
    const aux = m.auxiliary;
    let words = modeWords[state.proof];
    if (state.proof === 1 && Core.finite(aux.P)) {
      proof1Line.show(true);
      proof1Line.set(A, aux.P);
      p1Dot.show(true); p1Dot.set(aux.P);
      p1Label.show(true); p1Label.set(aux.P);
    } else if (state.proof === 2 && Core.finite(aux.Ha) && Core.finite(aux.Hb) && Core.finite(aux.Hc)) {
      [[A, aux.Ha], [B, aux.Hb], [C, aux.Hc]].forEach(([v, foot], i) => {
        hSegs[i].show(true); hSegs[i].set(v, foot);
        hDots[i].show(true); hDots[i].set(foot);
        hRight[i].show(true); hRight[i].set(foot, v, E, 10);
        hLabels[i].show(true); hLabels[i].set(foot);
      });
    } else if (state.proof === 3 && Core.finite(aux.K) && Core.finite(aux.perpQ)) {
      proof3Line.show(true);
      proof3Line.set(aux.K, aux.perpQ);
      [[A, aux.Ka], [B, aux.Kb], [C, aux.Kc]].forEach(([v, foot], i) => {
        kSegs[i].show(true); kSegs[i].set(v, foot);
        kDots[i].show(true); kDots[i].set(foot);
        kLabels[i].show(true); kLabels[i].set(foot);
      });
      kDots[3].show(true); kDots[3].set(aux.K);
      kLabels[3].show(true); kLabels[3].set(aux.K);
    }

    const show = m.showNames;
    [A, B, C].forEach((p, i) => {
      vertexLabels[i].show(show); vertexLabels[i].set(p);
    });
    [F, D, E].forEach((p, i) => {
      sideLabels[i].show(show); sideLabels[i].set(p);
    });

    say(`${words} AF/BF × BD/CD × CE/AE = ${fmt(m.product)}; the three points lie on one line.`,
      explored ? "done" : null);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const opts = {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  };
  const handles = {};
  const names = {
    A: "Corner A of the triangle",
    B: "Corner B of the triangle",
    C: "Corner C of the triangle",
    D: "Point D on side BC",
    E: "Point E on side AC",
    F: "Point F on side AB",
  };
  for (const name of ["A", "B", "C", "D", "E", "F"]) {
    handles[name] = board.handle(name, state[name], {
      ...opts,
      label: `${names[name]}. Drag it, or focus it and use the arrow keys to move it.`,
      onMove: (p) => move(name, p),
    });
  }

  function syncHandles() {
    for (const name of ["A", "B", "C", "D", "E", "F"]) handles[name].set(state[name]);
  }

  function move(name, p) {
    const next = Core.applyDrag(state, name, p);
    if (!Core.valid(next)) {
      syncHandles();
      say("That move would flatten the triangle or make the lines parallel. Try another spot.", null);
      return;
    }
    state = next;
    explored = true;
    syncHandles();
    render();
    handles[name].node.focus();
  }

  function syncButtons() {
    namesBtn.setAttribute("aria-pressed", String(state.showNames));
    namesBtn.textContent = state.showNames ? "Hide names" : "Show names";
    modeBtns.forEach((b, i) => {
      const on = state.proof === i;
      b.setAttribute("aria-pressed", String(on));
      b.classList.toggle("selected", on);
    });
  }

  function setMode(k) {
    state = Core.withOption(state, "proof", k);
    explored = true;
    syncButtons();
    render();
    modeBtns[k].focus();
  }

  function toggleNames() {
    state = Core.withOption(state, "showNames", !state.showNames);
    syncButtons();
    render();
    namesBtn.focus();
  }

  function newDiagram() {
    const fresh = Core.start({
      width: state.width, height: state.height,
      proof: state.proof, showNames: state.showNames,
    });
    state = fresh;
    explored = false;
    syncHandles();
    syncButtons();
    render();
    newBtn.focus();
  }

  newBtn.addEventListener("click", newDiagram);
  namesBtn.addEventListener("click", toggleNames);
  modeBtns.forEach((b, i) => b.addEventListener("click", () => setMode(i)));
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k >= "1" && k <= "4") setMode(Number(k) - 1);
    else if (k === "n") toggleNames();
    else if (k === "r") newDiagram();
  });

  board.onTheme(render);
  syncButtons();
  render();
})();
