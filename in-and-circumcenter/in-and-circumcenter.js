"use strict";

/*
 * The page for In And Circumcenter: drawing and input only; the construction
 * is in in-and-circumcenter-core.js. An SVG holds a triangle with three
 * draggable corners, its incenter I and circumcenter O, the circles around
 * them, and the segment DE obtained by laying AB off along CA and CB.
 * The four toggles follow the applet's "names / statement / premise / hint".
 */

(function () {
  const Core = InAndCircumcenterCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const angleBtn = document.getElementById("angleBtn");
  const checkBtn = document.getElementById("checkBtn");
  const namesBtn = document.getElementById("namesBtn");
  const statementBtn = document.getElementById("statementBtn");
  const premiseBtn = document.getElementById("premiseBtn");
  const hintBtn = document.getElementById("hintBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  let state = Core.start();
  let checked = false;
  let show = { names: true, statement: false, premise: false, hint: false };

  const base = board.layer("base");
  const lines = board.layer("lines");
  const hintLayer = board.layer("hint");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  /* Built once; every redraw only calls .set() and .show() on these objects. */
  const outCircle = board.circle(state.A, 1, "circum-circle", base);
  const inCircle = board.circle(state.A, 1, "incircle", base);
  const sides = [
    board.segment(state.A, state.B, "tri-side", base),
    board.segment(state.B, state.C, "tri-side", base),
    board.segment(state.C, state.A, "tri-side", base),
  ];
  const ioLine = board.line(state.A, state.B, "io-line", lines);
  const deLine = board.line(state.A, state.B, "de-line", lines);
  const premiseLines = [
    board.segment(state.A, state.B, "side-extension", lines),
    board.segment(state.A, state.B, "side-extension", lines),
  ];
  const rightMark = board.rightAngle(state.A, state.B, state.C, 10, "right-mark", marks);
  const dDot = board.point(state.A, "de-dot", 5, marks);
  const eDot = board.point(state.A, "de-dot", 5, marks);
  const iDot = board.point(state.A, "center-dot", 5, marks);
  const oDot = board.point(state.A, "circum-dot", 5, marks);
  const hintDots = Array.from({ length: 6 }, () => board.point(state.A, "hint-dot", 3, marks));

  /* Two little crossbars on each of AB, AE and BD, as the applet's LineID. */
  function tickPair() {
    return [board.segment(state.A, state.B, "equal-tick", marks),
      board.segment(state.A, state.B, "equal-tick", marks)];
  }
  const ticks = [tickPair(), tickPair(), tickPair()];
  function setTick(pair, p, q) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const ux = dx / len, uy = dy / len;
    for (let i = 0; i < 2; i++) {
      const t = 0.5 + (i - 0.5) * 0.09;
      const cx = p.x + dx * t, cy = p.y + dy * t;
      pair[i].set({ x: cx - nx * 5 - ux * 2, y: cy - ny * 5 - uy * 2 },
        { x: cx + nx * 5 + ux * 2, y: cy + ny * 5 + uy * 2 });
    }
  }

  const hintLines = Array.from({ length: 9 }, () =>
    board.line(state.A, state.B, "hint-line", hintLayer));
  const names = [
    board.label(state.A, "A", "glabel", -20, 24, labels),
    board.label(state.B, "B", "glabel", -20, -10, labels),
    board.label(state.C, "C", "glabel", 10, 6, labels),
    board.label(state.A, "D", "glabel d-label", 8, -8, labels),
    board.label(state.A, "E", "glabel d-label", -18, -8, labels),
    board.label(state.A, "I", "glabel i-label", 8, -8, labels),
    board.label(state.A, "O", "glabel o-label", 8, 18, labels),
    board.label(state.A, "X", "glabel x-label", -18, -8, labels),
    board.label(state.A, "Y", "glabel x-label", -18, -8, labels),
    board.label(state.A, "A'", "glabel x-label", -22, -8, labels),
    board.label(state.A, "B'", "glabel x-label", -22, -8, labels),
    board.label(state.A, "D'", "glabel x-label", -22, -8, labels),
    board.label(state.A, "E'", "glabel x-label", -22, -8, labels),
  ];

  /**
   * The status line under the board. "done" is how the player's record learns
   * that the illustration has been checked; there is no win or loss here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    const ok = !m.degenerate;

    sides[0].set(state.A, state.B);
    sides[1].set(state.B, state.C);
    sides[2].set(state.C, state.A);

    outCircle.show(ok && finite(m.O) && Number.isFinite(m.rOut));
    inCircle.show(ok && finite(m.I) && Number.isFinite(m.rIn));
    if (ok) {
      outCircle.set(m.O, m.rOut);
      inCircle.set(m.I, m.rIn);
    }

    ioLine.show(ok);
    deLine.show(ok);
    if (ok) {
      ioLine.set(...m.IO);
      deLine.set(...m.DE);
    }

    for (let i = 0; i < premiseLines.length; i++) {
      const seg = m.extra[i];
      premiseLines[i].show(show.premise && Boolean(seg) && seg.every(finite));
      if (seg && seg.every(finite)) premiseLines[i].set(...seg);
    }
    const tickSegments = [[state.A, state.B], [state.A, m.E], [state.B, m.D]];
    for (let i = 0; i < ticks.length; i++) {
      const [p, q] = tickSegments[i];
      const good = show.premise && ok && finite(q);
      ticks[i][0].show(good);
      ticks[i][1].show(good);
      if (good) setTick(ticks[i], p, q);
    }

    rightMark.show(show.statement && ok && finite(m.S));
    if (ok && finite(m.S)) rightMark.set(m.S, m.E, m.markPoint, 10);

    dDot.show(ok); eDot.show(ok); iDot.show(ok); oDot.show(ok);
    if (ok) {
      dDot.set(m.D); eDot.set(m.E); iDot.set(m.I); oDot.set(m.O);
    }
    dDot.node.setAttribute("r", show.statement ? 7 : 5);
    eDot.node.setAttribute("r", show.statement ? 7 : 5);

    const hintPairs = [
      [m.I, m.X], [m.I, m.Y], [m.O, m.Ap], [m.O, m.Bp],
      [m.I, m.Dp], [m.I, m.Ep], [m.Dp, m.Ep],
      Core.extraSegment(m.Dp, m.O, m.Ap), Core.extraSegment(m.Ep, m.O, m.Bp),
    ];
    for (let i = 0; i < hintLines.length; i++) {
      const pair = hintPairs[i];
      const good = show.hint && ok && pair && pair.every(finite);
      hintLines[i].show(Boolean(good));
      if (good) hintLines[i].set(...pair);
    }
    const hintPoints = [m.Dp, m.Ep, m.Ap, m.Bp, m.X, m.Y];
    for (let i = 0; i < hintDots.length; i++) {
      const good = show.hint && ok && finite(hintPoints[i]);
      hintDots[i].show(Boolean(good));
      if (good) hintDots[i].set(hintPoints[i]);
    }

    const at = [state.A, state.B, state.C, m.D, m.E, m.I, m.O,
      m.X, m.Y, m.Ap, m.Bp, m.Dp, m.Ep];
    const visible = [true, true, true, true, true, true, true,
      show.hint, show.hint, show.hint, show.hint, show.hint, show.hint];
    for (let i = 0; i < names.length; i++) {
      const good = show.names && visible[i] && ok && finite(at[i]);
      names[i].show(Boolean(good));
      if (finite(at[i])) names[i].set(at[i]);
    }

    if (!ok) {
      say("Move the corners apart to make a triangle.");
    } else if (checked) {
      const cl = Core.claims(state);
      if (!cl.all) {
        say("This triangle is too thin to check. Move the corners apart.", null);
      } else {
        const deg = m.angleC * 180 / Math.PI;
        say(Math.abs(deg - 30) < 0.05
          ? "Angle C is 30 degrees: DE and IO are equal, and they cross at right angles."
          : `DE crosses IO at right angles and is ${(m.deLength / m.ioLength).toFixed(2)} times as long as IO; 2 sin(C) = ${(2 * Math.sin(m.angleC)).toFixed(2)}.`,
          "done");
      }
    } else if (show.statement) {
      say("The little square at S marks the right angle where DE crosses IO.");
    } else if (show.premise) {
      say("AB has been laid off along CA and CB: AE = AB and BD = AB.");
    } else if (show.hint) {
      say("The midpoints A' and B', the feet X and Y, and the points D' and E' build the rectangle behind the right angle.");
    } else {
      say("Drag A, B or C. DE always crosses IO at right angles; press Check the claims to test the length.");
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state({
      A: { ...state.A }, B: { ...state.B }, C: { ...state.C },
    });
  }

  function moveVertex(name, p) {
    state = Core.withPoint(state, name, inside(p));
    checked = false;
    render();
  }

  const handleOpts = (label) => ({
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
    label: label,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  });
  const hA = board.handle("A", state.A, handleOpts("Corner A. Drag, or focus and use the arrow keys to move it"));
  const hB = board.handle("B", state.B, handleOpts("Corner B. Drag, or focus and use the arrow keys to move it"));
  const hC = board.handle("C", state.C, handleOpts("Corner C. Drag, or focus and use the arrow keys to move it"));
  for (const [handle, name] of [[hA, "A"], [hB, "B"], [hC, "C"]]) {
    handle.onMove((p) => moveVertex(name, p));
  }

  function toggle(which, btn, onText, offText) {
    show[which] = !show[which];
    btn.setAttribute("aria-pressed", String(show[which]));
    btn.textContent = show[which] ? offText : onText;
    render();
  }

  function newGame() {
    state = Core.start();
    checked = false;
    render();
    hA.node.focus();
  }

  function makeThirty() {
    state = Core.withAngleC(state, 30);
    checked = false;
    render();
    hB.node.focus();
  }

  function checkClaims() {
    checked = Core.claims(state).all;
    render();
    if (!checked && !Core.measurements(state).degenerate) {
      say("This triangle is too thin to check. Move the corners apart.", null);
    }
  }

  newBtn.addEventListener("click", newGame);
  angleBtn.addEventListener("click", makeThirty);
  checkBtn.addEventListener("click", checkClaims);
  namesBtn.addEventListener("click", () => toggle("names", namesBtn, "Show names", "Hide names"));
  statementBtn.addEventListener("click", () => toggle("statement", statementBtn, "Show statement", "Hide statement"));
  premiseBtn.addEventListener("click", () => toggle("premise", premiseBtn, "Show premise", "Hide premise"));
  hintBtn.addEventListener("click", () => toggle("hint", hintBtn, "Show hint", "Hide hint"));
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLButtonElement) return;
    if (e.key === "r" || e.key === "R") newGame();
    if (e.key === "c" || e.key === "C") checkClaims();
    if (e.key === "3") makeThirty();
  });

  board.onTheme(render);
  render();
})();
