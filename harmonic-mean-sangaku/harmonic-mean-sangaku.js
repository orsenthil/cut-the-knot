"use strict";

/*
 * The page for Harmonic Mean Sangaku: drawing and input only; the rules are in
 * harmonic-mean-sangaku-core.js. The SVG holds two upright walls on a level
 * ground line, the two crossing ladders, their meeting point P, and the foot C
 * below it. Four focusable handles move A, B, D and E exactly as in the applet;
 * the ground and walls stay straight because the core applies the fix-ups.
 */

(function () {
  const Core = HarmonicMeanSangakuCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const hintBtn = document.getElementById("hintBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });
  const fmt = (v) => (Number.isFinite(v) ? (Math.round(v * 10) / 10).toFixed(1) : "—");
  const precise = (v) => (Number.isFinite(v) ? v.toFixed(4) : "—");

  let state = Core.start({ width: view.width, height: view.height });

  /* z-order: guides below the shapes, names below the handles. */
  const guidesLayer = board.layer("guides");
  const shapesLayer = board.layer("shapes");
  const marksLayer = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const ground = board.segment(state.A, state.B, "ground", shapesLayer);
  const walls = [
    board.segment(state.A, state.E, "wall", shapesLayer),
    board.segment(state.B, state.D, "wall", shapesLayer),
  ];
  const ladders = [
    board.segment(state.A, state.D, "ladder", shapesLayer),
    board.segment(state.B, state.E, "ladder", shapesLayer),
  ];
  const crossBar = board.segment(state.C, state.P, "cross-bar", shapesLayer);
  const rightAngle = board.rightAngle(state.C, state.P, state.B, 11, "right-angle", marksLayer);
  const pDot = board.point(state.P, "cross-dot", 5, marksLayer);
  const cDot = board.point(state.C, "cross-dot", 5, marksLayer);
  const labels = [
    { key: "A", text: "A", dx: -20, dy: 24 },
    { key: "B", text: "B", dx: 8, dy: 24 },
    { key: "C", text: "C", dx: -18, dy: 23 },
    { key: "D", text: "D", dx: 8, dy: -8 },
    { key: "E", text: "E", dx: -20, dy: -8 },
    { key: "P", text: "P", dx: -20, dy: -10 },
  ].map((o) => ({ ...o, node: board.label(state[o.key], o.text, "glabel", o.dx, o.dy, labelsLayer) }));
  const guides = [0, 1, 2, 3].map(() =>
    board.line({ x: 0, y: 0 }, { x: view.width, y: 0 }, "guide", guidesLayer));

  /**
   * Shows the line under the diagram. `kind` is "done" once the player has
   * checked the identity: that is how the shared record sees an explored
   * illustration. A demonstration has no win or loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measure(state);
    const valid = m.finite && !m.tooClose;

    ground.set(state.A, state.B);
    walls[0].set(state.A, state.E);
    walls[1].set(state.B, state.D);
    ladders[0].set(state.A, state.D);
    ladders[1].set(state.B, state.E);

    crossBar.show(valid && m.cp !== 0);
    rightAngle.show(valid && m.cp !== 0);
    pDot.show(valid);
    cDot.show(valid);
    if (valid) {
      crossBar.set(state.C, state.P);
      rightAngle.set(state.C, state.P, state.B, 11);
      pDot.set(state.P);
      cDot.set(state.C);
    }

    for (const o of labels) {
      o.node.show(state.showNames);
      if (state.showNames) o.node.set(state[o.key]);
    }
    const guideY = [state.C.y, state.P.y, state.D.y, state.E.y];
    for (let i = 0; i < guides.length; i++) {
      guides[i].show(state.showHint && valid);
      if (state.showHint && valid) {
        guides[i].set({ x: 0, y: guideY[i] }, { x: view.width, y: guideY[i] });
      }
    }

    handles.A.set(state.A);
    handles.B.set(state.B);
    handles.D.set(state.D);
    handles.E.set(state.E);

    if (m.tooClose) {
      say("Move the two wall feet apart; the ladders need a gap to cross.", null);
    } else if (!valid) {
      say("These ladder lines are parallel, so there is no crossing point. Move D or E.", null);
    } else if (state.checked && m.holds) {
      say(`Checked: CP = ${fmt(m.cp)}, so 1/CP = ${precise(m.left)} = 1/AE + 1/BD. Move the walls: CP stays ${fmt(m.cp)}.`, "done");
    } else {
      say(`AE = ${fmt(m.ae)}, BD = ${fmt(m.bd)}, CP = ${fmt(m.cp)}. 1/CP = ${precise(m.left)} and 1/AE + 1/BD = ${precise(m.right)}.`, null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const handleOptions = {
    r: 10, step: 4, shift: 16, layer: handlesLayer, clamp: inside,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  };
  function setPoint(name, p) {
    state = Core.withPoint(state, name, inside(p));
    render();
  }
  const handles = {
    A: board.handle("A", state.A, {
      ...handleOptions,
      label: "Foot A of the left wall. Drag, or focus and use the arrow keys to move it; the ground stays level.",
      onMove: (p) => setPoint("A", p),
    }),
    B: board.handle("B", state.B, {
      ...handleOptions,
      label: "Foot B of the right wall. Drag, or focus and use the arrow keys to move it; the ground stays level.",
      onMove: (p) => setPoint("B", p),
    }),
    D: board.handle("D", state.D, {
      ...handleOptions,
      label: "Top D of the right wall. Drag, or focus and use the arrow keys to change its height.",
      onMove: (p) => setPoint("D", p),
    }),
    E: board.handle("E", state.E, {
      ...handleOptions,
      label: "Top E of the left wall. Drag, or focus and use the arrow keys to change its height.",
      onMove: (p) => setPoint("E", p),
    }),
  };

  function newGame() {
    state = Core.start({
      width: view.width, height: view.height,
      showNames: state.showNames, showHint: state.showHint,
    });
    render();
  }

  function toggle(kind, btn, onText, offText) {
    state = { ...state, [kind]: !state[kind] };
    const on = state[kind];
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = on ? onText : offText;
    render();
  }

  function check() {
    state = Core.checkClaim(state);
    render();
    if (!state.checked) say("The crossing is not measurable here; move the points and check again.", null);
  }

  newBtn.addEventListener("click", newGame);
  namesBtn.addEventListener("click", () => toggle("showNames", namesBtn, "Hide names", "Show names"));
  hintBtn.addEventListener("click", () => toggle("showHint", hintBtn, "Hide guide lines", "Show guide lines"));
  checkBtn.addEventListener("click", check);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === "r") newGame();
    else if (k === "n") namesBtn.click();
    else if (k === "h") hintBtn.click();
    else if (k === "c") check();
  });

  board.onTheme(render);
  render();
})();
