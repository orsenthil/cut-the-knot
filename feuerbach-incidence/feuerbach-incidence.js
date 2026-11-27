"use strict";

/*
 * The page for Feuerbach Incidence: drawing and input only. The construction
 * lives in feuerbach-incidence-core.js. A, B and C are focusable handles; the
 * four checkboxes repeat the applet's Show names / circles / concurrence /
 * collinearity switches, with the same rule that the last two only draw while
 * circles are shown. Every shape is created once and updated in place so the
 * keyboard focus on a handle survives a redraw.
 */

(function () {
  const Core = FeuerbachIncidenceCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const namesChk = document.getElementById("namesChk");
  const circlesChk = document.getElementById("circlesChk");
  const linesChk = document.getElementById("linesChk");
  const lineChk = document.getElementById("lineChk");
  const resetBtn = document.getElementById("resetBtn");
  const board = Geom.board(document.getElementById("board"));

  const sideLayer = board.layer("sides");
  const circleLayer = board.layer("circles");
  const incidenceLayer = board.layer("incidence");
  const pointLayer = board.layer("points");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  let state = Core.start({ width: Core.WIDTH, height: Core.HEIGHT });

  const sides = [
    board.segment(state.A, state.B, "side", sideLayer),
    board.segment(state.B, state.C, "side", sideLayer),
    board.segment(state.C, state.A, "side", sideLayer),
  ];
  const incircle = board.circle(state.A, 1, "incircle", circleLayer);
  const nineCircle = board.circle(state.A, 1, "nine-circle", circleLayer);
  const excircles = [
    board.circle(state.A, 1, "excircle", circleLayer),
    board.circle(state.A, 1, "excircle", circleLayer),
    board.circle(state.A, 1, "excircle", circleLayer),
  ];
  const cevians = [
    board.line(state.A, state.B, "cevian", incidenceLayer),
    board.line(state.A, state.B, "cevian", incidenceLayer),
    board.line(state.A, state.B, "cevian", incidenceLayer),
  ];
  const feuerbachLine = board.line(state.A, state.B, "feuerbach-line", incidenceLayer);
  const contactDots = [
    board.point(state.A, "contact-dot", 4, pointLayer),
    board.point(state.A, "contact-dot", 4, pointLayer),
    board.point(state.A, "contact-dot", 4, pointLayer),
  ];
  const incircleDot = board.point(state.A, "fi-dot", 4.5, pointLayer);
  const nineDot = board.point(state.A, "n-dot", 4.5, pointLayer);
  const concurrenceDot = board.point(state.A, "f-dot", 5, pointLayer);

  const vertexLabels = ["A", "B", "C"].map((name) =>
    board.label(state.A, name, "point-label", -8, -9, labelLayer));
  const circleLabels = ["I", "N", "Fa", "Fb", "Fc", "Fi"].map((name) =>
    board.label(state.A, name, "point-label", -8, -8, labelLayer));
  const fLabel = board.label(state.A, "F", "point-label", -8, -8, labelLayer);

  const handles = ["A", "B", "C"].map((name) => board.handle(name, state[name], {
    r: 11, step: 3, shift: 15, cls: "geom-handle vertex-handle", layer: handleLayer,
    label: "Point " + name + ". Drag it, or focus it and use the arrow keys to move the triangle.",
    clamp: (q) => Core.movePoint(state, name, q)[name],
    onMove: (p, which) => {
      state = Core.movePoint(state, which, p);
      render();
    },
  }));

  /** The shared status line. This is a picture, so no win or loss is declared. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function show(shape, on) {
    shape.show(on);
  }

  function render() {
    const f = Core.flags(state);
    const g = Core.compute(state.A, state.B, state.C);
    const vertices = [state.A, state.B, state.C];

    sides[0].set(state.A, state.B);
    sides[1].set(state.B, state.C);
    sides[2].set(state.C, state.A);

    const drawCircles = f.showCircles && g.valid;
    incircle.set(g.incircle.center, g.incircle.radius);
    nineCircle.set(g.nine.center, g.nine.radius);
    excircles[0].set(g.ca.center, g.ca.radius);
    excircles[1].set(g.cb.center, g.cb.radius);
    excircles[2].set(g.cc.center, g.cc.radius);
    [incircle, nineCircle, ...excircles].forEach((s) => show(s, drawCircles));

    const contacts = [g.Pa, g.Pb, g.Pc];
    cevians[0].set(state.A, g.Pa);
    cevians[1].set(state.B, g.Pb);
    cevians[2].set(state.C, g.Pc);
    feuerbachLine.set(g.N, g.Pi);
    for (let i = 0; i < 3; i++) {
      contactDots[i].set(contacts[i]);
      show(contactDots[i], f.showLines && g.valid);
      show(cevians[i], f.showLines && g.valid);
    }
    incircleDot.set(g.Pi);
    nineDot.set(g.N);
    concurrenceDot.set(g.F);
    show(incircleDot, drawCircles);
    show(nineDot, drawCircles);
    show(concurrenceDot, f.showLines && g.valid);
    show(feuerbachLine, f.showLine && g.valid);
    show(fLabel, f.showNames && f.showLines && g.valid);

    const circlePointValues = [g.I, g.N, g.Pa, g.Pb, g.Pc, g.Pi];
    for (let i = 0; i < 3; i++) vertexLabels[i].set(vertices[i], f.showNames ? ["A", "B", "C"][i] : "");
    for (let i = 0; i < circlePointValues.length; i++) {
      circleLabels[i].set(circlePointValues[i], f.showNames && drawCircles ? ["I", "N", "Fa", "Fb", "Fc", "Fi"][i] : "");
    }
    fLabel.set(g.F, f.showNames && f.showLines && g.valid ? "F" : "");
    for (let i = 0; i < handles.length; i++) handles[i].set(vertices[i]);

    if (!g.valid) {
      say("Move the corners so they form a real triangle: a flat or equilateral one has no single touch point.");
    } else if (!f.showCircles) {
      say("Drag A, B or C. Tick circles to see the incircle, the nine-point circle and the three excircles.");
    } else {
      const parts = ["Incircle and nine-point circle touch at Fi."];
      if (f.showLines) {
        const scale = Math.max(Core.dist(state.A, state.B), Core.dist(state.B, state.C), Core.dist(state.C, state.A));
        const miss = Math.max(
          Core.lineError(g.F, state.A, g.Pa),
          Core.lineError(g.F, state.B, g.Pb),
          Core.lineError(g.F, state.C, g.Pc));
        parts.push("AFa, BFb and CFc meet at F; they miss by " + (miss / scale * 100).toFixed(3) + "% of the longest side.");
      }
      if (f.showLine) {
        parts.push("N, F, I and Fi lie on one line.");
      }
      say(parts.join(" "));
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  function setFlag(id, key) {
    state = Object.assign({}, state, { [key]: document.getElementById(id).checked });
    syncSwitches();
    render();
  }

  /** The applet disables concurrence and collinearity until circles are on. */
  function syncSwitches() {
    const enabled = circlesChk.checked;
    linesChk.disabled = !enabled;
    lineChk.disabled = !enabled;
  }

  namesChk.addEventListener("change", () => setFlag("namesChk", "showNames"));
  circlesChk.addEventListener("change", () => setFlag("circlesChk", "showCircles"));
  linesChk.addEventListener("change", () => setFlag("linesChk", "showLines"));
  lineChk.addEventListener("change", () => setFlag("lineChk", "showLine"));
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(() => render());
  syncSwitches();
  render();
})();
