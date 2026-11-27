"use strict";

/*
 * The page for Four Feet On Bisectors: drawing and input only. The bisectors,
 * their four perpendicular feet, the incenter and every claim live in
 * four-feet-on-bisectors-core.js. The SVG holds a triangle with three draggable
 * corners; four faint lines are its angle bisectors, and the four dots where
 * A projects onto them sit on one line. The buttons reproduce the applet's
 * "names", "statement", "premise" and "hint" checkboxes.
 */

(function () {
  const Core = FourFeetOnBisectorsCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");
  const namesBtn = document.getElementById("namesBtn");
  const statementBtn = document.getElementById("statementBtn");
  const premiseBtn = document.getElementById("premiseBtn");
  const hintBtn = document.getElementById("hintBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 14, view.x + view.width - 14),
    y: Geom.clamp(p.y, view.y + 14, view.y + view.height - 14),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");

  let state = Core.start({});
  let checked = false;
  let showNames = true;       // the applet's second instance has Show=1
  let showStatement = false;
  let showPremise = false;
  let showHint = false;

  /* Paint order: the triangle, the faint bisectors, premise extras, the hint
     circles, the statement line, the dots, the names, then the handles. Every
     element is made once and moved with .set(), so focus on a handle survives. */
  const triangle = board.layer("triangle");
  const guides = board.layer("guides");
  const premise = board.layer("premise");
  const hints = board.layer("hints");
  const statement = board.layer("statement");
  const dots = board.layer("dots");
  const text = board.layer("text");
  const tops = board.layer("handles");

  const sides = [
    board.segment(state.A, state.B, "side", triangle),
    board.segment(state.B, state.C, "side", triangle),
    board.segment(state.C, state.A, "side", triangle),
  ];
  const bisGuides = [
    board.line(state.A, state.B, "bisector-guide", guides),
    board.line(state.A, state.B, "bisector-guide", guides),
    board.line(state.A, state.B, "bisector-guide", guides),
    board.line(state.A, state.B, "bisector-guide", guides),
  ];
  const bisEmph = [
    board.line(state.A, state.B, "bisector-emph bisector-b", premise),
    board.line(state.A, state.B, "bisector-emph bisector-c", premise),
    board.line(state.A, state.B, "bisector-emph bisector-b", premise),
    board.line(state.A, state.B, "bisector-emph bisector-c", premise),
  ];
  const extensions = [
    board.line(state.B, state.C, "extension", premise),
    board.line(state.B, state.C, "extension", premise),
  ];
  const rightMarks = [
    board.rightAngle(state.A, state.B, state.C, 11, "right-mark", premise),
    board.rightAngle(state.A, state.B, state.C, 11, "right-mark", premise),
    board.rightAngle(state.A, state.B, state.C, 11, "right-mark", premise),
    board.rightAngle(state.A, state.B, state.C, 11, "right-mark", premise),
  ];
  const hintCircles = [
    board.circle(state.A, 1, "hint-circle", hints),
    board.circle(state.A, 1, "hint-circle", hints),
    board.circle(state.A, 1, "hint-circle", hints),
  ];
  const hintLine = board.line(state.A, state.B, "hint-line", hints);
  const statementLine = board.line(state.A, state.B, "statement-line", statement);
  const footDots = {
    M: board.point(state.A, "foot-dot", 5, dots),
    N: board.point(state.A, "foot-dot", 5, dots),
    P: board.point(state.A, "foot-dot", 5, dots),
    Q: board.point(state.A, "foot-dot", 5, dots),
  };
  const centerDot = board.point(state.A, "center-dot", 4, dots);
  const names = {
    A: board.label(state.A, "A", "pt-label", -18, -12, text),
    B: board.label(state.B, "B", "pt-label", -20, 24, text),
    Cc: board.label(state.C, "C", "pt-label", 8, 24, text),
    M: board.label(state.A, "M", "pt-label small", 8, -8, text),
    N: board.label(state.A, "N", "pt-label small", -24, -8, text),
    P: board.label(state.A, "P", "pt-label small", -24, 22, text),
    Q: board.label(state.A, "Q", "pt-label small", 8, 22, text),
    I: board.label(state.A, "I", "pt-label small", 8, 18, text),
  };

  /**
   * Shows the line under the diagram. "done" is a finished check for the
   * player's record (assets/progress.js); a picture has no win or loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const c = Core.construction(state);
    const m = Core.measurements(state);

    sides[0].set(state.A, state.B);
    sides[1].set(state.B, state.C);
    sides[2].set(state.C, state.A);

    const ok = c.ok;
    for (const s of sides) s.show(true);

    const lines = ok
      ? [c.Bi, c.Ci, c.Be, c.Ce]
      : [null, null, null, null];
    for (let i = 0; i < bisGuides.length; i++) {
      bisGuides[i].show(ok && !showPremise);
      bisEmph[i].show(ok && showPremise);
      if (lines[i]) {
        bisGuides[i].set(lines[i].p, lines[i].q);
        bisEmph[i].set(lines[i].p, lines[i].q);
      }
    }

    /* The applet's MirrorPointInPoint: 5Q - 4P, a long way beyond Q. */
    const farFromB = ok
      ? { x: 5 * state.B.x - 4 * state.C.x, y: 5 * state.B.y - 4 * state.C.y }
      : state.B;
    const farFromC = ok
      ? { x: 5 * state.C.x - 4 * state.B.x, y: 5 * state.C.y - 4 * state.B.y }
      : state.C;
    extensions[0].set(state.B, farFromB);
    extensions[1].set(state.C, farFromC);
    extensions[0].show(ok && showPremise);
    extensions[1].show(ok && showPremise);

    const marks = ok
      ? [
          [c.M, state.A, c.Bi.q], [c.P, state.A, c.Be.q],
          [c.N, state.A, c.Ci.q], [c.Q, state.A, c.Ce.q],
        ]
      : [];
    for (let i = 0; i < rightMarks.length; i++) {
      rightMarks[i].show(showPremise && Boolean(marks[i]));
      if (marks[i]) rightMarks[i].set(marks[i][0], marks[i][1], marks[i][2], 11);
    }

    const triples = ok
      ? [[state.A, c.N, c.M], [state.A, c.P, c.M], [state.A, c.N, c.Q]]
      : [];
    for (let i = 0; i < hintCircles.length; i++) {
      const circle = triples[i] ? Core.circleThrough(...triples[i]) : null;
      hintCircles[i].show(showHint && Boolean(circle));
      if (circle) hintCircles[i].set(circle.center, circle.radius);
    }
    hintLine.show(showHint && Boolean(c.I));
    if (c.I) hintLine.set(state.A, c.I);

    statementLine.show(ok && showStatement);
    if (ok) statementLine.set(c.line.p, c.line.q);

    for (const key of ["M", "N", "P", "Q"]) {
      footDots[key].show(ok);
      if (ok) footDots[key].set(c[key], showStatement ? 5 : 3.5);
    }
    centerDot.show(ok && Boolean(c.I));
    if (c.I) centerDot.set(c.I);

    names.A.set(state.A, "A");
    names.B.set(state.B, "B");
    names.Cc.set(state.C, "C");
    names.M.set(c.M || state.A, "M");
    names.N.set(c.N || state.A, "N");
    names.P.set(c.P || state.A, "P");
    names.Q.set(c.Q || state.A, "Q");
    names.I.set(c.I || state.A, "I");
    for (const key in names) {
      names[key].show(showNames && ok && (key !== "I" || Boolean(c.I)));
    }

    handles.A.set(state.A);
    handles.B.set(state.B);
    handles.C.set(state.C);

    if (!ok) {
      checked = false;
      say("Pull the three corners apart to draw the four angle bisectors.");
    } else if (checked) {
      say(`Checked: M, N, P and Q lie on one line (largest gap ${fmt(m.collinearGap)}). ` +
          `Angles AMP, ABP, AMN and AIN are all ${fmt(m.amp)}°.`, "done");
    } else {
      say(`The four feet lie on one line (largest gap ${fmt(m.collinearGap)}). ` +
          `Drag A, B or C, or press Check the claim.`);
    }

    if (window.Track) window.Track.state(state);
  }

  function move(name, p) {
    state = Core.withPoint(state, name, p);
    checked = false;
    render();
  }

  const handles = {
    A: board.handle("A", state.A, {
      r: 11, step: 3, shift: 12, layer: tops, clamp: inside,
      label: "Point A, the corner whose projections are drawn. Drag it, or focus it and use the arrow keys.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("A", p),
    }),
    B: board.handle("B", state.B, {
      r: 11, step: 3, shift: 12, layer: tops, clamp: inside,
      label: "Point B, first base corner. Drag it, or focus it and use the arrow keys.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("B", p),
    }),
    C: board.handle("C", state.C, {
      r: 11, step: 3, shift: 12, layer: tops, clamp: inside,
      label: "Point C, second base corner. Drag it, or focus it and use the arrow keys.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("C", p),
    }),
  };

  function toggle(btn, get, set, onText, offText) {
    set(!get());
    btn.setAttribute("aria-pressed", String(get()));
    btn.textContent = get() ? offText : onText;
    render();
  }

  function reset() {
    state = Core.start({});
    checked = false;
    render();
    handles.A.node.focus();
  }

  function checkClaim() {
    const cl = Core.claims(state);
    checked = cl.valid && cl.collinear && cl.cyclic && cl.rectangle &&
      cl.pageAngles && cl.colEqualAngles && cl.simson;
    render();
    if (!checked) say("Move the corners apart until the diagram is drawn, then check again.");
  }

  newBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", checkClaim);
  namesBtn.addEventListener("click", () => toggle(namesBtn, () => showNames,
    (v) => { showNames = v; }, "Show names", "Hide names"));
  statementBtn.addEventListener("click", () => toggle(statementBtn, () => showStatement,
    (v) => { showStatement = v; }, "Show statement", "Hide statement"));
  premiseBtn.addEventListener("click", () => toggle(premiseBtn, () => showPremise,
    (v) => { showPremise = v; }, "Show premise", "Hide premise"));
  hintBtn.addEventListener("click", () => toggle(hintBtn, () => showHint,
    (v) => { showHint = v; }, "Show hint", "Hide hint"));

  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "c") checkClaim();
    else if (k === "n") namesBtn.click();
    else if (k === "s") statementBtn.click();
    else if (k === "p") premiseBtn.click();
    else if (k === "h") hintBtn.click();
  });

  board.onTheme(render);
  render();
})();
