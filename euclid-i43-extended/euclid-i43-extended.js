"use strict";

/*
 * Euclid I.43 Extended — drawing and input only. The geometry is in
 * euclid-i43-extended-core.js. Five handles move the parallelogram corners and
 * the point X; every other point of the construction is recomputed there.
 * Fills follow the applet's Draw(): blue XNCP, red ASRQ (or its same-side
 * version), and the two orange pieces when "areas on the same side of BD" is
 * ticked. All SVG objects are created once and only updated on a redraw, so a
 * handle keeps keyboard focus while the rest of the diagram moves.
 */

(function () {
  const Core = EuclidI43ExtendedCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const sameBox = document.getElementById("sameSide");
  const proofBox = document.getElementById("proof");
  const newBtn = document.getElementById("newBtn");
  const resetBtn = document.getElementById("resetBtn");
  const abdBtn = document.getElementById("abdBtn");
  const bcdBtn = document.getElementById("bcdBtn");

  let state = Core.start();

  const fills = board.layer("fills");
  const guides = board.layer("guides");
  const edges = board.layer("edges");
  const dots = board.layer("dots");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const collapse = [state.A, state.A, state.A, state.A];
  const blue = board.polygon(collapse, "blue-fill", fills);
  const red = board.polygon(collapse, "red-fill", fills);
  const orange1 = board.polygon(collapse, "orange-fill", fills);
  const orange2 = board.polygon(collapse, "orange-fill alt", fills);

  /* Every line is made once; render() decides which ones the current
     construction needs and gives the rest no points to draw. */
  function segment(key, cls, layer) {
    return { api: board.segment(state.A, state.A, cls, layer || edges), key };
  }
  const outline = {
    AB: segment("AB", "edge"), BC: segment("BC", "edge accent-edge"),
    CD: segment("CD", "edge"), DA: segment("DA", "edge"),
  };
  const aux = {
    BD: segment("BD", "diagonal"),
    MP: segment("MP", "aux-line"), NQ: segment("NQ", "aux-line"),
    RS: segment("RS", "aux-line accent-edge"),
    UV: segment("UV", "aux-line"),
    BX: segment("BX", "centre-line"), XD: segment("XD", "centre-line"),
    BY: segment("BY", "centre-line"),
    AC: segment("AC", "diagonal faint"),
  };
  const proof = {
    QN: segment("QN", "proof-line"), AW: segment("AW", "proof-line"),
    CF: segment("CF", "proof-line"), RK: segment("RK", "proof-line"),
    DW: segment("DW", "proof-line"), WR: segment("WR", "proof-line"),
    WF: segment("WF", "proof-line"),
  };
  const allLines = Object.assign({}, outline, aux, proof);

  /* T, the intersection of RS and UV, is computed by the applet but not
     drawn; the math section explains why it lies on AX. */
  const dotNames = ["M", "N", "P", "Q", "R", "S", "U", "V", "Y", "W", "K", "E", "F"];
  const dotApi = {};
  for (const name of dotNames) dotApi[name] = board.point(state.A, "aux-dot", 3, dots);

  const labelOffsets = {
    A: [-15, 17], B: [7, 17], C: [8, -10], D: [-16, -10], X: [7, 17],
    M: [-16, 17], N: [6, 15], P: [6, -10], Q: [-17, -10],
    R: [7, -10], S: [7, 17], U: [6, 15], V: [-16, -10],
    Y: [7, 17], W: [7, 17], K: [7, -10], E: [7, 15], F: [7, -10],
  };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label(state.A, name, "point-label",
      labelOffsets[name][0], labelOffsets[name][1], labelsLayer);
  }

  const handleOptions = {
    step: 5, shift: 15, r: 9, layer: handlesLayer,
    clamp: (p) => Core.clampToBoard(p),
  };
  const handles = {};
  for (const name of ["A", "B", "C", "D", "X"]) {
    handles[name] = board.handle(name, state[name], Object.assign({}, handleOptions, {
      cls: name === "X" ? "geom-handle x-handle" : "geom-handle",
      label: name === "X"
        ? "Point X. Drag it, or focus it and use the arrow keys to move it inside the parallelogram."
        : `Corner ${name}. Drag it, or focus it and use the arrow keys to change the parallelogram.`,
      onMove: (p, who) => {
        state = Core.movePoint(state, who, p);
        render();
      },
    }));
  }

  /** Shared status line: the record sees "done" once the picture is explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const good = (pts) => pts.every(Core.finite);
  function setShape(shape, on, pts, fallback) {
    shape.show(!!on);
    if (on) shape.set(good(pts) ? pts : (fallback || collapse));
  }
  function setLine(shape, on, p, q) {
    shape.api.show(!!on && Core.finite(p) && Core.finite(q));
    if (on) shape.api.set(p || state.A, q || state.A);
  }
  function setDot(name, on, p) {
    dotApi[name].show(!!on && Core.finite(p));
    if (on && Core.finite(p)) dotApi[name].set(p);
  }
  function setLabel(name, on, p) {
    labels[name].show(!!on && Core.finite(p));
    if (on && Core.finite(p)) labels[name].set(p);
  }

  function render() {
    const g = Core.compute(state);
    const live = !g.outOfBounds && g.finite;
    for (const name of ["A", "B", "C", "D", "X"]) handles[name].set(state[name]);

    const redPts = state.sameSide
      ? (g.sameBranch ? [g.A, g.M, g.X, g.Q] : [g.A, g.S, g.T, g.V])
      : [g.A, g.Q, g.R, g.S];
    const orangeAPts = state.sameSide
      ? (g.sameBranch ? [g.Q, g.X, g.U, g.V] : [g.V, g.T, g.R, g.Q])
      : collapse;
    const orangeBPts = state.sameSide
      ? (g.sameBranch ? [g.X, g.M, g.S, g.R] : [g.S, g.M, g.U, g.T])
      : collapse;
    setShape(blue, live, [g.X, g.N, g.C, g.P]);
    setShape(red, live, redPts);
    setShape(orange1, live && state.sameSide, orangeAPts);
    setShape(orange2, live && state.sameSide, orangeBPts);

    setLine(outline.AB, true, g.A, g.B);
    setLine(outline.BC, true, g.B, g.C);
    setLine(outline.CD, true, g.C, g.D);
    setLine(outline.DA, true, g.D, g.A);
    setLine(aux.BD, live, g.B, g.D);
    setLine(aux.MP, live, g.M, g.P);
    setLine(aux.NQ, live, g.N, g.Q);
    setLine(aux.RS, live, g.R, g.S);
    setLine(aux.UV, live && state.sameSide, g.U, g.V);
    setLine(aux.BX, live, g.B, g.X);
    setLine(aux.XD, live, g.X, g.D);
    setLine(aux.BY, live, g.B, g.Y);
    setLine(aux.AC, live && state.sameSide, g.A, g.C);
    setLine(proof.QN, live && state.showProof, g.Q, g.N);
    setLine(proof.AW, live && state.showProof, g.A, g.W);
    setLine(proof.CF, live && state.showProof, g.C, g.F);
    setLine(proof.RK, live && state.showProof, g.R, g.K);
    setLine(proof.DW, live && state.showProof, g.D, g.W);
    setLine(proof.WR, live && state.showProof, g.W, g.R);
    setLine(proof.WF, live && state.showProof, g.W, g.F);

    for (const name of dotNames) {
      const on = state.showNames && live &&
        (["U", "V"].includes(name) ? state.sameSide
          : ["W", "K", "E", "F"].includes(name) ? state.showProof : true);
      setDot(name, on, g[name]);
    }
    for (const name of Object.keys(labelOffsets)) {
      const on = state.showNames &&
        (["A", "B", "C", "D", "X"].includes(name) ||
          (live && (["U", "V"].includes(name) ? state.sameSide
            : ["W", "K", "E", "F"].includes(name) ? state.showProof : true)));
      setLabel(name, on, g[name] || state[name]);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The picture, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, X: g.X,
        M: live ? g.M : null, N: live ? g.N : null,
        P: live ? g.P : null, Q: live ? g.Q : null,
        R: live ? g.R : null, S: live ? g.S : null,
        T: live ? g.T : null, U: live ? g.U : null,
        V: live ? g.V : null, Y: live ? g.Y : null,
        region: g.region, outOfBounds: g.outOfBounds,
        amxq: live ? g.amxq : null, xncp: live ? g.xncp : null,
        asrq: live ? g.asrq : null, gap: live ? g.gap : null,
        showNames: state.showNames, sameSide: state.sameSide, showProof: state.showProof,
      });
    }
  }

  function option(box, key) {
    box.checked = state[key];
    box.addEventListener("change", () => {
      state = Core.setOption(state, key, box.checked);
      render();
    });
  }
  option(namesBox, "showNames");
  option(sameBox, "sameSide");
  option(proofBox, "showProof");

  newBtn.addEventListener("click", () => { state = Core.randomize(state); render(); });
  resetBtn.addEventListener("click", () => { state = Core.reset(state); render(); });
  abdBtn.addEventListener("click", () => { state = Core.setRegion(state, "ABD"); render(); });
  bcdBtn.addEventListener("click", () => { state = Core.setRegion(state, "BCD"); render(); });

  // Colours are CSS classes, so a theme flip needs no new geometry; redraw
  // anyway to keep the shared Geom hook.
  board.onTheme(render);
  render();
})();
