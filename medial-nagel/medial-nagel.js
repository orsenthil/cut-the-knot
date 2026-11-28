"use strict";

/*
 * The page for Medial Nagel: drawing and input only. All the geometry lives in
 * medial-nagel-core.js. The SVG shows ABC with three draggable corners, its
 * medial triangle DEF, the incircles of AEF/BDF/CDE touching EF/DF/DE at
 * P/Q/R, the cevians DP/EQ/FR and their common point M. The four switches are
 * the applet's "Show names", "Show incircle", "Hint" and "Extra construction".
 * Hint draws the equal-tangent tick marks; Extra draws the three excircles of
 * DEF and the extended sides of the medial triangle.
 */

(function () {
  const Core = MedialNagelCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const incircleBtn = document.getElementById("incircleBtn");
  const hintBtn = document.getElementById("hintBtn");
  const extraBtn = document.getElementById("extraBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 12, view.x + view.width - 12),
    y: Geom.clamp(p.y, view.y + 12, view.y + view.height - 12),
  });

  let state = Core.start({});
  let checked = false;

  /**
   * Shows the status line. `kind` is "done" once the claim has been checked;
   * the original has no win or loss. The shared record reads those classes, so
   * they are used only for a finished exploration.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* --------------------------------- build the drawing once -------------------- */

  const extras = board.layer("extras");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  const extraLines = [0, 1, 2].map(() => board.line(state.A, state.B, "ex-line", extras));
  const excircles = [0, 1, 2].map(() => board.circle(state.A, 1, "excircle", extras));
  const outer = board.polygon([state.A, state.B, state.C], "tri", shapes);
  const medialTri = board.polygon([state.A, state.B, state.C], "medial", shapes);
  const cornerCircles = [0, 1, 2].map(() => board.circle(state.A, 1, "corner-circle", shapes));
  const medialCircle = board.circle(state.A, 1, "medial-circle", shapes);
  const gergonneLines = [0, 1, 2].map(() => board.segment(state.A, state.B, "gergonne-line", shapes));
  const cevians = [0, 1, 2].map(() => board.segment(state.A, state.B, "cevian", shapes));

  const midDots = [0, 1, 2].map(() => board.point(state.A, "mid-dot", 4, marks));
  const contactDots = [0, 1, 2].map(() => board.point(state.A, "contact-dot", 4.5, marks));
  const incircleDots = [0, 1, 2].map(() => board.point(state.A, "incircle-dot", 3.6, marks));
  const nagelDot = board.point(state.A, "nagel-dot", 6, marks);
  const gergonneDot = board.point(state.A, "gergonne-dot", 5, marks);

  /* Six equal-length pairs, marked with one, two or three little strokes. */
  const ticks = [];
  const tickPairs = [
    [[0, 0], [0, 1]], // ER and FQ: one stroke
    [[1, 0], [1, 1]], // FP and DR: two strokes
    [[2, 0], [2, 1]], // EP and DQ: three strokes
  ];
  for (let count = 1; count <= 3; count++) {
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < count; i++) ticks.push(board.segment(state.A, state.B, "hint-tick", marks));
    }
  }

  const label = (text, dx, dy, cls) => board.label(state.A, text, cls || "glabel", dx, dy, marks);
  const labels = {
    A: label("A", -18, 23), B: label("B", 9, 23), C: label("C", -5, -13),
    D: label("D", 8, -7, "glabel small mid-label"),
    E: label("E", -18, -7, "glabel small mid-label"),
    F: label("F", 8, 18, "glabel small mid-label"),
    P: label("P", 8, 18, "glabel small contact-label"),
    Q: label("Q", 8, -8, "glabel small contact-label"),
    R: label("R", -18, -8, "glabel small contact-label"),
    M: label("M", 9, -8, "glabel nagel-label"),
    Pp: label("P′", 7, -9, "glabel small incircle-label"),
    Qp: label("Q′", 7, 18, "glabel small incircle-label"),
    Rp: label("R′", -22, 2, "glabel small incircle-label"),
    G: label("G", 9, -8, "glabel gergonne-label"),
  };
  const alwaysNames = ["A", "B", "C", "D", "E", "F", "P", "Q", "R", "M"];
  const incircleNames = ["Pp", "Qp", "Rp", "G"];

  const diagramObjects = [
    outer, medialTri, medialCircle, ...cornerCircles, ...gergonneLines, ...cevians,
    ...midDots, ...contactDots, ...incircleDots, nagelDot, gergonneDot,
  ];

  /** Place the strokes that mark equal tangent lengths on a pair of segments. */
  function setTicks(p, q, count, from) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length, uy = dy / length;
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * 7;
      const cx = mx + ux * offset, cy = my + uy * offset;
      ticks[from + i].set(
        { x: cx - uy * 6, y: cy + ux * 6 },
        { x: cx + uy * 6, y: cy - ux * 6 },
      );
    }
  }

  /* ---------------------------------------- render -------------------------------- */

  function render() {
    const m = Core.compute(state);
    const q = Core.claims(state);

    // Dragging moves a handle itself; Reset changes the state, so also bring
    // the handle nodes back into step with the saved position.
    ["A", "B", "C"].forEach((name, i) => handles[i].set(state[name]));

    // A flat triangle has no usable incircles. Hide the diagram before setting
    // any SVG attribute from a NaN, then explain what to do.
    if (!m.valid) {
      for (const obj of [...diagramObjects, ...extraLines, ...excircles, ...ticks]) obj.show(false);
      for (const key of Object.keys(labels)) labels[key].show(state.showNames && ["A", "B", "C"].includes(key));
      say("Pull the corners into a proper triangle: the circles need room.", null);
      checked = false;
      syncButtons();
      if (window.Track) window.Track.state(state);
      return;
    }

    outer.set([m.A, m.B, m.C]);
    medialTri.set([m.D, m.E, m.F]);
    [m.circleA, m.circleB, m.circleC].forEach((c, i) => cornerCircles[i].set(c.center, c.radius));
    medialCircle.set(m.circleI.center, m.circleI.radius);

    const vertices = [[m.D, m.E, m.F], [m.D, m.F, m.E], [m.E, m.F, m.D]];
    for (let i = 0; i < 3; i++) {
      cevians[i].set([[m.D, m.P], [m.E, m.Q], [m.F, m.R]][i][0], [[m.D, m.P], [m.E, m.Q], [m.F, m.R]][i][1]);
      gergonneLines[i].set([[m.D, m.Pp], [m.E, m.Qp], [m.F, m.Rp]][i][0],
        [[m.D, m.Pp], [m.E, m.Qp], [m.F, m.Rp]][i][1]);
      midDots[i].set([m.D, m.E, m.F][i]);
      contactDots[i].set([m.P, m.Q, m.R][i]);
      incircleDots[i].set([m.Pp, m.Qp, m.Rp][i]);
      extraLines[i].set(vertices[i][0], vertices[i][1]);
      excircles[i].set(m.excircles[i].center, m.excircles[i].radius);
    }
    nagelDot.set(m.M);
    gergonneDot.set(m.G);

    // The applet's Hint uses one stroke on ER/FQ, two on FP/DR, three on EP/DQ.
    let at = 0;
    for (let count = 1; count <= 3; count++) {
      for (const seg of tickPairs[count - 1]) {
        const endpoints = [
          [[m.E, m.R], [m.F, m.Q]],
          [[m.F, m.P], [m.D, m.R]],
          [[m.E, m.P], [m.D, m.Q]],
        ][seg[0]][seg[1]];
        setTicks(endpoints[0], endpoints[1], count, at);
        at += count;
      }
    }

    const points = { ...m, Pp: m.Pp, Qp: m.Qp, Rp: m.Rp };
    for (const key of Object.keys(labels)) labels[key].set(points[key]);

    for (const obj of diagramObjects) obj.show(true);
    for (const obj of extraLines) obj.show(state.showExtra);
    for (const obj of excircles) obj.show(state.showExtra);
    for (const obj of ticks) obj.show(state.showHint);
    for (const obj of gergonneLines) obj.show(state.showIncircle);
    for (const obj of incircleDots) obj.show(state.showIncircle);
    medialCircle.show(state.showIncircle);
    gergonneDot.show(state.showIncircle);
    for (const key of Object.keys(labels)) {
      labels[key].show(state.showNames
        && (incircleNames.includes(key) ? state.showIncircle : true));
    }

    syncButtons();
    if (checked && q && q.all) {
      say("DP, EQ and FR meet at M, the Nagel point of DEF — and M is also the incenter of ABC.", "done");
    } else {
      say("Drag A, B or C. The red lines keep meeting at M, which is also the incenter of ABC.", null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function syncButtons() {
    const pairs = [
      [namesBtn, "showNames", "names", "Hide names", "Show names"],
      [incircleBtn, "showIncircle", "incircle", "Hide incircle", "Show incircle"],
      [hintBtn, "showHint", "hint", "Hide hint", "Show hint"],
      [extraBtn, "showExtra", "extra", "Hide excircles", "Show excircles"],
    ];
    for (const [btn, key, action, onText, offText] of pairs) {
      const on = Boolean(state[key]);
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? onText : offText;
      btn.setAttribute("aria-label", `${on ? "Hide" : "Show"} ${action === "extra" ? "the excircles of the medial triangle"
        : action === "incircle" ? "the medial incircle and its contact points"
          : action === "hint" ? "the equal-length tick marks" : "the point names"}`);
    }
  }

  /* --------------------------------- input ------------------------------------- */

  const handles = ["A", "B", "C"].map((name) => board.handle(name, state[name], {
    r: 11, step: 4, shift: 16, layer: handlesLayer, clamp: inside,
    label: `Corner ${name}. Drag, or focus and use the arrow keys to move it.`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => {
      state = Core.withPoint(state, name, p);
      checked = false;
      render();
    },
  }));

  function reset() {
    state = Core.reset(state);
    checked = false;
    render();
    handles[0].node.focus();
  }

  function toggle(action) {
    state = Core.withOption(state, action, !state[
      { names: "showNames", incircle: "showIncircle", hint: "showHint", extra: "showExtra" }[action]]);
    checked = false;
    render();
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", () => toggle("names"));
  incircleBtn.addEventListener("click", () => toggle("incircle"));
  hintBtn.addEventListener("click", () => toggle("hint"));
  extraBtn.addEventListener("click", () => toggle("extra"));
  checkBtn.addEventListener("click", () => {
    checked = true;
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLButtonElement || e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    else if (key === "n") toggle("names");
    else if (key === "i") toggle("incircle");
    else if (key === "h") toggle("hint");
    else if (key === "e") toggle("extra");
    else if (key === "c") { checked = true; render(); }
  });

  board.onTheme(render);
  render();
})();
