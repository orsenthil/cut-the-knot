"use strict";

/*
 * Browser UI for "Tangent Circles and an Isosceles Triangle II".
 * The construction and all the numbers live in ...-core.js; this file only
 * draws them and takes input.
 *
 * Drag A, B or C (or focus a handle and use the arrow keys). The three points
 * stay on one line, as in the applet. The five Step buttons uncover Vladimir's
 * proof one layer at a time: the rhombus, the perpendicular and inversion
 * circle at B, the excenters of BI_kI_l, and finally the inverted circle Q'
 * touching the big circle. The three checkboxes are the applet's own
 * "names", "premise" and "statement" switches.
 */

(() => {
  const C = InversionInCircleAndIsosceles2Core;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const toggles = {
    names: document.getElementById("namesCheck"),
    premise: document.getElementById("premiseCheck"),
    statement: document.getElementById("statementCheck"),
  };
  const stepButtons = [...document.querySelectorAll("[data-step]")];

  const board = Geom.board(document.getElementById("board"));
  const circles = board.layer("circles");
  const guides = board.layer("guides");
  const chords = board.layer("chords");
  const markers = board.layer("markers");
  const angleMarks = board.layer("angle-marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = C.start();
  const pt = (x, y) => ({ x, y });

  /** "win", "lose" and "done" belong to the record; this demo uses none. */
  function say(text, kind) {
    statusEl.textContent = text;
    for (const k of ["win", "lose", "done"]) statusEl.classList.remove(k);
    if (kind) statusEl.classList.add(kind);
  }

  const seed = state.A;
  const big = board.circle(seed, 1, "circle-big", circles);
  const mid = board.circle(seed, 1, "circle-mid", circles);
  const small = board.circle(seed, 1, "circle-q", circles);
  const inversionCircle = board.circle(seed, 1, "circle-inversion", circles);
  const circleb = board.circle(seed, 1, "circle-b", circles);
  const qPrime = board.circle(seed, 1, "circle-qp", circles);

  /* A pool of reusable shapes: .set() on every redraw keeps keyboard focus. */
  const bases = [0, 1, 2].map(() => board.segment(seed, seed, "base-line", chords));
  const guideLines = Array.from({ length: 15 }, () =>
    board.segment(seed, seed, "guide-line", guides));
  const proofLines = Array.from({ length: 6 }, () =>
    board.segment(seed, seed, "proof-line", chords));
  const angleArcs = [0, 1].map(() => board.angleArc(seed, seed, seed, 12, "angle-arc", angleMarks));
  const rightAngles = [0, 1].map(() => board.rightAngle(seed, seed, seed, 9, "right-angle", angleMarks));

  const dotNames = ["O", "P", "Q", "E", "F", "K", "L", "M", "N", "Ik", "Il", "Qp"];
  const dots = Object.fromEntries(dotNames.map((n) =>
    [n, board.point(seed, n === "Q" || n === "Qp" ? "accent-dot" : "plain-dot", 4, markers)]));

  const labelNames = ["A", "B", "C", "O", "P", "Q", "E", "F", "K", "L", "M", "N", "Ik", "Il", "Qp"];
  const labels = Object.fromEntries(labelNames.map((n) =>
    [n, board.label(seed, n === "Qp" ? "Q'" : n, "pt-label", 7, -8, labelsLayer)]));
  const offsets = {
    A: [-16, 18], B: [-8, 20], C: [8, 18], O: [8, 18], P: [-16, -10],
    Q: [8, -8], E: [8, -8], F: [8, 16], K: [-16, 16], L: [-16, -10],
    M: [8, 16], N: [8, 18], Ik: [8, 16], Il: [8, 18], Qp: [8, -8],
  };

  const clamp = (p) => C.clampToBoard(p);
  const describe = (p, name) =>
    `at x ${Math.round(p.x)}, y ${Math.round(p.y)}, with the other two points on the same line`;
  const onMove = (p, name) => {
    state = C.movePoint(state, name, p);
    render();
  };
  const handles = Object.fromEntries(["A", "B", "C"].map((name) => [name,
    board.handle(name, state[name], {
      r: 9, step: 5, layer: handlesLayer, clamp, describe, onMove,
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it along the baseline.`,
    })]));

  function place(name, p) {
    const label = labels[name];
    label.show(Boolean(p));
    if (p) label.set(p, name === "Qp" ? "Q'" : name, offsets[name][0], offsets[name][1]);
  }

  function hideAll() {
    for (const s of bases.concat(guideLines, proofLines)) s.show(false);
    for (const a of angleArcs.concat(rightAngles)) a.show(false);
    for (const n of dotNames) dots[n].show(false);
    for (const n of labelNames) labels[n].show(false);
    inversionCircle.show(false);
    circleb.show(false);
    qPrime.show(false);
  }

  function segment(shapes, index, p, q, show) {
    shapes[index].set(p, q);
    shapes[index].show(show);
  }

  function render() {
    const g = C.geometry(state);
    const o = state.options;
    const step = o.step;

    for (const name of ["A", "B", "C"]) {
      handles[name].set(state[name]);
      place(name, o.names ? state[name] : null);
    }
    hideAll();

    if (!g.valid) {
      big.show(false); mid.show(false); small.show(false);
      say("Move A, B and C to three different places on the line; this drawing needs A < B < C.");
      if (window.Track) window.Track.state(state);
      return;
    }

    big.set(g.O, g.R);
    mid.set(g.P, g.rP);
    small.set(g.Q, g.rQ);
    segment(bases, 0, g.A, g.C, true);
    segment(bases, 1, g.E, g.C, step === 0);
    segment(bases, 2, g.B, g.E, step === 0);

    /* Step 1: EBK, FBL and the rhombus L-E-C-F-K. */
    segment(guideLines, 0, g.E, g.K, step >= 1);
    segment(guideLines, 1, g.F, g.L, step >= 1);
    segment(guideLines, 2, g.L, g.E, step === 1);
    segment(guideLines, 3, g.E, g.C, step === 1);
    segment(guideLines, 4, g.C, g.F, step === 1);
    segment(guideLines, 5, g.F, g.K, step === 1);
    segment(guideLines, 6, g.F, g.E, step === 1);

    /* Step 2: the perpendicular at B, the inversion circle and (P)'s image. */
    segment(guideLines, 7, g.M, g.N, step >= 2);
    inversionCircle.show(step >= 2);
    inversionCircle.set(g.circleMN, g.circleMN.r);
    segment(guideLines, 8, g.lineP.a, g.lineP.b, step >= 2);
    segment(guideLines, 9, g.K, g.C, step >= 2);
    segment(guideLines, 10, g.L, g.C, step >= 2);

    /* Step 3: excenters of BI_kI_l and the circle through K and B. */
    circleb.show(step === 3);
    circleb.set(g.Circleb, g.Circleb.r);
    segment(guideLines, 11, g.K, g.Ik, step === 3);
    segment(guideLines, 12, g.L, g.Il, step === 3);
    segment(guideLines, 13, g.K, g.L, step === 3);
    segment(guideLines, 14, g.Ik, g.Il, step === 3);

    /* Step 4: the inverted circle Q', with BE, BQ and LF drawn. */
    qPrime.show(step === 4);
    qPrime.set(pt(g.Qp.x, g.Qp.y), g.Qp.r);
    segment(proofLines, 0, g.BE.a, g.BE.b, step === 4);
    segment(proofLines, 1, g.BQ.a, g.BQ.b, step === 4);
    segment(proofLines, 2, g.BF.a, g.BF.b, step === 4);

    /* The applet's premise and statement switches. */
    if (o.premise) {
      const r = Math.min(20, C.dist(g.B, g.C) / 2);
      angleArcs[0].set(g.E, g.B, g.C, r);
      angleArcs[1].set(g.C, g.E, g.B, r);
      angleArcs[0].show(true); angleArcs[1].show(true);
    }
    if (o.statement) {
      segment(proofLines, 3, g.Q, g.B, true);
      rightAngles[0].set(g.B, g.A, g.Q, 9);
      rightAngles[1].set(g.B, g.C, g.Q, 9);
      rightAngles[0].show(true); rightAngles[1].show(true);
    }

    /* Dots and names follow the step, as in ShowDots() and ShowNames(). */
    dots.O.show(true); dots.P.show(true); dots.Q.show(true); dots.E.show(true);
    const visible = {
      F: step >= 1, K: step === 1 || step === 2 || step === 3,
      L: step >= 1, M: step === 2, N: step === 2,
      Ik: step >= 3, Il: step >= 3, Qp: step === 4,
    };
    for (const n of dotNames) {
      if (n === "O" || n === "P" || n === "Q" || n === "E") continue;
      dots[n].show(visible[n]);
    }
    for (const n of dotNames) {
      const p = n === "Qp" ? pt(g.Qp.x, g.Qp.y) : g[n];
      if (dots[n] && (dots[n].node.style.display !== "none")) dots[n].set(p);
    }

    if (o.names) {
      for (const n of dotNames) {
        const p = n === "Qp" ? pt(g.Qp.x, g.Qp.y) : g[n];
        if (dots[n] && dots[n].node.style.display !== "none") place(n, p);
      }
      for (const n of ["A", "B", "C"]) place(n, state[n]);
    }

    const gap = Math.max(
      Math.abs(C.dist(g.O, g.Q) - (g.R - g.rQ)),
      Math.abs(C.dist(g.P, g.Q) - (g.rP + g.rQ)),
      Math.abs(C.dist(g.Q, C.foot(g.Q, g.B, g.E)) - g.rQ),
    );
    const stepWords = [
      "Step 0, the two circles and the isosceles triangle.",
      "Step 1, the rhombus BECF and B as the incenter of CKL.",
      "Step 2, the perpendicular at B and the inversion circle.",
      "Step 3, the excenters I_k and I_l of BI_kI_l.",
      "Step 4, Q' is an excircle and touches the big circle.",
    ];
    say(`${stepWords[step]} Q is ${g.rQ.toFixed(1)} units from its circle's edge, ` +
      `${C.dist(g.B, g.Q).toFixed(1)} units above B; its tangent gaps are ${gap.toExponential(1)}. ` +
      `Q and B share x = ${Math.round(g.B.x)}, so BQ is perpendicular to AC.`);

    // The position, for the player's record and the tutor (board units).
    if (window.Track) window.Track.state(state);
  }

  function syncControls() {
    for (const name in toggles) toggles[name].checked = state.options[name];
    for (const button of stepButtons) {
      const active = Number(button.dataset.step) === state.options.step;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("selected", active);
    }
  }

  function setStep(n) {
    state = C.setOption(state, "step", n);
    syncControls();
    render();
  }

  for (const name in toggles) {
    toggles[name].addEventListener("change", () => {
      state = C.setOption(state, name, toggles[name].checked);
      render();
    });
  }
  for (const button of stepButtons) {
    button.addEventListener("click", () => setStep(Number(button.dataset.step)));
  }
  resetBtn.addEventListener("click", () => {
    state = C.start();
    syncControls();
    render();
  });

  syncControls();
  board.onTheme(render);
  render();
})();
