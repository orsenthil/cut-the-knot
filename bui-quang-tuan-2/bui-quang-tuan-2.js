"use strict";

/*
 * The page for Bui Quang Tuan 2: drawing and input only; the geometry is in
 * bui-quang-tuan-2-core.js. Drag A1, A2, A3 to change the triangle, or P along
 * the bisector of angle A1 to choose the first circle. The six circles follow,
 * with their tangent points and the incenter/Gergonne construction overlays.
 * There is nothing to win or lose: Check the claim reports what holds here.
 */

(function () {
  const Core = BuiQuangTuan2Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const view = board.viewBox;

  const els = {
    newBtn: document.getElementById("newBtn"),
    namesBtn: document.getElementById("namesBtn"),
    gergonneBtn: document.getElementById("gergonneBtn"),
    oddBtn: document.getElementById("oddBtn"),
    evenBtn: document.getElementById("evenBtn"),
    allBtn: document.getElementById("allBtn"),
    checkBtn: document.getElementById("checkBtn"),
  };

  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 12, view.x + view.width - 12),
    y: Geom.clamp(p.y, view.y + 12, view.y + view.height - 12),
  });
  let state = Core.start({ width: view.width, height: view.height });
  let showNames = false;
  let showGergonne = false;
  let which = 2; // 0: C1,C3,C5  1: C2,C4,C6  2: every circle
  let checked = false;

  const circleLayer = board.layer("circles");
  const guideLayer = board.layer("guides");
  const sideLayer = board.layer("sides");
  const markLayer = board.layer("marks");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  // Made once; render only updates geometry, classes and visibility.
  const circles = [0, 1, 2, 3, 4, 5].map(() => board.circle(state.V[0], 1, "chain", circleLayer));
  const bigCircle = board.circle(state.V[0], 1, "big-circle", guideLayer);
  const incircle = board.circle(state.V[0], 1, "incircle", guideLayer);
  const bisector = board.line(state.V[0], state.V[0], "bisector", guideLayer);
  const cevians = [0, 1, 2].map(() => board.line(state.V[0], state.V[0], "cevian", guideLayer));
  const sides = [0, 1, 2].map(() => board.segment(state.V[0], state.V[0], "edge", sideLayer));
  const tanDots = [0, 1, 2, 3, 4, 5].map(() => board.point(state.V[0], "tan-dot", 3, markLayer));
  const touchDots = [0, 1, 2].map(() => board.point(state.V[0], "touch-dot", 4, markLayer));
  const geDot = board.point(state.V[0], "ge-dot", 5, markLayer);
  const vertexNames = ["A1", "A2", "A3"].map((t, i) =>
    board.label(state.V[i], t, "glabel", i === 1 ? -22 : 8, i === 0 ? -10 : 6, labelLayer));
  const circleNames = [0, 1, 2, 3, 4, 5].map(() => board.label(state.V[0], "C", "glabel clabel", 5, -5, labelLayer));
  const pName = board.label(state.V[0], "P", "glabel plabel", 9, -9, labelLayer);

  /** Status text; "done" marks an explored illustration for the record. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const f = Core.measurements(state);
    const cl = Core.claims(state);

    for (let i = 0; i < 6; i++) {
      const c = f.circles[i];
      const on = Boolean(c);
      circles[i].show(on);
      if (!on) continue;
      circles[i].set(c.c, c.r);
      const hot = which === 2 || (which === 0 && (i === 0 || i === 2 || i === 4)) ||
                  (which === 1 && (i === 1 || i === 3 || i === 5));
      circles[i].node.setAttribute("class", hot ? "chain hot" : "chain");
      circleNames[i].show(showNames && on);
      if (showNames) circleNames[i].set(c.c, "C" + (i + 1));
    }

    for (let i = 0; i < 3; i++) {
      sides[i].set(f.sides[i][0], f.sides[i][1]);
      vertexNames[i].set(state.V[i]);
    }
    bisector.show(Boolean(f.L0 && Core.valid(f.L0)));
    if (f.L0 && Core.valid(f.L0)) bisector.set(state.V[0], f.L0);

    for (let i = 0; i < 6; i++) {
      tanDots[i].show(Boolean(f.T[i]));
      if (f.T[i]) tanDots[i].set(f.T[i]);
    }

    const gergonneUI = showGergonne && Boolean(f.big && f.Ge && f.M);
    bigCircle.show(gergonneUI);
    incircle.show(gergonneUI && Boolean(f.incircle));
    geDot.show(gergonneUI);
    for (let i = 0; i < 3; i++) cevians[i].show(gergonneUI);
    if (gergonneUI) {
      bigCircle.set(f.big.c, f.big.r);
      if (f.incircle) incircle.set(f.incircle.c, f.incircle.r);
      geDot.set(f.Ge);
      for (let i = 0; i < 3; i++) {
        touchDots[i].set(f.M[i]);
        touchDots[i].show(true);
        cevians[i].set(state.V[i], f.M[i]);
      }
    } else {
      for (const dot of touchDots) dot.show(false);
    }
    pName.show(showNames && Boolean(f.P && Core.valid(f.P)));
    if (f.P && Core.valid(f.P)) pName.set(f.P);

    handles.A1.set(state.V[0]);
    handles.A2.set(state.V[1]);
    handles.A3.set(state.V[2]);
    handles.P.set(state.P);

    if (!f.valid || !cl) {
      say("Move P away from the vertex and keep the triangle's corners apart.", null);
    } else if (checked) {
      const bits = ["C7 lands back on C1",
                    "the six touch points lie on a circle centred at I",
                    "the three cevians meet at Ge"];
      if (cl.triple.odd.concurrent) bits.push("C1, C3 and C5 meet at Ge");
      if (cl.triple.even.concurrent) bits.push("C2, C4 and C6 meet at Ge");
      say("Checked here: " + bits.join("; ") + ".", "done");
    } else {
      say("Six circles: the first one starts at P; the seventh is back at the first. " +
          "Press Check the claim to test what holds here.", null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function move(name, p) {
    state = Core.withPoint(state, name, p);
    checked = false;
    render();
  }

  const clampVertex = (p) => inside(p);

  function clampP(p) {
    const f = Core.figure(state.V, state.t);
    if (!f.L0 || !Core.valid(f.L0)) return inside(p);
    const onLine = Core.nearest(inside(p), state.V[0], f.L0);
    const next = Core.withPoint(state, "P", onLine);
    const t = Geom.clamp(next.t, 0.02, 0.98);
    if (Math.abs(t - next.t) > 1e-12) {
      return Core.midPoint(state.V[0], f.L0, t);
    }
    return onLine;
  }

  const handles = {
    A1: board.handle("A1", state.V[0], {
      r: 9, step: 4, shift: 12, layer: handleLayer, clamp: clampVertex,
      label: "Vertex A1. Drag, or focus and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("A1", p),
    }),
    A2: board.handle("A2", state.V[1], {
      r: 9, step: 4, shift: 12, layer: handleLayer, clamp: clampVertex,
      label: "Vertex A2. Drag, or focus and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("A2", p),
    }),
    A3: board.handle("A3", state.V[2], {
      r: 9, step: 4, shift: 12, layer: handleLayer, clamp: clampVertex,
      label: "Vertex A3. Drag, or focus and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("A3", p),
    }),
    P: board.handle("P", state.P, {
      r: 7, step: 4, shift: 12, layer: handleLayer, cls: "geom-handle p-handle", clamp: clampP,
      label: "P, centre of the first circle. Drag along the dashed bisector, or focus and use the arrow keys.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("P", p),
    }),
  };

  function reset() {
    state = Core.start({ width: view.width, height: view.height });
    checked = false;
    render();
    handles.A1.node.focus();
  }

  function toggleNames() {
    showNames = !showNames;
    els.namesBtn.setAttribute("aria-pressed", String(showNames));
    els.namesBtn.textContent = showNames ? "Hide names" : "Show names";
    render();
  }

  function toggleGergonne() {
    showGergonne = !showGergonne;
    els.gergonneBtn.setAttribute("aria-pressed", String(showGergonne));
    els.gergonneBtn.textContent = showGergonne ? "Hide Gergonne point" : "Show Gergonne point";
    render();
  }

  function setWhich(n) {
    which = n;
    for (const [key, value] of [["oddBtn", 0], ["evenBtn", 1], ["allBtn", 2]]) {
      els[key].setAttribute("aria-pressed", String(which === value));
    }
    render();
  }

  function checkClaim() {
    checked = true;
    render();
  }

  els.newBtn.addEventListener("click", reset);
  els.namesBtn.addEventListener("click", toggleNames);
  els.gergonneBtn.addEventListener("click", toggleGergonne);
  els.oddBtn.addEventListener("click", () => setWhich(0));
  els.evenBtn.addEventListener("click", () => setWhich(1));
  els.allBtn.addEventListener("click", () => setWhich(2));
  els.checkBtn.addEventListener("click", checkClaim);

  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    if (key === "n") toggleNames();
    if (key === "g") toggleGergonne();
    if (key === "c") checkClaim();
    if (key === "1") setWhich(0);
    if (key === "2") setWhich(1);
    if (key === "3") setWhich(2);
  });

  board.onTheme(render);
  render();
})();
