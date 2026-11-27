"use strict";

/*
 * The page for Feuerbach Treasure: drawing and input only; the geometry is in
 * feuerbach-treasure-core.js. An SVG holds a triangle with three draggable
 * corners, its orthocenter and the shared nine-point circle. Five toggles
 * repeat the applet's checkboxes: ABC, ABH, BCH, CAH and names. Each shown
 * triangle adds its incircle, three excircles and four tangency dots.
 */

(function () {
  const Core = FeuerbachTreasureCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const allBtn = document.getElementById("allBtn");
  const namesBtn = document.getElementById("namesBtn");
  const toggles = {
    ABC: document.getElementById("abcBtn"),
    ABH: document.getElementById("abhBtn"),
    BCH: document.getElementById("bchBtn"),
    CAH: document.getElementById("cahBtn"),
  };

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 10, view.x + view.width - 10),
    y: Geom.clamp(p.y, view.y + 10, view.y + view.height - 10),
  });

  let state = Core.start();

  const guides = board.layer("guides");
  const circlesLayer = board.layer("circles");
  const pointsLayer = board.layer("points");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  /* Built once; only geometry and visibility change on a redraw. */
  const sides = Core.TRIANGLES.map(() => [
    board.segment(state.A, state.B, "tri-side", guides),
    board.segment(state.B, state.C, "tri-side", guides),
    board.segment(state.C, state.A, "tri-side", guides),
  ]);
  const altitudes = [
    board.segment(state.A, state.B, "altitude", guides),
    board.segment(state.B, state.C, "altitude", guides),
    board.segment(state.C, state.A, "altitude", guides),
  ];
  const npcCircle = board.circle(state.A, 1, "npc", circlesLayer);
  const npcCenter = board.point(state.A, "npc-center", 3, pointsLayer);
  const hPoint = board.point(state.A, "h-point", 4, pointsLayer);
  const labelSpecs = [
    ["A", state.A, -18, 21],
    ["B", state.B, -18, -10],
    ["C", state.C, 9, 4],
    ["H", state.A, 9, -10],
  ];
  const labels = labelSpecs.map(([text, p, dx, dy]) =>
    board.label(p, text, "glabel", dx, dy, labelsLayer));

  const perTriangle = {};
  for (const key of Core.TRIANGLES) {
    perTriangle[key] = {
      circles: [
        board.circle(state.A, 1, "feuer-circle incircle", circlesLayer),
        board.circle(state.A, 1, "feuer-circle excircle", circlesLayer),
        board.circle(state.A, 1, "feuer-circle excircle", circlesLayer),
        board.circle(state.A, 1, "feuer-circle excircle", circlesLayer),
      ],
      dots: [
        board.point(state.A, "tan-dot tan-in", 4, pointsLayer),
        board.point(state.A, "tan-dot tan-ex", 4, pointsLayer),
        board.point(state.A, "tan-dot tan-ex", 4, pointsLayer),
        board.point(state.A, "tan-dot tan-ex", 4, pointsLayer),
      ],
    };
  }

  /**
   * Shows the line under the picture. `kind` is "done" when every triangle
   * has been explored, or nothing while the player is still moving corners;
   * the shared record reads that class, so it is never used for a win or loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    const anyH = state.show.ABH || state.show.BCH || state.show.CAH;

    for (let i = 0; i < Core.TRIANGLES.length; i++) {
      const key = Core.TRIANGLES[i];
      const data = m.triangles.find((t) => t.key === key);
      const show = Boolean(data && (state.show[key] || (key === "ABC" && !anyH)));
      const trio = [state.A, state.B, state.C];
      if (key === "ABH") trio[2] = m.H;
      if (key === "BCH") { trio[0] = state.B; trio[1] = state.C; trio[2] = m.H; }
      if (key === "CAH") { trio[0] = state.C; trio[1] = state.A; trio[2] = m.H; }
      for (let j = 0; j < 3; j++) {
        sides[i][j].show(show && Boolean(trio[j]) && Boolean(trio[(j + 1) % 3]));
        if (show && trio[j] && trio[(j + 1) % 3]) sides[i][j].set(trio[j], trio[(j + 1) % 3]);
      }
      const shapes = perTriangle[key];
      const on = Boolean(data && state.show[key]);
      shapes.circles.forEach((circle, k) => {
        const entry = data && data.circles[k];
        circle.show(on && Boolean(entry));
        if (on && entry) circle.set(entry.circle.c, entry.circle.r);
      });
      shapes.dots.forEach((dot, k) => {
        const entry = data && data.circles[k];
        dot.show(on && Boolean(entry && entry.point));
        if (on && entry && entry.point) dot.set(entry.point);
      });
    }

    altitudes.forEach((line, i) => {
      const foot = i === 0 ? Core.foot(state.A, state.B, state.C)
        : i === 1 ? Core.foot(state.B, state.C, state.A)
          : Core.foot(state.C, state.A, state.B);
      line.show(anyH && Boolean(m.H));
      if (anyH && m.H) line.set([state.A, state.B, state.C][i], foot);
    });

    npcCircle.show(Boolean(m.npc));
    npcCenter.show(Boolean(m.npc));
    hPoint.show(anyH && Boolean(m.H));
    if (m.npc) {
      npcCircle.set(m.npc.c, m.npc.r);
      npcCenter.set(m.npc.c);
    }
    if (m.H) hPoint.set(m.H);
    const showName = [state.names, state.names, state.names, state.names && anyH];
    labels.forEach((label, i) => label.show(showName[i]));
    labels[0].set(state.A);
    labels[1].set(state.B);
    labels[2].set(state.C);
    if (m.H) labels[3].set(m.H);

    hA.set(state.A);
    hB.set(state.B);
    hC.set(state.C);

    for (const key of Core.TRIANGLES) {
      toggles[key].setAttribute("aria-pressed", String(state.show[key]));
    }
    namesBtn.setAttribute("aria-pressed", String(state.names));
    namesBtn.textContent = state.names ? "Hide names" : "Show names";
    const allOn = Core.TRIANGLES.every((key) => state.show[key]);
    allBtn.setAttribute("aria-pressed", String(allOn));
    allBtn.textContent = allOn ? "Hide all four" : "Show all four";

    const shown = m.visible;
    const dots = m.triangles
      .filter((t) => state.show[t.key])
      .reduce((n, t) => n + t.circles.length, 0);
    let text;
    if (!m.npc) text = "Move the corners apart to make a triangle.";
    else if (m.degenerate) text = "Two of the triangles collapse here. Move a corner to bring them back.";
    else if (shown.length === 0) text = "The purple circle is the nine-point circle. Tick a triangle to see the circles that touch it.";
    else text = `${shown.join(", ")}: ${dots} circles touch the same nine-point circle${shown.length === 4 ? " — all sixteen" : ""}.`;
    const verified = shown.length === 4 && !m.degenerate &&
      Object.values(Core.claims(state)).every(Boolean);
    say(text, verified ? "done" : null);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function moveVertex(name, p) {
    state = Core.withPoint(state, name, inside(p));
    render();
  }

  const clampVertex = (p) => inside(p);
  const handleOptions = (name, label, dx, dy) => ({
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampVertex,
    label: `${label}. Drag, or focus it and use the arrow keys to move it`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => moveVertex(name, p),
  });
  const hA = board.handle("A", state.A, handleOptions("A", "Corner A", -18, 21));
  const hB = board.handle("B", state.B, handleOptions("B", "Corner B", -18, -10));
  const hC = board.handle("C", state.C, handleOptions("C", "Corner C", 9, 4));

  function reset() {
    state = Core.start();
    render();
    hA.node.focus();
  }

  newBtn.addEventListener("click", reset);
  for (const key of Core.TRIANGLES) {
    toggles[key].addEventListener("click", () => {
      state = Core.toggle(state, key);
      render();
    });
  }
  allBtn.addEventListener("click", () => {
    const allOn = Core.TRIANGLES.every((key) => state.show[key]);
    state = Core.setAll(state, !allOn);
    render();
  });
  namesBtn.addEventListener("click", () => {
    state = Core.toggle(state, "names");
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "n" || e.key === "N") {
      state = Core.toggle(state, "names");
      render();
    }
    const index = "1234".indexOf(e.key);
    if (index >= 0) {
      state = Core.toggle(state, Core.TRIANGLES[index]);
      render();
    }
  });

  board.onTheme(render);
  render();
})();
