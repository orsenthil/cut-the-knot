"use strict";

/*
 * The page for AsiaPacificKite: drawing and pointer/keyboard input only. The
 * geometry is in asia-pacific-kite-core.js, which mirrors the applet's own
 * line and circle construction. An SVG holds the rhombus A-B-C-D, the line l
 * through D with its points E and F, and the computed points M and N. Six
 * handles are draggable: the four corners keep the kite's 60-degree shape, and
 * E and F keep the line through D, exactly as in the original applet.
 */

(function () {
  const Core = AsiaPacificKiteCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const view = board.viewBox;

  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const premiseBtn = document.getElementById("premiseBtn");
  const hintBtn = document.getElementById("hintBtn");
  const checkBtn = document.getElementById("checkBtn");

  let state = Core.start({ width: view.width, height: view.height });
  let showNames = true;      // the applet's "show" parameter defaults to "1"
  let showPremise = false;   // the applet's premise and hint checkboxes start off
  let showHint = false;
  let checked = false;

  /* Layers: the later a layer is made, the closer it is to the player. */
  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  const kite = board.polygon([state.A, state.B, state.C, state.D], "kite-fill", shapes);
  const sides = [
    board.segment(state.A, state.B, "kite-side", shapes),
    board.segment(state.B, state.C, "kite-side", shapes),
    board.segment(state.C, state.D, "kite-side", shapes),
    board.segment(state.D, state.A, "kite-side", shapes),
  ];
  const diagAC = board.segment(state.A, state.C, "diagonal", guides);
  const diagBD = board.segment(state.B, state.D, "diagonal", guides);
  const secant = board.line(state.E, state.F, "secant", guides);
  const ceLine = board.segment(state.C, state.E, "cross-line", shapes);
  const afLine = board.segment(state.A, state.F, "cross-line alt", shapes);
  const locus = board.circle(state.A, 1, "locus-circle", guides);
  const circleAEM = board.circle(state.A, 1, "small-circle aem", guides);
  const circleCFM = board.circle(state.C, 1, "small-circle cfm", guides);
  const mnLine = board.segment(state.A, state.B, "mn-line", guides);
  const mDot = board.point(state.A, "computed-dot m", 5, marks);
  const nDot = board.point(state.B, "computed-dot n", 5, marks);
  const premiseArcs = [
    board.angleArc(state.B, state.A, state.C, 17, "premise-arc", marks),
    board.angleArc(state.D, state.C, state.A, 17, "premise-arc", marks),
  ];
  const hintArcs = [
    board.angleArc(state.E, state.A, state.C, 19, "hint-arc", marks),
    board.angleArc(state.A, state.C, state.F, 19, "hint-arc", marks),
  ];
  const labels = ["A", "B", "C", "D", "E", "F", "M", "N"].map((name, i) =>
    board.label(state.A, name, "glabel" + (i >= 6 ? " computed-label" : ""), 9, -9, marks));

  /** Status line. "done" is for a finished play; an illustration uses none. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");

  function render() {
    const g = Core.geometry(state);
    const cl = Core.claims(state);
    const P = { A: state.A, B: state.B, C: state.C, D: state.D, E: state.E, F: state.F, M: g.M, N: g.N };

    kite.set(P4(P));
    sides[0].set(state.A, state.B);
    sides[1].set(state.B, state.C);
    sides[2].set(state.C, state.D);
    sides[3].set(state.D, state.A);
    diagAC.set(state.A, state.C);
    diagBD.set(state.B, state.D);
    ceLine.set(state.C, state.E);
    afLine.set(state.A, state.F);
    secant.set(state.E, state.F);

    locus.show(showHint && Boolean(g.circleABC));
    circleAEM.show(Boolean(g.circleAEM));
    circleCFM.show(Boolean(g.circleCFM));
    mnLine.show(showHint && Boolean(g.N) && Boolean(g.M));
    if (g.circleABC) locus.set(g.circleABC, g.circleABC.r);
    if (g.circleAEM) circleAEM.set(g.circleAEM, g.circleAEM.r);
    if (g.circleCFM) circleCFM.set(g.circleCFM, g.circleCFM.r);
    if (g.M && g.N) mnLine.set(g.M, g.N);

    mDot.show(Boolean(g.M));
    nDot.show(Boolean(g.N));
    if (g.M) mDot.set(g.M);
    if (g.N) nDot.set(g.N);

    premiseArcs[0].show(showPremise);
    premiseArcs[1].show(showPremise);
    if (showPremise) {
      premiseArcs[0].set(state.B, state.A, state.C, 17);
      premiseArcs[1].set(state.D, state.C, state.A, 17);
    }
    hintArcs[0].show(showHint && Core.finite(state.E));
    hintArcs[1].show(showHint && Core.finite(state.F));
    if (showHint) {
      if (Core.finite(state.E)) hintArcs[0].set(state.E, state.A, state.C, 19);
      if (Core.finite(state.F)) hintArcs[1].set(state.A, state.C, state.F, 19);
    }

    ["A", "B", "C", "D", "E", "F", "M", "N"].forEach((name, i) => {
      const point = P[name];
      const visible = Boolean(point) && Core.finite(point) &&
        (showNames || i >= 6) && !(name === "N" && g.M && Core.dist(point, g.M) < 10);
      labels[i].show(visible);
      if (visible) {
        const off = { A: [-17, 20], B: [-4, -14], C: [9, 20], D: [-4, 22],
          E: [-18, -8], F: [10, -8], M: [10, 6], N: [10, 14] }[name];
        labels[i].set(point, name, off[0], off[1]);
      }
    });

    for (const h of handles) h.set(P[h.name] || h.point);

    if (!Core.finite(g.M) || !cl.rhombus) {
      say("Move the corners apart so the kite has room, then drag E or F.", null);
    } else if (checked) {
      say("Checked: four equal sides, a 60° angle at B, M on the circle through A, B and C, and N on the line EF.", null);
    } else {
      const angle = Core.angleAt(g.M, state.A, state.C);
      say(`M is on the circle through A, B and C. Angle AMC is ${fmt(angle)}°; drag E or F to move it.`, null);
    }
    if (window.Track) window.Track.state(state);
  }

  const P4 = (p) => [p.A, p.B, p.C, p.D];

  /* The applet fixes A and C in y and B and D in x. Only the free coordinate
   * of a corner changes; the opposite corner is mirrored in the canvas. */
  const clampVertex = (p, name) => {
    const x = Geom.clamp(p.x, 8, view.width - 8);
    const y = Geom.clamp(p.y, 8, view.height - 8);
    return (name === "A" || name === "C") ? { x, y: view.height / 2 } : { x: view.width / 2, y };
  };
  const clampLinePoint = (p) => ({
    x: Geom.clamp(p.x, 0, view.width), y: Geom.clamp(p.y, 0, view.height),
  });

  function move(name, p) {
    state = Core.withPoint(state, name, p);
    checked = false;
    render();
  }

  const handles = [
    ["A", "Corner A. Drag left or right, or focus and use the arrow keys.", clampVertex, 9],
    ["B", "Corner B. Drag up or down, or focus and use the arrow keys.", clampVertex, 9],
    ["C", "Corner C. Drag left or right, or focus and use the arrow keys.", clampVertex, 9],
    ["D", "Corner D. Drag up or down, or focus and use the arrow keys.", clampVertex, 9],
    ["E", "Point E on line AB. Drag it, or focus and use the arrow keys.", clampLinePoint, 8],
    ["F", "Point F on line BC. Drag it, or focus and use the arrow keys.", clampLinePoint, 8],
  ].map(([name, label, clamp, r]) => board.handle(name, state[name], {
    r, step: 3, shift: 12, layer: handlesLayer, clamp,
    label,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move(name, p),
  }));

  function reset() {
    state = Core.start({ width: view.width, height: view.height });
    checked = false;
    render();
    handles[0].node.focus();
  }

  function toggle(btn, label, get, set) {
    const on = !get();
    set(on);
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = (on ? "Hide " : "Show ") + label;
    render();
  }

  function checkClaims() {
    const cl = Core.claims(state);
    checked = Core.finite(Core.geometry(state).M) && cl.rhombus && cl.MOnCircle && cl.NOnEF;
    render();
    if (!checked) say("Move the corners apart, then check again.", null);
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", () => toggle(namesBtn, "names", () => showNames, (v) => { showNames = v; }));
  premiseBtn.addEventListener("click", () => toggle(premiseBtn, "premise angles", () => showPremise, (v) => { showPremise = v; }));
  hintBtn.addEventListener("click", () => toggle(hintBtn, "hint", () => showHint, (v) => { showHint = v; }));
  checkBtn.addEventListener("click", checkClaims);
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    else if (key === "c") checkClaims();
    else if (key === "n") namesBtn.click();
    else if (key === "p") premiseBtn.click();
    else if (key === "h") hintBtn.click();
  });

  board.onTheme(render);
  render();
})();
