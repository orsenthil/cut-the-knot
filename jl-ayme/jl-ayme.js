"use strict";

/*
 * The page for JLAyme: drawing and input only. Every rule and every geometric
 * construction lives in jl-ayme-core.js. The board shows triangle ABC, the
 * line AD, the circle touching AD, BC and the circumcircle, its chord EF, and
 * the four steps of the page's proof. A, B, C and D are focusable handles;
 * each can be dragged or nudged with the arrow keys. Shapes are created once
 * and re-set on every redraw, so focus stays on the handle in use.
 */

(function () {
  const Core = JlAymeCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const board = Geom.board(document.getElementById("board"));
  const { clamp } = Geom;

  const namesChk = document.getElementById("namesChk");
  const statementChk = document.getElementById("statementChk");
  const stepChks = [1, 2, 3, 4].map((n) => document.getElementById("step" + n + "Chk"));
  const allBtn = document.getElementById("allBtn");
  const resetBtn = document.getElementById("resetBtn");

  const INITIAL = Core.start({});
  let state = { ...INITIAL };

  const layers = ["guides", "circles", "chords", "dots", "labels", "handles"]
    .map((name) => board.layer(name));
  const [guides, circles, chords, dots, labels, handleLayer] = layers;

  const tri = board.polygon([INITIAL.A, INITIAL.B, INITIAL.C], "tri", guides);
  const cut = board.line(INITIAL.A, INITIAL.D, "cut", guides);
  const circum = board.circle(INITIAL.A, 1, "circum", guides);
  const circleP = board.circle(INITIAL.A, 1, "circle-p", circles);
  const incircle = board.circle(INITIAL.A, 1, "incircle", circles);
  const chordEF = board.line(INITIAL.A, INITIAL.D, "ef", chords);
  const segMN = board.segment(INITIAL.A, INITIAL.D, "mn", chords);
  const segKM = board.segment(INITIAL.A, INITIAL.D, "radii-line", chords);
  const segKN = board.segment(INITIAL.A, INITIAL.D, "radii-line", chords);
  const segAM = board.segment(INITIAL.A, INITIAL.D, "bisector", chords);
  const segBM = board.segment(INITIAL.B, INITIAL.M || INITIAL.D, "bm", chords);
  const akf = board.circle(INITIAL.A, 1, "aux-circle a", circles);
  const eik = board.circle(INITIAL.A, 1, "aux-circle b", circles);
  const bke = board.circle(INITIAL.A, 1, "aux-circle c", circles);
  const circleM = board.circle(INITIAL.A, 1, "aux-circle d", circles);
  const dotP = board.point(INITIAL.A, "center-dot", 4, dots);
  const dotI = board.point(INITIAL.A, "incenter-dot", 5, dots);
  const dotJ = board.point(INITIAL.A, "point-j", 4, dots);
  const dotE = board.point(INITIAL.A, "contact-dot", 4, dots);
  const dotF = board.point(INITIAL.A, "contact-dot", 4, dots);
  const dotK = board.point(INITIAL.A, "tangent-dot", 4.5, dots);
  const dotM = board.point(INITIAL.A, "arc-dot", 4, dots);
  const dotN = board.point(INITIAL.A, "arc-dot", 4, dots);

  const labelsById = {};
  ["A", "B", "C", "D", "P", "I", "J", "E", "F", "K", "M", "N"].forEach((key) => {
    labelsById[key] = board.label(INITIAL.A, key, "point-label", 6, -7, labels);
  });
  const placeLabel = (key, point, text, dx, dy) => {
    const label = labelsById[key];
    if (point) {
      label.show(true);
      label.set(point, text, dx, dy);
    } else label.show(false);
  };

  /** The shared status line. "done" tells the record this illustration is
   * complete; the applet has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const fig = Core.figure(state);
    const names = !!state.showNames;
    const statement = !!state.showStatement;
    const step1 = !!state.step1, step2 = !!state.step2;
    const step3 = !!state.step3, step4 = !!state.step4;
    const good = fig.valid;

    tri.set([state.A, state.B, state.C]);
    cut.set(state.A, state.D);
    circum.show(good).set(fig.circumcircle ? fig.circumcircle.center : state.A,
      good ? fig.circumcircle.radius : 1);
    circleP.show(good).set(good ? fig.circleP.center : state.A,
      good ? fig.circleP.radius : 1);
    incircle.show(good && statement).set(good ? fig.I : state.A,
      good ? fig.incircle.radius : 1);
    chordEF.show(good).set(good ? fig.E : state.A, good ? fig.F : state.D);

    segMN.show(good && step1).set(good ? fig.M : state.A, good ? fig.N : state.D);
    segKM.show(good && step1).set(good ? fig.K : state.A, good ? fig.M : state.D);
    segKN.show(good && step1).set(good ? fig.K : state.A, good ? fig.N : state.D);
    segAM.show(good && (step1 || step2 || step3 || step4)).set(state.A,
      good ? fig.M : state.D);
    segBM.show(good && step4).set(state.B, good ? fig.M : state.D);

    akf.show(good && step2).set(good && fig.AKF ? fig.AKF.center : state.A,
      good && fig.AKF ? fig.AKF.radius : 1);
    eik.show(good && step3).set(good && fig.EIK ? fig.EIK.center : state.A,
      good && fig.EIK ? fig.EIK.radius : 1);
    bke.show(good && step4).set(good && fig.BKE ? fig.BKE.center : state.A,
      good && fig.BKE ? fig.BKE.radius : 1);
    circleM.show(good && step4).set(good && fig.circleM ? fig.circleM.center : state.A,
      good && fig.circleM ? fig.circleM.radius : 1);

    dotP.show(good && names).set(good ? fig.circleP.center : state.A);
    dotI.show(good && statement).set(good ? fig.I : state.A);
    dotJ.show(good && (step2 || step3)).set(good && fig.J ? fig.J : state.A);
    dotE.show(good).set(good ? fig.E : state.A);
    dotF.show(good).set(good ? fig.F : state.A);
    dotK.show(good).set(good ? fig.K : state.A);
    dotM.show(good && step1).set(good ? fig.M : state.A);
    dotN.show(good && step1).set(good ? fig.N : state.A);

    placeLabel("A", names ? state.A : null, "A", 7, -7);
    placeLabel("B", names ? state.B : null, "B", -14, 14);
    placeLabel("C", names ? state.C : null, "C", 7, 14);
    placeLabel("D", names ? state.D : null, "D", 7, 14);
    placeLabel("P", names && good ? fig.circleP.center : null, "P", 7, -7);
    placeLabel("I", statement && good ? fig.I : null, "I", 7, -7);
    placeLabel("J", good && (step2 || step3) ? fig.J : null, "J", 7, 14);
    placeLabel("E", names && good ? fig.E : null, "E", -14, 15);
    placeLabel("F", names && good ? fig.F : null, "F", 7, -7);
    placeLabel("K", names && good ? fig.K : null, "K", 7, 14);
    placeLabel("M", step1 && good ? fig.M : null, "M", 7, -7);
    placeLabel("N", step1 && good ? fig.N : null, "N", 7, 14);

    handles.forEach((h, i) => h.set([state.A, state.B, state.C, state.D][i]));

    if (!good) {
      say(fig.reason);
    } else {
      const parts = [
        "The circle touches AD at F, BC at E and the circumcircle at K; its chord EF goes through the incenter I.",
      ];
      if (step1) parts.push("MN is parallel to EF, M is the midpoint of arc BC, and AM bisects the angle at A.");
      if (step2) parts.push("The crossing J = AM ∩ EF lies on the circle through A, F and K.");
      if (step3) parts.push("The circle through E, J and K touches AM at J.");
      if (step4) parts.push("The circle centred at M goes through B and I, and angles BKE, MAC and MBE match, so J is I.");
      say(parts.join(" "), "done");
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  function update(point, q) {
    const next = Core.move(state, { point, x: q.x, y: q.y });
    if (next) {
      state = next;
      render();
    }
  }

  const clampFree = (q) => ({ x: clamp(q.x, 14, 386), y: clamp(q.y, 14, 326) });
  const clampBase = (q) => ({ x: clamp(q.x, 14, 386), y: clamp(q.y, 14, 326) });
  const handles = [];
  ["A", "B", "C", "D"].forEach((name, i) => {
    handles.push(board.handle(name, [state.A, state.B, state.C, state.D][i], {
      r: 9, step: 3, shift: 12, layer: handleLayer,
      label: "Point " + name + ". Drag it, or focus it and use the arrow keys to move it.",
      clamp: name === "A" ? clampFree : clampBase,
      onMove: (p) => update(name, p),
    }));
  });

  function readOptions() {
    return {
      ...state,
      showNames: namesChk.checked,
      showStatement: statementChk.checked,
      step1: stepChks[0].checked,
      step2: stepChks[1].checked,
      step3: stepChks[2].checked,
      step4: stepChks[3].checked,
    };
  }

  function writeOptions(next) {
    namesChk.checked = !!next.showNames;
    statementChk.checked = !!next.showStatement;
    stepChks.forEach((chk, i) => { chk.checked = !!next["step" + (i + 1)]; });
  }

  allBtn.addEventListener("click", () => {
    state = readOptions();
    stepChks.forEach((chk) => { chk.checked = true; });
    state = { ...state, step1: true, step2: true, step3: true, step4: true };
    render();
  });
  resetBtn.addEventListener("click", () => {
    const options = readOptions();
    state = { ...INITIAL, showNames: options.showNames, showStatement: options.showStatement,
      step1: options.step1, step2: options.step2, step3: options.step3, step4: options.step4 };
    render();
  });
  [namesChk, statementChk, ...stepChks].forEach((chk) => {
    chk.addEventListener("change", () => {
      state = readOptions();
      render();
    });
  });

  board.onTheme(() => render());
  writeOptions(state);
  render();
})();
