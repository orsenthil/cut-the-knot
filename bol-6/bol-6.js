"use strict";

/*
 * The page for BOL6: drawing and input only; the geometry is in bol-6-core.js.
 * The arbelos is three semicircles on one baseline. A draggable point C divides
 * the baseline; the circle that touches all three semicircles, its horizontal
 * diameter GH and the three segments AN, NP, PB follow C. The checkboxes show
 * the point names and the auxiliary lines of Archimedes' proof.
 */

(function () {
  const Core = Bol6Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");
  const namesBtn = document.getElementById("namesBtn");
  const auxBtn = document.getElementById("auxBtn");

  let state = Core.start();
  let showNames = true;
  let showAux = false;
  let checked = false;

  const shapes = board.layer("shapes");
  const guides = board.layer("guides");
  const dots = board.layer("dots");
  const letters = board.layer("letters");
  const handlesLayer = board.layer("handles");

  /* Objects are made once and only their geometry changes on a redraw, so the
     handle keeps keyboard focus and the theme flip needs no DOM rebuild. */
  const baseline = board.segment(state.A, state.B, "baseline", shapes);
  const semis = [
    board.arc(state.A, 1, Math.PI, 2 * Math.PI, "semi outer", shapes),
    board.arc(state.A, 1, Math.PI, 2 * Math.PI, "semi inner", shapes),
    board.arc(state.A, 1, Math.PI, 2 * Math.PI, "semi inner", shapes),
  ];
  const inscribed = board.circle(state.A, 1, "inscribed", shapes);
  const diameter = board.segment(state.A, state.B, "diameter", guides);
  const measure = board.segment(state.A, state.B, "measure", guides);
  const endDots = [
    board.point(state.A, "marked-dot", 4, dots),
    board.point(state.B, "marked-dot", 4, dots),
    board.point(state.G || state.A, "marked-dot", 4, dots),
    board.point(state.A, "marked-dot", 4, dots),
  ];
  const endNames = ["G", "H", "N", "P"];
  const endLabels = endNames.map((n) => board.label(state.A, n, "glabel", 6, -7, letters));
  const baseLabels = [
    board.label(state.A, "A", "glabel", -18, 22, letters),
    board.label(state.B, "B", "glabel", -4, 22, letters),
    board.label(state.C, "C", "glabel", -5, 22, letters),
  ];

  /* The eleven lines the applet draws when "auxiliary lines" is ticked. */
  const auxSpecs = [
    (g) => [g.A, g.D], (g) => [g.B, g.D], (g) => [g.G, g.H],
    (g) => [g.G, g.N], (g) => [g.H, g.P], (g) => [g.A, g.H],
    (g) => [g.B, g.G], (g) => [g.C, g.H], (g) => [g.C, g.G],
    (g) => [g.C, g.I], (g) => [g.C, g.K],
  ];
  const auxLines = auxSpecs.map(() => board.line(state.A, state.B, "aux-line", guides));
  const auxNames = ["D", "E", "F", "I", "K", "L", "M"];
  const auxDots = auxNames.map(() => board.point(state.A, "aux-dot", 3.5, dots));
  const auxLabels = auxNames.map((n) => board.label(state.A, n, "glabel aux-label", 6, -6, letters));

  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(4) : "—");

  /**
   * Shows a line under the picture. "done" marks an explored illustration for
   * the player's record (assets/progress.js); there is no win or loss here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    baseline.set(g.A, g.B);
    const arcs = [[g.O, g.R], [g.O1, g.R1], [g.O2, g.R2]];
    for (let i = 0; i < 3; i++) {
      const ok = Boolean(arcs[i][0]) && arcs[i][1] > 0;
      semis[i].show(ok);
      if (ok) semis[i].set(arcs[i][0], arcs[i][1], Math.PI, 2 * Math.PI);
    }

    const valid = !g.degenerate;
    inscribed.show(valid);
    diameter.show(valid);
    measure.show(valid);
    if (valid) {
      inscribed.set(g.main, g.rho);
      diameter.set(g.G, g.H);
      measure.set(g.N, g.P);
      const ends = [g.G, g.H, g.N, g.P];
      for (let i = 0; i < 4; i++) {
        endDots[i].show(true);
        endDots[i].set(ends[i]);
        endLabels[i].show(showNames);
        endLabels[i].set(ends[i]);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        endDots[i].show(false);
        endLabels[i].show(false);
      }
    }
    baseLabels[2].set(state.C);
    for (const label of baseLabels) label.show(showNames);

    for (let i = 0; i < auxLines.length; i++) {
      const ends = valid ? auxSpecs[i](g) : [null, null];
      const ok = showAux && Boolean(ends[0]) && Boolean(ends[1]);
      auxLines[i].show(ok);
      if (ok) auxLines[i].set(ends[0], ends[1]);
    }
    const auxPoints = valid ? [g.D, g.E, g.F, g.I, g.K, g.Lp, g.M] : [];
    for (let i = 0; i < auxNames.length; i++) {
      const p = auxPoints[i];
      auxDots[i].show(showAux && Boolean(p));
      auxLabels[i].show(showAux && showNames && Boolean(p));
      if (p) {
        auxDots[i].set(p);
        auxLabels[i].set(p);
      }
    }
    if (hC) hC.set(state.C);

    if (!valid) {
      say("Move C away from the ends of the line.", null);
    } else {
      const fraction = Core.dist(g.G, g.H) / g.L;
      const text = `AC/CB = ${g.ratio.toFixed(3)} — GH/AB = ${fmt(fraction)}.`;
      if (checked) {
        const all = Object.values(Core.claims(state)).every(Boolean);
        const note = Math.abs(g.ratio - 1.5) < 1e-6 ? " At 3:2 this is 6/19." : "";
        say(all
          ? `Checked: ${text}${note}`
          : "Move C away from the ends, then check again.",
        all ? "done" : null);
      } else {
        say(`${text} Drag C, or press Check the claim.`, null);
      }
    }
    // The position, for the player's record and the tutor, in board units.
    if (window.Track) window.Track.state(state);
  }

  function moveC(p) {
    state = Core.withPoint(state, "C", p);
    checked = false;
    render();
  }
  const clampC = (p) => Core.withPoint(state, "C", p).C;

  const hC = board.handle("C", state.C, {
    r: 9, step: 3, shift: 15, layer: handlesLayer, clamp: clampC,
    label: "Point C. Drag along the baseline, or focus and use the left and right arrow keys.",
    describe: (p) => `at x ${Math.round(p.x)}`,
    onMove: (p) => moveC(p),
  });

  function newGame() {
    state = Core.start();
    checked = false;
    render();
    hC.node.focus();
  }

  function checkClaims() {
    checked = true;
    render();
  }

  function toggleNames() {
    showNames = !showNames;
    namesBtn.setAttribute("aria-pressed", String(showNames));
    namesBtn.textContent = showNames ? "Hide point names" : "Show point names";
    render();
  }

  function toggleAux() {
    showAux = !showAux;
    auxBtn.setAttribute("aria-pressed", String(showAux));
    auxBtn.textContent = showAux ? "Hide auxiliary lines" : "Show auxiliary lines";
    render();
  }

  newBtn.addEventListener("click", newGame);
  checkBtn.addEventListener("click", checkClaims);
  namesBtn.addEventListener("click", toggleNames);
  auxBtn.addEventListener("click", toggleAux);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") newGame();
    if (e.key === "c" || e.key === "C") checkClaims();
    if (e.key === "n" || e.key === "N") toggleNames();
    if (e.key === "a" || e.key === "A") toggleAux();
  });

  board.onTheme(render);
  render();
})();
