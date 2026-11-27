"use strict";

/*
 * The page for CevaPWW: drawing and input only; all the geometry is in
 * ceva-pww-core.js. An SVG holds triangle ABC with three draggable corners,
 * the cevians AD, BE, CF and their common point K. The four integer counts
 * on the sides are the applet's text fields; the five toggles draw the grid,
 * its fine subdivision, the diagonals, the coloured dissection and the
 * cycle through its three pieces, exactly as in CevaPWWCanvas.DrawGrid.
 */

(function () {
  const Core = CevaPwwCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const ratioKeys = ["ae", "ec", "af", "fb"];
  const toggleKeys = ["grid", "fine", "diagonals", "colors", "cycle"];

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 6, view.x + view.width - 6),
    y: Geom.clamp(p.y, view.y + 6, view.y + view.height - 6),
  });
  const fmt = (v) => (v === null || !Number.isFinite(v) ? "—" :
    (Number.isInteger(v) ? String(v) : v.toFixed(3)));

  let state = Core.start();
  let cycleIndex = 2;
  let timer = null;

  /* Painted bottom to top; only these layers are rebuilt on a redraw. */
  const layers = {
    fills: board.layer("fills"),
    fine: board.layer("fine"),
    grid: board.layer("grid"),
    extra: board.layer("extra"),
    cevians: board.layer("cevians"),
    feet: board.layer("feet"),
  };
  const handlesLayer = board.layer("handles");

  /** A short line of the picture, made from plain numbers in board units. */
  function segment(a, b, cls, layer) {
    board.el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y }, cls, layer);
  }
  function dot(p, cls, r, layer) {
    board.el("circle", { cx: p.x, cy: p.y, r: r }, cls, layer);
  }
  function shown(p) {
    return p && Number.isFinite(p.x) && Number.isFinite(p.y);
  }

  /**
   * Shows the status line. `kind` is "done" when a claim has been checked,
   * or nothing while the player is exploring; the record reads the class.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function clearLayers() {
    for (const k of Object.keys(layers)) board.clear(layers[k]);
  }

  /** The three coloured regions into which the cevians cut the triangle. */
  function drawFills(f) {
    if (!state.colors || !f.wellFormed) return;
    const regions = [
      [f.A, f.F, f.K, f.E],
      [f.B, f.F, f.K, f.D],
      [f.C, f.D, f.K, f.E],
    ];
    for (let i = 0; i < regions.length; i++) {
      const hot = state.cycle && cycleIndex === i;
      board.polygon(regions[i], hot ? "region region-hot" : "region region-" + i, layers.fills);
    }
  }

  /**
   * The applet's DrawParallels: n+1 segments joining the same fraction of
   * two sides of a quadrilateral. LinComb(t*p + (1-t)*q) is Core.linComb.
   */
  function parallels(n, p, q, r, s, cls, layer) {
    if (!n) return; // the applet's 0/0 step draws nothing
    const count = Math.min(Math.abs(n), 200);
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      segment(Core.linComb(p, q, t), Core.linComb(r, s, t), cls, layer);
    }
  }

  function drawGrid(f) {
    if (!f.wellFormed) return;
    const { A, B, C, E, F, D, K, G, Q, R } = f;
    const n1 = (state.ae + state.ec) * state.af;
    const n2 = (state.af + state.fb) * state.ae;
    if (state.fine) {
      segment(A, Q, "fine-edge", layers.fine);
      segment(Q, G, "fine-edge", layers.fine);
      segment(G, R, "fine-edge", layers.fine);
      segment(R, A, "fine-edge", layers.fine);
      parallels(n1, A, Q, R, G, "fine-line", layers.fine);
      parallels(n2, A, R, G, Q, "fine-line", layers.fine);
    }
    if (state.grid) {
      segment(A, Q, "grid-edge", layers.grid);
      segment(Q, G, "grid-edge", layers.grid);
      segment(G, R, "grid-edge", layers.grid);
      segment(R, A, "grid-edge", layers.grid);
      parallels(n1, A, Q, R, G, "grid-line", layers.grid);
      parallels(n2, A, R, G, Q, "grid-line", layers.grid);
      dot(G, "grid-dot", 2.5, layers.grid);
      board.label(G, "G", "glabel", 7, -6, layers.grid);
    }
    if (state.diagonals) {
      parallels(state.fb * state.ae, f.p20, A, f.p22, B, "extra-line", layers.extra);
      parallels(state.ec * state.af, f.p21, A, f.p22, f.p23, "extra-line", layers.extra);
    }
    if (state.colors) {
      if (state.cycle) {
        if (cycleIndex === 0) {
          parallels(state.ae * state.af, A, F, K, A, "color-line", layers.extra);
          parallels(state.ae * state.af, A, E, K, A, "color-line", layers.extra);
        } else if (cycleIndex === 1) {
          parallels(state.fb * state.ae, F, B, B, K, "color-line", layers.extra);
          parallels(state.fb * state.ae, D, B, B, K, "color-line", layers.extra);
        } else {
          parallels(state.ec * state.af, E, C, C, K, "color-line", layers.extra);
          parallels(state.ec * state.af, D, C, C, K, "color-line", layers.extra);
        }
      } else {
        parallels(state.fb * state.ae, f.p20, A, f.p22, B, "color-line", layers.extra);
        parallels(state.ec * state.af, f.p21, A, f.p22, f.p23, "color-line", layers.extra);
        parallels(state.ec * state.af, E, C, C, K, "color-line", layers.extra);
        parallels(state.ec * state.af, D, C, C, K, "color-line", layers.extra);
        parallels(state.fb * state.ae, F, B, B, K, "color-line", layers.extra);
        parallels(state.fb * state.ae, D, B, B, K, "color-line", layers.extra);
        parallels(state.ae * state.af, A, F, K, A, "color-line", layers.extra);
        parallels(state.ae * state.af, A, E, K, A, "color-line", layers.extra);
      }
    }
  }

  function drawCevians(f) {
    const { A, B, C, E, F, D, K } = f;
    for (const side of [[A, B], [B, C], [C, A]]) {
      segment(side[0], side[1], "triangle-side", layers.cevians);
    }
    const cevians = f.cevians;
    for (const [vertex, foot, cev] of [[B, E, cevians.be], [C, F, cevians.cf],
      [A, D, cevians.ad]]) {
      if (foot) segment(vertex, foot, "cevian", layers.cevians);
      else board.line(cev.line.p, cev.line.q, "cevian", layers.cevians);
    }
    if (shown(K)) {
      for (const foot of [E, F, D]) {
        if (shown(foot)) segment(K, foot, "spoke", layers.cevians);
      }
    }
    for (const [p, name, dx, dy] of [[E, "E", 7, -7], [F, "F", -14, -7],
      [D, "D", 5, 14], [K, "K", 7, -7]]) {
      if (!shown(p)) continue;
      dot(p, name === "K" ? "k-dot" : "foot-dot", name === "K" ? 4 : 3, layers.feet);
      board.label(p, name, "glabel", dx, dy, layers.feet);
    }
    for (const [h, name, dx, dy] of [[hA, "A", -18, -8], [hB, "B", -5, -12],
      [hC, "C", 8, 4]]) {
      board.label(h.point, name, "glabel vertex-label", dx, dy, layers.feet);
    }
  }

  function render() {
    const f = Core.figure(state);
    const r = Core.ratios(state);
    clearLayers();
    drawFills(f);
    drawGrid(f);
    drawCevians(f);

    if (state.cycle) cycleIndex = (cycleIndex + 1) % 3;
    const cl = Core.claims(state);
    if (!cl.nondegenerate) {
      say("Move the corners apart to make a triangle.", null);
    } else if (!f.wellFormed) {
      say("A cevian is parallel to the opposite side; choose counts that add up.", null);
    } else {
      say(`AF/FB = ${fmt(r.afFb)}, BD/DC = ${fmt(r.bdDc)}, CE/EA = ${fmt(r.ceEa)} — the product is ${fmt(r.product)}.`, null);
    }

    for (const k of ratioKeys) {
      const input = document.getElementById(k + "Input");
      if (document.activeElement !== input) input.value = String(state[k]);
    }
    for (const k of toggleKeys) {
      document.getElementById(k + "Btn").setAttribute("aria-pressed", String(state[k]));
    }
    document.getElementById("cycleBtn").disabled = !state.colors;

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state({
      A: f.A, B: f.B, C: f.C,
      ae: state.ae, ec: state.ec, af: state.af, fb: state.fb,
      grid: state.grid, fine: state.fine, diagonals: state.diagonals,
      colors: state.colors, cycle: state.cycle,
    });
  }

  function moveVertex(name, p) {
    state = Core.withPoint(state, name, inside(p));
    render();
  }

  const clampVertex = (p) => inside(p);
  const hA = board.handle("A", state.A, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampVertex,
    label: "Corner A. Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => moveVertex("A", p),
  });
  const hB = board.handle("B", state.B, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampVertex,
    label: "Corner B. Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => moveVertex("B", p),
  });
  const hC = board.handle("C", state.C, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampVertex,
    label: "Corner C. Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => moveVertex("C", p),
  });

  function setCount(key, value) {
    state = Core.setRatio(state, key, value);
    render();
  }
  function stopCycle() {
    if (timer !== null) { clearInterval(timer); timer = null; }
  }
  function startCycle() {
    stopCycle();
    timer = setInterval(() => { if (state.cycle) render(); }, 1000);
  }

  newBtn.addEventListener("click", () => {
    state = Core.start();
    cycleIndex = 2;
    render();
    hA.node.focus();
  });
  for (const key of ratioKeys) {
    document.getElementById(key + "Less").addEventListener("click",
      () => setCount(key, state[key] - 1));
    document.getElementById(key + "More").addEventListener("click",
      () => setCount(key, state[key] + 1));
    const input = document.getElementById(key + "Input");
    input.addEventListener("change", () => { setCount(key, input.value); input.value = String(state[key]); });
  }
  for (const key of toggleKeys) {
    document.getElementById(key + "Btn").addEventListener("click", () => {
      state = { ...state, [key]: !state[key] };
      if (key === "cycle" || key === "colors") {
        if (state.cycle && state.colors) startCycle(); else stopCycle();
      }
      render();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") {
      state = Core.start();
      cycleIndex = 2;
      render();
    }
  });

  board.onTheme(render);
  render();
})();
