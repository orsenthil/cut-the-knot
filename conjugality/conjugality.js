"use strict";

/*
 * The page for Conjugality: drawing and input only; the geometry is in
 * conjugality-core.js. The SVG holds triangle A0A1A2, one draggable point Pa,
 * Pb, Pc on each side line, and their two partners Qa, Qb, Qc. The red line
 * through the P points appears when the applet's area test calls them
 * collinear; the blue line through the Q points and the six cevians appear
 * exactly as in the original applet. Six handles are pointer- and
 * arrow-key-movable; the controls reproduce the applet's names, hint and
 * isotomic/isogonal radio pair.
 */

(function () {
  const Core = ConjugalityCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  const modeInputs = Array.from(document.querySelectorAll('input[name="mode"]'));
  const view = board.viewBox;
  const letters = ["a", "b", "c"];

  let state = Core.start({ width: view.width, height: view.height });
  let diagram = Core.compute(state);

  const guides = board.layer("guides");
  const cevians = board.layer("cevians");
  const partners = board.layer("partners");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  // Every element is made once; a redraw only calls .set(...) and .show(...),
  // so a handle keeps keyboard focus across a move.
  const sides = [0, 1, 2].map((p) => board.line(state.A[p], state.A[(p + 1) % 3], "tri-side", guides));
  const pLine = board.line(state.P[0], state.P[1], "line-p", partners);
  const qLine = board.line(state.P[0], state.P[1], "line-q", partners);
  const redCevians = [0, 1, 2].map(() => board.line(state.A[0], state.P[0], "cevian-p", cevians));
  const blueCevians = [0, 1, 2].map(() => board.line(state.A[0], state.P[0], "cevian-q", cevians));
  const qDots = [0, 1, 2].map(() => board.point(state.P[0], "q-dot", 5, marks));
  const markDots = [0, 1, 2].map(() => board.point(state.P[0], "mark-dot", 3.5, marks));
  const angleArcs = [0, 1, 2].map(() => board.angleArc(state.A[0], state.A[1], state.P[0], 26, "angle-hint", marks));
  const vertexLabels = [0, 1, 2].map((p) =>
    board.label(state.A[p], ["A", "B", "C"][p], "glabel vertex", -16, -12, marks));
  const pLabels = [0, 1, 2].map((p) =>
    board.label(state.P[p], "P" + letters[p], "glabel p", -18, -10, marks));
  const qLabels = [0, 1, 2].map((p) =>
    board.label(state.P[p], "Q" + letters[p], "glabel q", 8, -10, marks));
  const markLabels = [0, 1, 2].map((p) =>
    board.label(state.P[p], "", "glabel mark", 7, 15, marks));

  /** The status line. "done" is the illustration's explored marker, not a win. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function points() {
    const out = {};
    [0, 1, 2].forEach((p) => {
      out["A" + p] = state.A[p];
      out["P" + p] = state.P[p];
    });
    return out;
  }

  function render() {
    diagram = Core.compute(state);
    const all = points();
    Object.keys(handles).forEach((name) => handles[name].set(all[name]));

    sides.forEach((seg, p) => seg.set(state.A[p], state.A[(p + 1) % 3]));
    const showCevians = diagram.kind === 2;
    redCevians.forEach((seg, p) => {
      seg.set(state.A[p], state.P[p]);
      seg.show(showCevians);
    });
    blueCevians.forEach((seg, p) => {
      const q = diagram.Rf[p];
      seg.show(showCevians && Boolean(q));
      if (q) seg.set(state.A[p], q);
    });

    // ShowLine picks the middle two of the three points when a line is found.
    const pSeg = diagram.kind === 1 ? Core.lineSegment(diagram.P[0], diagram.P[1], diagram.P[2]) : null;
    const qSeg = diagram.kind === 1 && diagram.Rf.every(Boolean)
      ? Core.lineSegment(diagram.Rf[0], diagram.Rf[1], diagram.Rf[2]) : null;
    pLine.show(Boolean(pSeg));
    if (pSeg) pLine.set(pSeg[0], pSeg[1]);
    qLine.show(Boolean(qSeg));
    if (qSeg) qLine.set(qSeg[0], qSeg[1]);

    [0, 1, 2].forEach((p) => {
      const q = diagram.Rf[p], m = diagram.M[p];
      qDots[p].show(Boolean(q));
      qLabels[p].show(Boolean(q) && state.showNames);
      if (q) {
        qDots[p].set(q);
        qLabels[p].set(q);
      }
      markDots[p].show(Boolean(m) && state.showHint);
      markLabels[p].show(Boolean(m) && state.showHint && state.showNames);
      if (m) {
        markDots[p].set(m);
        markLabels[p].set(m, (state.mode === "isotomic" ? "M" : "L") + letters[p]);
      }
      // The original draws the two equal angles at the opposite corner.
      const showArc = state.showHint && state.mode === "isogonal" &&
        Number.isFinite(diagram.angles[p]) && Boolean(q);
      angleArcs[p].show(showArc);
      if (showArc) {
        const k = (p + 1) % 3;
        angleArcs[p].set(state.A[p], state.A[k], q, 24);
      }
      vertexLabels[p].show(state.showNames);
      vertexLabels[p].set(state.A[p]);
      pLabels[p].show(state.showNames);
      pLabels[p].set(state.P[p]);
    });

    if (diagram.kind === 1) {
      say("The three P dots lie on one line, and the three Q dots lie on one line too.", "done");
    } else if (diagram.kind === 2) {
      say("The three cevians meet at one point, and the three reflected cevians meet too.", "done");
    } else {
      say("Slide Pa, Pb and Pc along the side lines to line them up or make their cevians meet.");
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function move(name, p) {
    state = Core.movePoint(state, name, p);
    render();
  }

  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });
  const onSide = (p, name) => {
    const k = Number(name[1]);
    const [a, b] = Core.sideEnds(state.A, k);
    const t = Geom.clamp(Core.parameterOn(a, b, p), -0.3, 1.3);
    return Core.onSegmentLine(a, b, t);
  };
  const handleOpts = (name, label, clamp) => ({
    r: 8, step: clamp === inside ? 3 : 1.5, shift: clamp === inside ? 9 : 5,
    layer: handlesLayer, clamp: clamp,
    label: label + ". Drag it, or focus it and use the arrow keys.",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
    onMove: (p, n) => move(n, p),
  });

  const handles = {
    A0: board.handle("A0", state.A[0], handleOpts("A0", "Corner A", inside)),
    A1: board.handle("A1", state.A[1], handleOpts("A1", "Corner B", inside)),
    A2: board.handle("A2", state.A[2], handleOpts("A2", "Corner C", inside)),
    P0: board.handle("P0", state.P[0], handleOpts("P0", "Point Pa on the side BC", onSide)),
    P1: board.handle("P1", state.P[1], handleOpts("P1", "Point Pb on the side CA", onSide)),
    P2: board.handle("P2", state.P[2], handleOpts("P2", "Point Pc on the side AB", onSide)),
  };

  function setMode(mode) {
    state = Core.withSides({ ...state, mode });
    modeInputs.forEach((input) => { input.checked = input.value === mode; });
    render();
  }

  function newDiagram() {
    const mode = state.mode;
    state = Core.start({
      width: view.width, height: view.height, mode,
      showNames: namesBox.checked, showHint: hintBox.checked,
    });
    render();
  }

  newBtn.addEventListener("click", newDiagram);
  namesBox.addEventListener("change", () => {
    state = Core.withSides({ ...state, showNames: namesBox.checked });
    render();
  });
  hintBox.addEventListener("change", () => {
    state = Core.withSides({ ...state, showHint: hintBox.checked });
    render();
  });
  modeInputs.forEach((input) => input.addEventListener("change", () => {
    if (input.checked) setMode(input.value);
  }));
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === "r") newDiagram();
    else if (key === "i") setMode("isotomic");
    else if (key === "g") setMode("isogonal");
    else if (key === "n") { namesBox.checked = !namesBox.checked; namesBox.dispatchEvent(new Event("change")); }
    else if (key === "h") { hintBox.checked = !hintBox.checked; hintBox.dispatchEvent(new Event("change")); }
    else return;
    e.preventDefault();
  });

  board.onTheme(render);
  render();
})();
