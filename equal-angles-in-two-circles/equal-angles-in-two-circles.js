"use strict";

/*
 * The Equal Angles In Two Circles page: drawing and input only. All the
 * geometry — the two circumcircles, the tangent chord, the crossings A and B
 * and the four angles — lives in equal-angles-in-two-circles-core.js.
 *
 * Four handles (S, T, RB, RS) can be dragged or moved with the arrow keys.
 * RB and RS each define a circle through S and T; the larger circle is the
 * outer one and the other handle becomes P. The applet's four checkboxes are
 * buttons here: names on the point labels, statement on the two equal marked
 * angles, hint on the proof's lettered angles, extra on the dashed chords and
 * the second pair of angles. This is an illustration, so there is no win or
 * loss; the status line always reports the two angle pairs.
 */

(function () {
  const Core = EqualAnglesInTwoCirclesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBtn = document.getElementById("namesBtn");
  const statementBtn = document.getElementById("statementBtn");
  const hintBtn = document.getElementById("hintBtn");
  const extraBtn = document.getElementById("extraBtn");
  const newBtn = document.getElementById("newBtn");
  const degree = (r) => Number.isFinite(r) ? `${(r * 180 / Math.PI).toFixed(1)}°` : "—";

  let state = Core.start();
  let shown = Core.compute(state); // keep the last picture when a drag is degenerate
  let shownValid = Core.drawn(shown);

  const circleLayer = board.layer("circles");
  const chordLayer = board.layer("chords");
  const spokeLayer = board.layer("spokes");
  const extraLayer = board.layer("extra");
  const arcLayer = board.layer("arcs");
  const dotsLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const bigCircle = board.circle(state.S, 1, "circle-main", circleLayer);
  const smallCircle = board.circle(state.S, 1, "circle-small", circleLayer);
  const stLine = board.line(state.S, state.T, "st-line", chordLayer);
  const chord = board.line(state.S, state.T, "chord-line", chordLayer);
  const spokes = [0, 1, 2, 3].map(() =>
    board.segment(state.S, state.T, "spoke", spokeLayer));
  const crossLines = [0, 1].map(() =>
    board.segment(state.S, state.T, "extra-line", extraLayer));
  const mainArcs = [0, 1, 2, 3].map(() =>
    board.angleArc(state.S, state.S, state.T, 18, "angle-main", arcLayer));
  const extraArcs = [0, 1].map(() =>
    board.angleArc(state.S, state.S, state.T, 26, "angle-extra", arcLayer));
  const dots = [0, 1, 2].map(() => board.point(state.S, "cross-dot", 4, dotsLayer));

  const names = ["A", "B", "T", "S", "P"].map((text) =>
    board.label(state.S, text, "glabel", 7, -9, labelLayer));
  const nameOffsets = [[-16, -10], [8, -10], [8, -8], [-16, -8], [8, 18]];
  // The applet's Hint checkbox writes these letters next to its proof angles.
  const hintLetters = [
    ["x", 0], ["x", 1], ["u", 0], ["u", 1],
    ["v", 0], ["v", 1], ["z", 0], ["y", 0],
  ].map(([text, i]) => board.label(state.S, text, "glabel hint-label", 12, 12, labelLayer));

  /** Status line for an illustration: no win, no loss and no computer move. */
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

  function setSegment(segment, p, q, enabled) {
    const usable = enabled && Core.finitePt(p) && Core.finitePt(q);
    segment.show(usable);
    if (usable) segment.set(p, q);
  }

  function render() {
    const d = Core.compute(state);
    if (!d.stale) {
      shown = d;
      shownValid = Core.drawn(d);
    }

    const good = shownValid;
    bigCircle.show(good);
    smallCircle.show(good);
    stLine.show(good && Boolean(shown.st));
    chord.show(good && Boolean(shown.chord));
    if (good) {
      bigCircle.set(shown.bigCircle, shown.bigCircle.r);
      smallCircle.set(shown.smallCircle, shown.smallCircle.r);
      if (shown.st) stLine.set(shown.st.p1, shown.st.p2);
      if (shown.chord) chord.set(shown.chord.p1, shown.chord.p2);
      const solid = [
        [shown.S, shown.A], [shown.S, shown.P],
        [shown.T, shown.B], [shown.T, shown.P],
      ];
      spokes.forEach((line, i) => setSegment(line, solid[i][0], solid[i][1], true));
      setSegment(crossLines[0], shown.S, shown.B, state.extra);
      setSegment(crossLines[1], shown.T, shown.A, state.extra);
      [[shown.A], [shown.B], [shown.P]].forEach((pair, i) => {
        dots[i].show(Core.finitePt(pair[0]));
        if (Core.finitePt(pair[0])) dots[i].set(pair[0]);
      });
      setArc(mainArcs[0], shown.S, shown.A, shown.P, 18, state.statement);
      setArc(mainArcs[1], shown.S, shown.A, shown.P, 23, state.statement);
      setArc(mainArcs[2], shown.T, shown.B, shown.P, 18, state.statement);
      setArc(mainArcs[3], shown.T, shown.B, shown.P, 23, state.statement);
      setArc(extraArcs[0], shown.S, shown.B, shown.P, 26, state.extra);
      setArc(extraArcs[1], shown.T, shown.A, shown.P, 26, state.extra);
    } else {
      spokes.forEach((line) => line.show(false));
      crossLines.forEach((line) => line.show(false));
      mainArcs.concat(extraArcs).forEach((arc) => arc.show(false));
      dots.forEach((dot) => dot.show(false));
    }

    const display = [shown.A, shown.B, shown.T, shown.S, shown.P];
    names.forEach((label, i) => {
      const at = display[i] || state.S;
      const [dx, dy] = nameOffsets[i];
      label.set(at, undefined, dx, dy);
      label.show(good && state.names);
    });
    const hintTargets = [
      [shown.S, shown.A, shown.P], [shown.T, shown.B, shown.P],
      [shown.P, shown.T, shown.B], [shown.S, shown.T, shown.P],
      [shown.T, shown.S, shown.P], [shown.P, shown.S, shown.A],
      [shown.B, shown.A, shown.T], [shown.A, shown.B, shown.S],
    ];
    hintLetters.forEach((label, i) => {
      const [vertex, p, q] = hintTargets[i];
      const usable = good && state.hint && [vertex, p, q].every(Core.finitePt);
      label.show(usable);
      if (usable) {
        const tip = { x: (vertex.x + p.x + q.x) / 3, y: (vertex.y + p.y + q.y) / 3 };
        label.set(tip, undefined, 10, 10);
      }
    });

    namesBtn.setAttribute("aria-pressed", String(state.names));
    statementBtn.setAttribute("aria-pressed", String(state.statement));
    hintBtn.setAttribute("aria-pressed", String(state.hint));
    extraBtn.setAttribute("aria-pressed", String(state.extra));
    hS.set(state.S); hT.set(state.T); hRB.set(state.RB); hRS.set(state.RS);

    if (!good) {
      say("The circle cannot be drawn there: move RB or RS off the straight line through S and T.", null);
    } else {
      const message =
        `∠ASP = ∠BTP = ${degree(shown.angleASP)}. ` +
        `∠ATP = ∠BSP = ${degree(shown.angleATP)}.` +
        (Core.pictured(shown)
          ? " P is inside the other circle, so the two pairs match."
          : " P is outside the other circle, so the pairs need not match.");
      say(message, null);
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({ S: state.S, T: state.T, RB: state.RB, RS: state.RS,
        names: state.names, statement: state.statement, hint: state.hint, extra: state.extra });
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
    state = Core.start({ names: state.names, statement: state.statement,
      hint: state.hint, extra: state.extra });
    shown = Core.compute(state);
    shownValid = Core.drawn(shown);
    render();
    hS.node.focus();
  }

  namesBtn.addEventListener("click", () => toggle("names"));
  statementBtn.addEventListener("click", () => toggle("statement"));
  hintBtn.addEventListener("click", () => toggle("hint"));
  extraBtn.addEventListener("click", () => toggle("extra"));
  newBtn.addEventListener("click", reset);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
    const key = e.key.toLowerCase();
    if (key === "n") toggle("names");
    else if (key === "s") toggle("statement");
    else if (key === "h") toggle("hint");
    else if (key === "e") toggle("extra");
    else if (key === "r") reset();
  });

  board.onTheme(render);
  render();
})();
