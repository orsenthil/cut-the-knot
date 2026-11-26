"use strict";

/*
 * The page for Balls In Jar: drawing and input only; the construction is in
 * balls-in-jar-core.js. The SVG holds the rack, the thirteen bottles, their
 * names, a line marking the level pair and (optionally) the two pink helper
 * circles from the proof. A, B and C are focusable handles: B slides along the
 * floor, while dragging either outside bottle changes the common radius, just
 * as in the applet. Every object is made once and only its geometry changes on
 * a redraw, so a handle keeps keyboard focus after an arrow-key move.
 */

(function () {
  const Core = BallsInJarCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const sizeInput = document.getElementById("sizeInput");
  const sizeOut = document.getElementById("sizeOut");
  const resetBtn = document.getElementById("newBtn");
  const hintsBtn = document.getElementById("hintsBtn");
  const namesBtn = document.getElementById("namesBtn");

  const rack = board.layer("rack");
  const bottles = board.layer("bottles");
  const guides = board.layer("guides");
  const textLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const names = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
  const rows = { A: 0, B: 0, C: 0, D: 1, E: 1, F: 2, G: 2, H: 2,
    I: 3, J: 3, K: 4, L: 4, M: 4 };

  let state = Core.start();
  let showHints = false;
  let showNames = true;

  /* The rack's floor and two sides are fixed; only the circles move. */
  const floor = board.segment(Core.P1, Core.P2, "rack-side", rack);
  const leftWall = board.segment(Core.P1, { x: Core.P1.x, y: -40 }, "rack-side", rack);
  const rightWall = board.segment(Core.P2, { x: Core.P2.x, y: -40 }, "rack-side", rack);
  const circles = {};
  const labels = {};
  for (const name of names) {
    circles[name] = board.circle(state.A, 1, "bottle bottle-row-" + rows[name], bottles);
    labels[name] = board.label(state.A, name, "bottle-label", 0, 5, textLayer);
  }
  const levelKL = board.segment(state.A, state.B, "level-line", guides);
  const levelLM = board.segment(state.A, state.B, "level-line", guides);
  const hintIL = board.circle(state.A, 1, "hint-circle", guides);
  const hintJL = board.circle(state.A, 1, "hint-circle", guides);

  /**
   * The shared status line. A picture has no win or loss, so `kind` is never
   * used here: the shared record sees a demo as explored after a little while.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const figure = Core.stack(state);
    if (figure) {
      for (const name of names) {
        circles[name].set(figure.circles[name], state.r);
        labels[name].set(figure.circles[name], name, 0, 5);
        labels[name].show(showNames);
      }

      levelKL.show(figure.showAll || figure.showIL);
      levelLM.show(figure.showAll || figure.showJL);
      levelKL.set(figure.circles.K, figure.circles.L);
      levelLM.set(figure.circles.L, figure.circles.M);

      hintIL.show(showHints && Boolean(figure.hints.IL) && figure.showIL);
      hintJL.show(showHints && Boolean(figure.hints.JL) && figure.showJL);
      if (figure.hints.IL) hintIL.set(figure.hints.IL, state.r);
      if (figure.hints.JL) hintJL.set(figure.hints.JL, state.r);

      say(Core.report(figure) + " K–L gap " + figure.dKL.toFixed(2) +
        ", L–M gap " + figure.dML.toFixed(2) + ".");
    } else {
      for (const name of names) circles[name].show(false);
      levelKL.show(false);
      levelLM.show(false);
      hintIL.show(false);
      hintJL.show(false);
      say("This size cannot hold the stack. Reset the bottles or change the size.");
    }

    sizeInput.value = String(Math.round(state.percent));
    sizeOut.textContent = Math.round(state.percent) + "%  (r = " + state.r.toFixed(1) + ")";
    hA.set(state.A);
    hB.set(state.B);
    hC.set(state.C);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  /* The applet's ChangeRadius accepts 6r < rack width < 8r. */
  function changeRadiusFrom(q, name) {
    const d = name === "A" ? q.x - Core.P1.x : Core.P2.x - q.x;
    const width = Core.P2.x - Core.P1.x;
    if (6 * d < width && 8 * d > width) {
      state = Core.withPercent(state, Core.percentOfRadius(d));
    }
  }

  const hA = board.handle("A", state.A, {
    r: 9, step: 1, shift: 5, layer: handlesLayer,
    label: "Bottle A at the left wall. Drag sideways to change the bottle size, or focus it and use the left and right arrow keys.",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
    clamp: (q, name) => { changeRadiusFrom(q, name); return state.A; },
    onMove: () => render(),
  });
  const hC = board.handle("C", state.C, {
    r: 9, step: 1, shift: 5, layer: handlesLayer,
    label: "Bottle C at the right wall. Drag sideways to change the bottle size, or focus it and use the left and right arrow keys.",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
    clamp: (q, name) => { changeRadiusFrom(q, name); return state.C; },
    onMove: () => render(),
  });
  const hB = board.handle("B", state.B, {
    r: 9, step: 2, shift: 10, layer: handlesLayer,
    label: "Middle bottle B. Drag sideways to change the spacing, or focus it and use the left and right arrow keys.",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
    clamp: (q) => ({ x: Geom.clamp(q.x, state.A.x + 2 * state.r, state.C.x - 2 * state.r), y: state.B.y }),
    onMove: (p) => { state = Core.withB(state, p.x); render(); },
  });

  sizeInput.addEventListener("input", () => {
    state = Core.withPercent(state, Number(sizeInput.value));
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start();
    render();
    hB.node.focus();
  });
  hintsBtn.addEventListener("click", () => {
    showHints = !showHints;
    hintsBtn.setAttribute("aria-pressed", String(showHints));
    hintsBtn.textContent = showHints ? "Hide proof hint" : "Show proof hint";
    render();
  });
  namesBtn.addEventListener("click", () => {
    showNames = !showNames;
    namesBtn.setAttribute("aria-pressed", String(showNames));
    namesBtn.textContent = showNames ? "Hide names" : "Show names";
    render();
  });

  board.onTheme(render);
  render();
})();
