"use strict";

/*
 * The page for BOL12: drawing and input only; the geometry is in
 * bol-12-core.js. An SVG holds the circle, its horizontal diameter, the two
 * tangents from T, the two lines AQ and BP, their meeting point R and the
 * perpendicular TR. C, the radius point Bo and T are draggable handles;
 * three buttons reproduce the applet's checkboxes and a fourth checks the claim.
 */

(function () {
  const Core = Bol12Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const statementBtn = document.getElementById("statementBtn");
  const hintBtn = document.getElementById("hintBtn");
  const checkBtn = document.getElementById("checkBtn");

  const add = Core.add, sub = Core.sub, mul = Core.mul, dist = Core.dist;
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  let state = Core.start();
  let checked = false;

  /* The objects are created once; every redraw only changes their geometry. */
  const fullCircle = board.circle(state.C, 1, "circle-full", shapes);
  const semi = board.arc(state.C, 1, Math.PI, 2 * Math.PI, "semicircle", shapes);
  const diameter = board.segment(state.C, state.C, "diameter", shapes);
  const crossA = board.segment(state.C, state.C, "cross-line", shapes);
  const crossB = board.segment(state.C, state.C, "cross-line", shapes);
  const chordA = board.segment(state.C, state.C, "chord", shapes);
  const chordB = board.segment(state.C, state.C, "chord", shapes);
  const tangentA = board.segment(state.C, state.C, "tangent", shapes);
  const tangentB = board.segment(state.C, state.C, "tangent", shapes);
  const trLine = board.line(state.C, state.C, "perpendicular", shapes);

  const hintCircle = board.circle(state.C, 1, "hint-circle", marks);
  const guideP = board.segment(state.C, state.C, "hint-guide", marks);
  const guideQ = board.segment(state.C, state.C, "hint-guide", marks);
  const rightA = board.rightAngle(state.C, state.C, state.C, 9, "right-mark", marks);
  const rightB = board.rightAngle(state.C, state.C, state.C, 9, "right-mark", marks);
  const pP = board.point(state.C, "derived-dot", 4, marks);
  const pQ = board.point(state.C, "derived-dot", 4, marks);
  const pR = board.point(state.C, "r-dot", 4.5, marks);
  const pM = board.point(state.C, "foot-dot", 3.5, marks);
  const pO = board.point(state.C, "hint-dot", 4, marks);
  const labels = {
    A: board.label(state.C, "A", "glabel", -19, 22, marks),
    B: board.label(state.C, "B", "glabel", 7, 22, marks),
    M: board.label(state.C, "M", "glabel", 7, 20, marks),
    P: board.label(state.C, "P", "glabel", 9, 15, marks),
    Q: board.label(state.C, "Q", "glabel", -19, 15, marks),
    R: board.label(state.C, "R", "glabel", 7, -9, marks),
    T: board.label(state.C, "T", "glabel", 9, -9, marks),
    O: board.label(state.C, "O", "glabel hint-label", 7, -9, marks),
  };

  const picture = [
    fullCircle, semi, diameter, crossA, crossB, chordA, chordB,
    tangentA, tangentB, trLine, hintCircle, guideP, guideQ,
    rightA, rightB, pP, pQ, pR, pM, pO, ...Object.values(labels),
  ];

  /**
   * Shows the line under the picture. `kind` is "done" once the illustration
   * has been explored (the shared record reads that class); there is no win
   * or loss here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.compute(state);
    if (!g || !g.valid) {
      picture.forEach((s) => s.show(false));
      say("Move T outside the circle, then the two touching points appear.", null);
      if (window.Track) window.Track.state(state);
      return;
    }
    picture.forEach((s) => s.show(true));

    fullCircle.set(g.C0, g.r);
    semi.set(g.C0, g.r, Math.PI, 2 * Math.PI);
    diameter.set(g.A, g.B);
    crossA.set(g.A, g.Q);
    crossB.set(g.B, g.P);
    chordA.set(g.A, g.P);
    chordB.set(g.B, g.Q);
    tangentA.set(g.T, g.P);
    tangentB.set(g.T, g.Q);
    trLine.set(g.T, g.R);
    hintCircle.set(g.T, g.hintRadius === null ? g.r : g.hintRadius);
    guideP.set(g.C0, g.P);
    guideQ.set(g.C0, g.Q);
    rightA.set(g.M, g.T, g.A, 9);
    rightB.set(g.M, g.T, g.B, 9);
    pP.set(g.P);
    pQ.set(g.Q);
    pR.set(g.R);
    pM.set(g.M);
    pO.set(g.O);

    // Put the moving labels on the far side of the diameter from their point.
    const below = (p) => (p.y > g.C0.y ? 19 : -9);
    labels.A.set(g.A);
    labels.B.set(g.B);
    labels.M.set(g.M);
    labels.P.set(g.P, "P", 9, below(g.P));
    labels.Q.set(g.Q, "Q", -19, below(g.Q));
    labels.R.set(g.R, "R", 9, below(g.R));
    labels.T.set(g.T, "T", 9, below(g.T));
    labels.O.set(g.O);
    for (const name of Object.keys(labels)) labels[name].show(state.showNames || (name === "O" && state.showHint));
    rightA.show(state.showStatement);
    rightB.show(state.showStatement);
    hintCircle.show(state.showHint);
    guideP.show(state.showHint);
    guideQ.show(state.showHint);
    pO.show(state.showHint);
    labels.O.show(state.showHint);

    const pass = Object.values(Core.claims(g)).every(Boolean);
    if (checked) {
      say(pass
        ? "Checked: R is directly above M, so TR meets AB at a right angle. TP, TQ and TR are equal."
        : "Move the points apart and check again.", pass ? "done" : null);
    } else if (state.explored) {
      say("TR meets AB at M at a right angle, wherever you put T.", "done");
    } else {
      say("Drag T, the centre or the edge point. Watch where the two lines cross.", null);
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function movePoint(name, p) {
    const next = Core.move(state, { type: "point", name, point: p });
    if (!next) return;
    state = next;
    checked = false;
    render();
  }

  function toggle(key) {
    const next = Core.move(state, { type: "option", key, value: !state[key] });
    if (!next) return;
    state = next;
    render();
  }

  const inside = (p) => Core.clampPoint(p);
  const clampRadius = (p) => {
    let q = inside(p);
    if (dist(q, state.C) < Core.MIN_RADIUS) {
      const away = dist(state.C, state.Bo) > 1e-9
        ? mul(sub(state.Bo, state.C), 1 / dist(state.C, state.Bo))
        : { x: -1, y: 0 };
      q = inside(add(state.C, mul(away, Core.MIN_RADIUS)));
    }
    return q;
  };

  const hC = board.handle("C", state.C, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
    label: "Circle centre C. Drag, or focus and use the arrow keys to move the circle.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("C", p),
  });
  const hBo = board.handle("Bo", state.Bo, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampRadius,
    label: "Point Bo on the circle. Drag, or focus and use the arrow keys to change the radius.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("Bo", p),
  });
  const hT = board.handle("T", state.T, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
    label: "Outside point T. Drag, or focus and use the arrow keys to move it around the circle.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("T", p),
  });

  function syncSwitches() {
    const set = (btn, on, onText, offText) => {
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? onText : offText;
    };
    set(namesBtn, state.showNames, "Hide names", "Show names");
    set(statementBtn, state.showStatement, "Hide right angles", "Show right angles");
    set(hintBtn, state.showHint, "Hide hint", "Show hint");
  }

  function newGame() {
    const switches = {
      showNames: state.showNames,
      showStatement: state.showStatement,
      showHint: state.showHint,
    };
    state = Core.start(switches);
    checked = false;
    hC.set(state.C);
    hBo.set(state.Bo);
    hT.set(state.T);
    render();
    hT.node.focus();
  }

  function checkClaim() {
    checked = true;
    render();
  }

  newBtn.addEventListener("click", newGame);
  namesBtn.addEventListener("click", () => { toggle("showNames"); syncSwitches(); });
  statementBtn.addEventListener("click", () => { toggle("showStatement"); syncSwitches(); });
  hintBtn.addEventListener("click", () => { toggle("showHint"); syncSwitches(); });
  checkBtn.addEventListener("click", checkClaim);
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if (key === "r") newGame();
    else if (key === "n") { toggle("showNames"); syncSwitches(); }
    else if (key === "s") { toggle("showStatement"); syncSwitches(); }
    else if (key === "h") { toggle("showHint"); syncSwitches(); }
    else if (key === "c") checkClaim();
  });

  board.onTheme(render);
  syncSwitches();
  render();
})();
