"use strict";

/*
 * The Equal Angles In Crossed Circles page: drawing and input only. All the
 * geometry — the two circumcircles, the chord's intersections and the four
 * angles — lives in equal-angles-in-crossed-circles-core.js.
 *
 * Four handles (S, T, RB, RS) can be dragged or moved with the arrow keys.
 * The three checkboxes from the applet are buttons here: names on the point
 * labels, statement on the two equal marked angles, extra on the dashed
 * chords and the second pair of angles. The illustration has no win or loss.
 */

(function () {
  const Core = EqualAnglesInCrossedCirclesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBtn = document.getElementById("namesBtn");
  const statementBtn = document.getElementById("statementBtn");
  const extraBtn = document.getElementById("extraBtn");
  const newBtn = document.getElementById("newBtn");
  const degree = (r) => Number.isFinite(r) ? `${(r * 180 / Math.PI).toFixed(1)}°` : "—";

  let state = Core.start();
  let shown = Core.compute(state); // the applet keeps the last picture when S≈T
  let shownValid = false;

  const gridLayer = board.layer("grid");
  const circleLayer = board.layer("circles");
  const chordLayer = board.layer("chord");
  const spokeLayer = board.layer("spokes");
  const extraLayer = board.layer("extra");
  const arcLayer = board.layer("arcs");
  const dotsLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const bigCircle = board.circle(state.S, 1, "circle-main", circleLayer);
  const smallCircle = board.circle(state.S, 1, "circle-small", circleLayer);
  const chord = board.line(state.S, state.T, "chord-line", chordLayer);
  const baseLines = [0, 1, 2, 3, 4].map(() =>
    board.segment(state.S, state.T, "spoke", spokeLayer));
  const extraLines = [0, 1, 2, 3].map(() =>
    board.segment(state.S, state.T, "extra-line", extraLayer));
  const mainArcs = [0, 1, 2, 3].map(() =>
    board.angleArc(state.S, state.S, state.T, 20, "angle-main", arcLayer));
  const extraArcs = [0, 1].map(() =>
    board.angleArc(state.S, state.S, state.T, 30, "angle-extra", arcLayer));
  const dots = [0, 1, 2, 3].map(() => board.point(state.S, "cross-dot", 4, dotsLayer));

  const labels = [
    board.label(state.S, "A", "glabel", -16, -10, labelLayer),
    board.label(state.S, "B", "glabel", 7, -10, labelLayer),
    board.label(state.S, "P", "glabel", -16, 16, labelLayer),
    board.label(state.S, "Q", "glabel", 7, 16, labelLayer),
    board.label(state.S, "S", "glabel label-st", -16, -8, labelLayer),
    board.label(state.S, "T", "glabel label-st", 8, -8, labelLayer),
    board.label(state.S, "RB", "glabel label-h", -20, 18, labelLayer),
    board.label(state.S, "RS", "glabel label-h", 8, 18, labelLayer),
  ];

  /** Status line for a line of text. An illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function setArc(arc, vertex, p, q, radius, enabled) {
    const usable = enabled && [vertex, p, q].every(Core.finitePt) &&
      Number.isFinite(Core.angle(vertex, p, q));
    arc.show(usable);
    if (usable) arc.set(vertex, p, q, radius);
  }

  function render() {
    const d = Core.compute(state);
    if (d.stale) {
      // The Java Compute() returns before updating anything when S and T
      // are less than one unit apart; its last drawing stays on screen.
    } else {
      shown = d;
      shownValid = Core.drawn(d);
    }

    const good = shownValid;
    bigCircle.show(good);
    smallCircle.show(good);
    chord.show(good);
    if (good) {
      bigCircle.set(shown.bigCircle, shown.bigCircle.r);
      smallCircle.set(shown.smallCircle, shown.smallCircle.r);
      chord.set(shown.RS, shown.RB);
      const solid = [
        [shown.T, shown.B], [shown.T, shown.Q],
        [shown.S, shown.A], [shown.S, shown.P], [shown.S, shown.T],
      ];
      baseLines.forEach((line, i) => line.set(solid[i][0], solid[i][1]));
      const dashed = [
        [shown.S, shown.B], [shown.S, shown.Q],
        [shown.T, shown.A], [shown.T, shown.P],
      ];
      extraLines.forEach((line, i) => {
        line.show(state.extra);
        if (state.extra) line.set(dashed[i][0], dashed[i][1]);
      });
      [shown.A, shown.B, shown.P, shown.Q].forEach((p, i) => dots[i].set(p));
      setArc(mainArcs[0], shown.S, shown.A, shown.P, 20, state.statement);
      setArc(mainArcs[1], shown.S, shown.A, shown.P, 25, state.statement);
      setArc(mainArcs[2], shown.T, shown.B, shown.Q, 20, state.statement);
      setArc(mainArcs[3], shown.T, shown.B, shown.Q, 25, state.statement);
      setArc(extraArcs[0], shown.S, shown.Q, shown.B, 30, state.extra);
      setArc(extraArcs[1], shown.T, shown.P, shown.A, 30, state.extra);
    } else {
      mainArcs.concat(extraArcs).forEach((arc) => arc.show(false));
    }
    baseLines.forEach((line) => line.show(good));
    dots.forEach((dot) => dot.show(good));

    const display = [shown.A, shown.B, shown.P, shown.Q, shown.S, shown.T, shown.RB, shown.RS];
    const visible = good && state.names;
    labels.forEach((label, i) => {
      label.set(display[i] || state.S);
      label.show(visible);
    });

    namesBtn.setAttribute("aria-pressed", String(state.names));
    statementBtn.setAttribute("aria-pressed", String(state.statement));
    extraBtn.setAttribute("aria-pressed", String(state.extra));
    hS.set(state.S); hT.set(state.T); hRB.set(state.RB); hRS.set(state.RS);

    if (d.stale) {
      say("S and T are almost on top of each other. The applet keeps the last picture; pull one of them away.", null);
    } else if (!good) {
      say("The chord does not cut both circles here. Move RB, RS, S or T until it crosses each circle twice.", null);
    } else {
      const message =
        `∠ASP = ∠BTQ = ${degree(shown.angleASP)}. ` +
        `∠ATP = ∠BSQ = ${degree(shown.angleATP)}.`;
      say(message, null);
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({ S: state.S, T: state.T, RB: state.RB, RS: state.RS,
        names: state.names, statement: state.statement, extra: state.extra });
    }
  }

  function move(name, p) {
    state = Core.withPoint(state, name, p);
    render();
  }
  const handleOptions = (name) => ({
    r: 9, step: 3, shift: 12, layer: handleLayer,
    clamp: (p) => Core.inside(p),
    label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move(name, p),
  });
  const hS = board.handle("S", state.S, handleOptions("S"));
  const hT = board.handle("T", state.T, handleOptions("T"));
  const hRB = board.handle("RB", state.RB, handleOptions("RB"));
  const hRS = board.handle("RS", state.RS, handleOptions("RS"));

  function toggle(name) {
    state = Core.withToggle(state, name, !state[name]);
    render();
  }
  function reset() {
    state = Core.start({ names: state.names, statement: state.statement, extra: state.extra });
    shown = Core.compute(state);
    shownValid = Core.drawn(shown);
    render();
    hS.node.focus();
  }

  namesBtn.addEventListener("click", () => toggle("names"));
  statementBtn.addEventListener("click", () => toggle("statement"));
  extraBtn.addEventListener("click", () => toggle("extra"));
  newBtn.addEventListener("click", reset);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
    const key = e.key.toLowerCase();
    if (key === "n") toggle("names");
    else if (key === "s") toggle("statement");
    else if (key === "e") toggle("extra");
    else if (key === "r") reset();
  });

  board.onTheme(render);
  render();
})();
