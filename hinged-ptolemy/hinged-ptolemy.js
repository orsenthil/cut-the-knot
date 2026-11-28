"use strict";

/*
 * The page for Hinged Ptolemy: drawing and input only; all the geometry is in
 * hinged-ptolemy-core.js. The stage holds a circle with four draggable points
 * A, B, C and P on it. The Rotation slider swings triangle ACP around A just
 * as the applet's scrollbar did: at 100% C' sits on AB and C'P' is parallel
 * to BP; the original scrollbar even allows 105%, which we keep.
 * This is an illustration — there is nothing to win or lose.
 */

(function () {
  const Core = HingedPtolemyCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const rotInput = document.getElementById("rotation");
  const rotOut = document.getElementById("rotationOut");
  const namesBox = document.getElementById("names");
  const resetBtn = document.getElementById("newBtn");

  let state = Core.start();

  /** The line below the picture. An illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Paint order matches Draw in the applet: circle, original lines, the
     swung copy, extensions, dots, names, handles. */
  const guides = board.layer("guides");
  const original = board.layer("original");
  const turning = board.layer("turning");
  const extensions = board.layer("extensions");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const tops = board.layer("handles");

  const circle = board.circle(state.center, state.radius, "circ", guides);
  const ab = board.segment(state.A, state.B, "edge", original);
  const ac = board.segment(state.A, state.C, "edge", original);
  const cb = board.segment(state.C, state.B, "edge", original);
  const ap = board.segment(state.A, state.P, "quad", original);
  const bp = board.segment(state.B, state.P, "quad", original);
  const cp = board.segment(state.C, state.P, "quad", original);
  const acp = board.segment(state.A, state.C, "swing", turning);
  const cppp = board.segment(state.C, state.P, "swing", turning);
  const appq = board.line(state.A, state.P, "spoke", turning);
  const bpLine = board.line(state.B, state.P, "extend", extensions);
  const cpLine = board.line(state.C, state.P, "extend", extensions);

  const fixedDot = {};
  ["A", "B", "C", "P"].forEach((name) => {
    fixedDot[name] = board.point(state[name], "fixed-dot", 4, dots);
  });
  const cpDot = board.point(state.C, "turn-dot", 4, dots);
  const ppDot = board.point(state.P, "turn-dot", 4, dots);
  const pqDot = board.point(state.P, "meet-dot", 4.5, dots);

  const fixedName = {};
  ["A", "B", "C", "P"].forEach((name) => {
    fixedName[name] = board.label(state[name], name, "pt-label", 9, -9, names);
  });
  const cpName = board.label(state.C, "C'", "pt-label turn-label", 9, -9, names);
  const ppName = board.label(state.P, "P'", "pt-label turn-label", 9, -9, names);
  const pqName = board.label(state.P, "P''", "pt-label turn-label", 9, 18, names);
  const angleName = board.label({ x: 6, y: 18 }, "", "angle-label", 0, 0, names);

  const clampToCircle = (q) => Core.projectToCircle(state.center, state.radius, q) || { x: state.center.x + state.radius, y: state.center.y };
  const handles = {};
  ["A", "B", "C", "P"].forEach((name) => {
    handles[name] = board.handle(name, state[name], {
      r: 12, step: 4, shift: 12, cls: "geom-handle", layer: tops,
      label: `Point ${name} on the circle. Drag it, or focus it and use the arrow keys to move it round the circle.`,
      describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
      clamp: clampToCircle,
      onMove: (p) => { state = Core.withPoint(state, name, p); render(); },
    });
  });

  function render() {
    const g = Core.compute(state);
    const m = Core.measure(state, g);
    const full = state.rotation >= 100;
    const visible = state.showNames;

    circle.set(state.center, state.radius);
    ab.set(state.A, state.B);
    ac.set(state.A, state.C);
    cb.set(state.C, state.B);
    ap.set(state.A, state.P);
    bp.set(state.B, state.P);
    cp.set(state.C, state.P);
    acp.set(state.A, g.Cp);
    cppp.set(g.Pp, g.Cp);
    appq.set(state.A, full ? g.Pq : g.Pp);
    bpLine.set(state.B, state.P);
    cpLine.set(g.Cp, g.Pp);
    bpLine.show(full);
    cpLine.show(full);

    ["A", "B", "C", "P"].forEach((name) => {
      fixedDot[name].set(state[name]);
      handles[name].set(state[name]);
      fixedName[name].set(state[name], name);
      fixedName[name].show(visible);
    });
    cpDot.set(g.Cp, 4);
    ppDot.set(g.Pp, 4);
    pqDot.set(g.Pq, 4.5);
    cpDot.show(state.rotation > 0);
    ppDot.show(state.rotation > 0);
    pqDot.show(full);
    cpName.set(g.Cp, "C'");
    ppName.set(g.Pp, "P'");
    pqName.set(g.Pq, "P''");
    const showTurnNames = visible && state.rotation > 0 && Core.dist(state.B, g.Cp) > 10;
    cpName.show(showTurnNames);
    ppName.show(showTurnNames);
    pqName.show(showTurnNames);
    angleName.set({ x: 6, y: 18 }, `Turn: ${((g.angle * 180) / Math.PI).toFixed(1)}\u00b0`);
    angleName.show(true);

    rotInput.value = String(state.rotation);
    rotOut.value = `${state.rotation}%`;
    rotOut.textContent = `${state.rotation}%`;
    namesBox.checked = state.showNames;
    say(Core.describe(state, g, m));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  rotInput.addEventListener("input", () => {
    state = Core.setRotation(state, rotInput.value);
    render();
  });
  namesBox.addEventListener("change", () => {
    state = Core.setShowNames(state, namesBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start();
    render();
  });

  board.onTheme(render);
  render();
})();
