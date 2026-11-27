"use strict";

/*
 * The page for Funny Square: drawing and input only. The geometry is in
 * funny-square-core.js. Three focusable dots A, P and R sit on one horizontal
 * base line; the square, its construction lines and the hint triangle are
 * redrawn in place so a handle keeps its keyboard focus.
 */

(function () {
  const Core = FunnySquareCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const namesChk = document.getElementById("namesChk");
  const constructionChk = document.getElementById("constructionChk");
  const hintChk = document.getElementById("hintChk");
  const newBtn = document.getElementById("newBtn");
  const board = Geom.board(document.getElementById("board"));

  const guides = board.layer("guides");
  const construction = board.layer("construction");
  const squareLayer = board.layer("square");
  const hintLayer = board.layer("hint");
  const dotsLayer = board.layer("dots");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start({ showNames: namesChk.checked });
  let explored = false;

  /**
   * The shared status line. "done" tells the player's record that this
   * illustration has been explored; there is no win or loss here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const base = board.segment(state.a, state.r, "base-line", guides);
  const squareShape = board.polygon([state.a, state.p, state.r], "square", squareLayer);
  const perpP = board.segment(state.p, state.p, "perp", construction);
  const perpQ = board.segment(state.p, state.p, "perp", construction);
  const perpR = board.segment(state.r, state.r, "perp", construction);
  const guideP = board.line(state.p, state.p, "guide", construction);
  const guideQ = board.line(state.p, state.p, "guide", construction);
  const guideR = board.line(state.r, state.r, "guide", construction);
  const hintTR = board.segment(state.r, state.r, "hint-line", hintLayer);
  const hintTB = board.segment(state.r, state.r, "hint-line", hintLayer);
  const hintAngle = board.rightAngle(state.r, state.r, state.r, 16, "hint-angle", hintLayer);
  const dots = {
    P: board.point(state.p, "derived-dot", 5, dotsLayer),
    Q: board.point(state.p, "derived-dot", 5, dotsLayer),
    D: board.point(state.p, "derived-dot", 6, dotsLayer),
    B: board.point(state.p, "derived-dot", 6, dotsLayer),
    C: board.point(state.p, "derived-dot", 6, dotsLayer),
    T: board.point(state.p, "hint-dot", 6, dotsLayer),
  };
  const labelOffsets = {
    A: [-18, 28], P: [-6, 28], R: [9, 28], Q: [9, 28],
    D: [-18, -9], B: [12, 8], C: [12, -9], T: [12, 8],
  };
  const labels = {};
  for (const name of ["A", "P", "R", "Q", "D", "B", "C", "T"]) {
    labels[name] = board.label(state.p, name, "point-label", 0, 0, labelsLayer);
  }

  const clampPoint = (q) => ({
    x: Geom.clamp(q.x, Core.PAD, state.width - Core.PAD),
    y: Geom.clamp(q.y, Core.PAD, state.height - Core.PAD),
  });
  const handleNames = ["a", "p", "r"];
  const handleText = {
    a: "Point A, one end of the base line. Drag it, or focus it and use the arrow keys to move it; all three dots share its height.",
    p: "Point P on the base line. Drag it, or focus it and use the arrow keys to change AP and the height of the perpendicular at P.",
    r: "Point R, the other end of the base line. Drag it, or focus it and use the arrow keys.",
  };
  const handles = handleNames.map((name) => board.handle(name, state[name], {
    r: 15, step: 2, shift: 10, layer: handlesLayer,
    label: handleText[name],
    clamp: clampPoint,
    onMove: (point) => {
      const next = Core.move(state, { handle: name, x: point.x, y: point.y });
      if (!next) return;
      state = next;
      explored = true;
      render();
    },
  }));

  function render() {
    const f = Core.compute(state);
    const m = Core.metrics(f);

    base.set(f.A, f.R);
    squareShape.set([f.A, f.B, f.C, f.D]);

    perpP.set(f.P, f.D);
    perpQ.set(f.Q, f.B);
    perpR.set(f.R, f.C);
    guideP.set({ x: f.P.x, y: 0 }, { x: f.P.x, y: state.height });
    guideQ.set({ x: f.Q.x, y: 0 }, { x: f.Q.x, y: state.height });
    guideR.set({ x: f.R.x, y: 0 }, { x: f.R.x, y: state.height });

    hintTR.set(f.T, f.R);
    hintTB.set(f.T, f.B);
    hintAngle.set(f.T, f.R, f.B, 16);

    for (const name of ["P", "Q"]) dots[name].set(f[name]);
    for (const name of ["D", "B", "C"]) dots[name].set(f[name]);
    dots.T.set(f.T);
    for (const name of ["P", "Q", "D", "B", "C", "T"]) {
      dots[name].show(name === "T" ? state.hint : true);
    }
    for (const name of ["A", "P", "R", "Q", "D", "B", "C", "T"]) {
      const off = labelOffsets[name];
      labels[name].set(f[name], name, off[0], off[1]);
      labels[name].show(state.showNames && (name !== "T" || state.hint));
    }
    board.layer("construction").style.display = state.construction ? "" : "none";
    board.layer("hint").style.display = state.hint ? "" : "none";
    for (let i = 0; i < handles.length; i++) handles[i].set(state[handleNames[i]]);

    const fmt = (v) => v.toFixed(1);
    let text = "AP and QR are both " + fmt(m.AP) +
      ". ABCD has four sides of " + fmt(m.sides[0]) + ", and every corner is a right angle.";
    if (state.hint) {
      text += " Hint: triangle APD matches triangle AQB, and triangle BTC matches them too.";
    }
    if (state.construction) {
      text += " The dashed lines are the perpendiculars at P, Q and R.";
    }
    say(text, explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  namesChk.addEventListener("change", () => {
    state = Core.toggle(state, "showNames");
    namesChk.checked = state.showNames;
    explored = true;
    render();
  });
  constructionChk.addEventListener("change", () => {
    state = Core.toggle(state, "construction");
    constructionChk.checked = state.construction;
    explored = true;
    render();
  });
  hintChk.addEventListener("change", () => {
    state = Core.toggle(state, "hint");
    hintChk.checked = state.hint;
    explored = true;
    render();
  });
  newBtn.addEventListener("click", () => {
    state = Core.reset(state);
    namesChk.checked = state.showNames;
    constructionChk.checked = state.construction;
    hintChk.checked = state.hint;
    explored = true;
    render();
  });

  board.onTheme(() => render());
  render();
})();
