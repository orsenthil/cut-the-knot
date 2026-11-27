"use strict";

/*
 * The page for Circle Of Similitude 1: drawing and input only. The geometry
 * lives in circle-of-similitude-1-core.js. An SVG holds two draggable circles
 * (a centre dot and a radius dot each) and a point T gliding on the circle of
 * similitude. The buttons mirror the applet's checkboxes: names, hint, four
 * statements and the L/M pair, plus Reset and a Check button that reports the
 * measured equalities. The picture is an illustration, so it never wins or
 * loses; the status marks it "done" once the equalities have been checked.
 */

(function () {
  const Core = CircleOfSimilitude1Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const btn = (id) => document.getElementById(id);
  const newBtn = btn("newBtn"), namesBtn = btn("namesBtn"), hintBtn = btn("hintBtn");
  const pairBtn = btn("pairBtn"), checkBtn = btn("checkBtn");
  const statementBtns = [btn("s1Btn"), btn("s2Btn"), btn("s3Btn"), btn("s4Btn")];

  let state = Core.start();
  let checked = false;

  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /* Every SVG object is created once; a redraw only changes its geometry. */
  const given = [board.circle(state.O1, 1, "given-circle", shapes),
                 board.circle(state.O2, 1, "given-circle", shapes)];
  const radiusLines = [board.segment(state.O1, state.R1, "radius-line", guides),
                       board.segment(state.O2, state.R2, "radius-line", guides)];
  const centersLine = board.line(state.O1, state.O2, "centers-line", guides);
  const extTangents = [board.line(state.O1, state.O2, "tangent-line", guides),
                       board.line(state.O2, state.O1, "tangent-line", guides)];
  const intTangents = [board.line(state.O1, state.O2, "tangent-line", guides),
                       board.line(state.O2, state.O1, "tangent-line", guides)];
  const cmCircle = board.circle(state.O1, 1, "diameter-circle", shapes);
  const csCircle = board.circle(state.O1, 1, "similitude-circle", shapes);
  const csLimit = board.line(state.O1, state.O2, "similitude-circle", shapes);
  const radical = board.line(state.O1, state.O2, "radical-line", shapes);
  const rightAngles = [board.rightAngle(state.O1, state.O2, state.O1, 8, "right-angle", marks),
                       board.rightAngle(state.O2, state.O1, state.O2, 8, "right-angle", marks)];
  const tpLine = board.line(state.T, state.O1, "bisector-line", shapes);
  const contactSegs = [board.segment(state.T, state.O1, "contact-line", shapes),
                       board.segment(state.T, state.O2, "contact-line", shapes)];
  const angleArcs = [board.angleArc(state.T, state.O1, state.O2, 16, "angle-arc", marks),
                     board.angleArc(state.T, state.O2, state.O1, 16, "angle-arc", marks)];
  const chordLine = board.line(state.O1, state.O2, "chord-line", shapes);
  const chordParts = [board.segment(state.O1, state.O2, "chord-part", shapes),
                      board.segment(state.O2, state.O1, "chord-part", shapes)];
  const projections = [board.segment(state.O1, state.O1, "projection-line", shapes),
                       board.segment(state.O2, state.O2, "projection-line", shapes)];
  const midpointSegs = [board.segment(state.O1, state.O2, "midpoint-line", guides),
                        board.segment(state.O2, state.O1, "midpoint-line", guides)];
  const toBLine = board.segment(state.T, state.T, "projection-line", guides);

  const keyPoints = ["P", "Q", "CM", "CS", "E", "F", "L1", "L2", "K1", "K2", "B1", "B2", "B", "H1", "H2"];
  const labelOffset = {
    P: [8, -9], Q: [-20, -9], CM: [8, 17], CS: [-22, 17], E: [8, -9], F: [8, 17],
    L1: [-24, -11], L2: [8, -11], K1: [-24, 17], K2: [8, 17],
    B1: [-24, 17], B2: [8, 17], B: [-20, -11], H1: [-22, 17], H2: [8, 17],
  };
  const dots = {}, labels = {};
  for (const key of keyPoints) {
    dots[key] = board.point(state.O1, "special-dot", 4.5, marks);
    labels[key] = board.label(state.O1, key, "point-label", labelOffset[key][0], labelOffset[key][1], marks);
  }
  const showPoint = (key, on, at, text) => {
    dots[key].show(on);
    labels[key].show(on && state.options.names);
    if (on && at) {
      dots[key].set(at);
      labels[key].set(at, text || key);
    }
  };

  /** Status under the board. "done" is the shared record's finished marker;
   *  this illustration has no "win" or "lose" outcome. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    const m = Core.claims(state);
    const o = state.options;
    const pair = o.one ? g.pairL : g.pairM;
    const hasPair = Boolean(pair);

    given[0].set(state.O1, Math.max(g.c1.r, 0.1));
    given[1].set(state.O2, Math.max(g.c2.r, 0.1));
    for (let i = 0; i < 2; i++) {
      radiusLines[i].show(o.hint && g.possible);
      radiusLines[i].set(i === 0 ? state.O1 : state.O2, i === 0 ? state.R1 : state.R2);
    }
    centersLine.set(state.O1, state.O2);

    for (let i = 0; i < 2; i++) {
      const ext = g.extTangents[i], int = g.intTangents[i];
      extTangents[i].show(o.hint && Boolean(ext));
      intTangents[i].show(o.hint && Boolean(int));
      if (ext) extTangents[i].set(ext[0], ext[1]);
      if (int) intTangents[i].set(int[0], int[1]);
    }

    cmCircle.show(o.s1 && g.possible);
    if (g.possible) cmCircle.set(g.cm.center, g.cm.radius);
    csCircle.show(g.possible && !g.cs.infinite);
    csLimit.show(g.possible && g.cs.infinite);
    if (g.possible && !g.cs.infinite) csCircle.set(g.cs.center, g.cs.radius);
    if (g.cs && g.cs.line) csLimit.set(g.cs.line[0], g.cs.line[1]);
    radical.show(o.s3 && Boolean(g.radical));
    if (g.radical) radical.set(g.radical.a, g.radical.b);

    for (let i = 0; i < 2; i++) {
      const cross = [g.E, g.F][i];
      const at = [g.cs && g.cs.center, g.cm.center][i];
      const other = [g.cm.center, g.cs && g.cs.center][i];
      rightAngles[i].show(o.s1 && Boolean(cross && at && other));
      if (cross && at && other) rightAngles[i].set(cross, at, other, 8);
    }

    tpLine.show(o.s2 && Boolean(g.P && hasPair));
    if (g.P) tpLine.set(state.T, g.P);
    for (let i = 0; i < 2; i++) {
      const q = [pair && pair.P1, pair && pair.P2][i];
      contactSegs[i].show(o.s2 && Boolean(q));
      if (q) contactSegs[i].set(state.T, q);
      angleArcs[i].show(o.s2 && Boolean(q && g.P));
      if (q && g.P) angleArcs[i].set(state.T, i === 0 ? q : g.P, i === 0 ? g.P : q, 16);
    }

    chordLine.show(o.s4 && hasPair);
    if (hasPair) chordLine.set(pair.P1, pair.P2);
    chordParts[0].show(o.s4 && hasPair);
    chordParts[1].show(o.s4 && hasPair);
    if (hasPair) {
      chordParts[0].set(pair.P1, pair.K1);
      chordParts[1].set(pair.P2, pair.K2);
    }
    midpointSegs[0].show(o.s4 && o.hint && hasPair);
    midpointSegs[1].show(o.s4 && o.hint && hasPair);
    if (hasPair) {
      midpointSegs[0].set(pair.B1, state.O1);
      midpointSegs[1].set(pair.B2, state.O2);
    }
    toBLine.show(o.s4 && o.hint && hasPair);
    if (hasPair) toBLine.set(state.T, pair.B);

    const hp = pair && g.radical ? [Core.foot(pair.P1, g.radical.a, g.radical.b),
                                    Core.foot(pair.P2, g.radical.a, g.radical.b)] : [null, null];
    for (let i = 0; i < 2; i++) {
      projections[i].show(o.s3 && Boolean(hp[i]));
      if (hp[i]) projections[i].set(i === 0 ? pair.P1 : pair.P2, hp[i]);
    }

    showPoint("P", g.possible && !g.cs.infinite && Boolean(g.P), g.P, "P");
    showPoint("Q", g.possible && !g.cs.infinite && Boolean(g.Q), g.Q, "Q");
    showPoint("CM", o.s1 && g.possible, g.cm.center, "CM");
    showPoint("CS", o.s1 && g.possible && !g.cs.infinite, g.cs.center, "CS");
    showPoint("E", o.s1 && Boolean(g.E), g.E, "E");
    showPoint("F", o.s1 && Boolean(g.F), g.F, "F");
    showPoint("L1", o.s4 && hasPair, pair && pair.P1, "L1");
    showPoint("L2", o.s4 && hasPair, pair && pair.P2, "L2");
    showPoint("K1", o.s4 && hasPair, pair && pair.K1, "K1");
    showPoint("K2", o.s4 && hasPair, pair && pair.K2, "K2");
    showPoint("B1", o.s4 && o.hint && hasPair, pair && pair.B1, "B1");
    showPoint("B2", o.s4 && o.hint && hasPair, pair && pair.B2, "B2");
    showPoint("B", o.s4 && o.hint && hasPair, pair && pair.B, "B");
    showPoint("H1", o.s3 && Boolean(hp[0]), hp[0], "H1");
    showPoint("H2", o.s3 && Boolean(hp[1]), hp[1], "H2");

    if (!g.possible) {
      say("Drag the two circle centres apart so both circles can be drawn.", null);
    } else if (g.cs.infinite) {
      say(Core.describe(state), null);
    } else if (!m || !hasPair) {
      say(Core.describe(state) + " Move T until it lies outside both circles.", null);
    } else if (checked) {
      say(`Checked: TP bisects the angle (${m[state.options.one ? "L" : "M"].bisectAngleDeg.toFixed(2)}° on each side); the two chord parts are ${m[state.options.one ? "L" : "M"].chord.toFixed(2)} long, and the two tangential lengths are ${m[state.options.one ? "L" : "M"].tangent.toFixed(2)}.`, "done");
    } else {
      say(Core.describe(state), null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function movePoint(name, p) {
    state = Core.withPoint(state, name, p);
    checked = false;
    syncHandles();
    render();
  }

  const clampBoard = (p) => Core.clampPoint(p);
  const describe = (p, name) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`;
  const hO1 = board.handle("O1", state.O1, {
    r: 8, step: 3, shift: 12, layer: handlesLayer, clamp: clampBoard, describe,
    label: "Centre O1 of the first circle. Drag it, or focus it and use the arrow keys.",
    onMove: (p) => movePoint("O1", p),
  });
  const hR1 = board.handle("R1", state.R1, {
    r: 7, step: 3, shift: 12, cls: "geom-handle aux-handle", layer: handlesLayer,
    clamp: clampBoard, describe,
    label: "Radius dot R1. Drag it, or focus it and use the arrow keys to change the first circle.",
    onMove: (p) => movePoint("R1", p),
  });
  const hO2 = board.handle("O2", state.O2, {
    r: 8, step: 3, shift: 12, layer: handlesLayer, clamp: clampBoard, describe,
    label: "Centre O2 of the second circle. Drag it, or focus it and use the arrow keys.",
    onMove: (p) => movePoint("O2", p),
  });
  const hR2 = board.handle("R2", state.R2, {
    r: 7, step: 3, shift: 12, cls: "geom-handle aux-handle", layer: handlesLayer,
    clamp: clampBoard, describe,
    label: "Radius dot R2. Drag it, or focus it and use the arrow keys to change the second circle.",
    onMove: (p) => movePoint("R2", p),
  });
  const hT = board.handle("T", state.T, {
    r: 8, step: 3, shift: 12, cls: "geom-handle t-handle", layer: handlesLayer,
    clamp: (p) => Core.restrict(state, p), describe,
    label: "Point T on the circle of similitude. Drag it, or focus it and use the arrow keys to slide it round the circle.",
    onMove: (p) => movePoint("T", p),
  });

  function syncHandles() {
    hO1.set(state.O1); hR1.set(state.R1); hO2.set(state.O2);
    hR2.set(state.R2); hT.set(state.T);
  }

  function syncButtons() {
    namesBtn.setAttribute("aria-pressed", String(state.options.names));
    namesBtn.textContent = state.options.names ? "Hide names" : "Show names";
    hintBtn.setAttribute("aria-pressed", String(state.options.hint));
    hintBtn.textContent = state.options.hint ? "Hide guide lines" : "Show guide lines";
    pairBtn.setAttribute("aria-pressed", String(state.options.one));
    pairBtn.textContent = state.options.one ? "Show M pair" : "Show L pair";
    for (let i = 0; i < 4; i++) {
      statementBtns[i].setAttribute("aria-pressed", String(state.options["s" + (i + 1)]));
    }
  }

  function newGame() {
    state = Core.reset(state);
    checked = false;
    syncHandles();
    syncButtons();
    render();
    hO1.node.focus();
  }

  function toggle(name) {
    state = Core.setOption(state, name, !state.options[name]);
    checked = false;
    syncButtons();
    render();
  }

  newBtn.addEventListener("click", newGame);
  namesBtn.addEventListener("click", () => toggle("names"));
  hintBtn.addEventListener("click", () => toggle("hint"));
  pairBtn.addEventListener("click", () => toggle("one"));
  for (let i = 0; i < 4; i++) {
    statementBtns[i].addEventListener("click", () => toggle("s" + (i + 1)));
  }
  checkBtn.addEventListener("click", () => {
    checked = true;
    render();
  });

  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if (key === "r") newGame();
    else if (key === "n") toggle("names");
    else if (key === "h") toggle("hint");
    else if (key === "l") toggle("one");
    else if (key === "c") { checked = true; render(); }
    else if ("1234".indexOf(key) >= 0 && key.length === 1) toggle("s" + key);
  });

  board.onTheme(render);
  syncButtons();
  render();
})();
