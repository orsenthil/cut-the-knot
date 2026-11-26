"use strict";

/*
 * The page for Bui Quang Tuan: drawing and input only; the geometry is in
 * bui-quang-tuan-core.js. The SVG holds a triangle with four draggable points:
 * its three corners and the centre P of the first circle on the bisector at
 * A1. From P the core builds six circles, one in each corner in turn. The
 * status reports that C7 returns to C1 and that the six touching points lie
 * on a circle centred at the incenter. There is nothing to win or lose.
 */

(function () {
  const Core = BuiQuangTuanCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const joinBtn = document.getElementById("joinBtn");
  const pairSel = document.getElementById("pairSel");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 12, view.x + view.width - 12),
    y: Geom.clamp(p.y, view.y + 12, view.y + view.height - 12),
  });

  let state = Core.start();
  let showNames = false;
  let joinCenters = false;
  let which = 0; // 0 = the applet's "Show all circles"; 1..6 = its radio pairs

  const triangleLayer = board.layer("triangle");
  const circleLayer = board.layer("circles");
  const linkLayer = board.layer("links");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  /* Every object is made once; render only changes geometry and visibility. */
  const sides = [
    board.segment(state.A1, state.A2, "edge", triangleLayer),
    board.segment(state.A2, state.A3, "edge", triangleLayer),
    board.segment(state.A3, state.A1, "edge", triangleLayer),
  ];
  const bisector = board.line(state.A1, state.P, "bisector", triangleLayer);
  const circles = Array.from({ length: 6 }, () =>
    board.circle(state.P, 1, "chain-circle", circleLayer));
  const bigCircle = board.circle(state.P, 1, "big-circle", circleLayer);
  const links = Array.from({ length: 6 }, () =>
    board.segment(state.P, state.P, "centre-link", linkLayer));
  const centreDots = Array.from({ length: 6 }, () =>
    board.point(state.P, "centre-dot", 3.5, dotLayer));
  const incenterDot = board.point(state.P, "incenter-dot", 5, dotLayer);
  const touchDots = Array.from({ length: 6 }, () =>
    board.point(state.P, "touch-dot", 4, dotLayer));

  const vertexLabels = ["A1", "A2", "A3"].map((t, i) =>
    board.label(state.P, t, "glabel", i === 0 ? -18 : -16, -10, labelLayer));
  const centreLabels = Array.from({ length: 6 }, (_, i) =>
    board.label(state.P, "C" + (i + 1), "glabel label-c", -10, -9, labelLayer));
  const touchLabels = Array.from({ length: 6 }, (_, i) =>
    board.label(state.P, "T" + (i + 1), "glabel label-t", 7, -7, labelLayer));
  const incenterLabel = board.label(state.P, "I", "glabel label-i", 8, -7, labelLayer);

  /** Shows a line under the picture. A demo never uses win/lose/done. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const chain = Core.circles(state);
    const cl = Core.claims(state);
    const foot = Core.bisectorFoot(state);
    const I = Core.incenter(state);
    const centres = [chain.first, ...chain.drawn].map((o) => o.c);

    sides[0].set(state.A1, state.A2);
    sides[1].set(state.A2, state.A3);
    sides[2].set(state.A3, state.A1);
    bisector.set(state.A1, foot);

    for (let i = 0; i < 6; i++) {
      circles[i].set(centres[i], [chain.first, ...chain.drawn][i].r);
      // Checkbox n in the applet (our Pair n, 1..6) colours circles Cn and
      // C(n+1), with Pair 6 colouring C6 and C1. 0 is "Show all circles".
      const hot = which === 0 || i === which - 1 || i === which % 6;
      circles[i].node.setAttribute("class", hot ? "chain-circle hot" : "chain-circle");
      centreDots[i].set(centres[i]);
      touchDots[i].set(chain.tangency[i]);
      links[i].set(centres[i], centres[(i + 1) % 6]);
      links[i].show(joinCenters);
      centreLabels[i].set(centres[i]);
      centreLabels[i].show(showNames);
      touchLabels[i].set(chain.tangency[i]);
      touchLabels[i].show(showNames);
    }
    bigCircle.set(chain.big.c, chain.big.r);
    incenterDot.set(I);
    incenterLabel.set(I);
    incenterLabel.show(showNames);

    const corners = [state.A1, state.A2, state.A3];
    for (let i = 0; i < 3; i++) {
      vertexLabels[i].set(corners[i]);
      vertexLabels[i].show(showNames);
    }
    for (const name of Core.HANDLES) handles[name].set(state[name]);

    if (!cl) {
      say("Move the corners apart until the circles can be built again.", null);
    } else {
      say("C7 = C1. The six touching points lie on one circle centred at the incenter.", null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({ ...state, which, showNames, joinCenters });
    }
  }

  function move(name, p) {
    state = Core.withPoint(state, name, p);
    render();
  }

  const handles = {};
  for (const name of Core.HANDLES) {
    handles[name] = board.handle(name, state[name], {
      r: 8, step: 4, shift: 12, layer: handleLayer, clamp: inside,
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move(name, p),
    });
  }

  function reset() {
    state = Core.start();
    showNames = false;
    joinCenters = false;
    which = 0;
    namesBtn.setAttribute("aria-pressed", "false");
    namesBtn.textContent = "Show names";
    joinBtn.setAttribute("aria-pressed", "false");
    joinBtn.textContent = "Join centers";
    pairSel.value = "0";
    render();
    handles.A1.node.focus();
  }

  function toggleNames() {
    showNames = !showNames;
    namesBtn.setAttribute("aria-pressed", String(showNames));
    namesBtn.textContent = showNames ? "Hide names" : "Show names";
    render();
  }

  function toggleJoin() {
    joinCenters = !joinCenters;
    joinBtn.setAttribute("aria-pressed", String(joinCenters));
    joinBtn.textContent = joinCenters ? "Hide center links" : "Join centers";
    render();
  }

  function choosePair() {
    which = Number(pairSel.value);
    render();
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", toggleNames);
  joinBtn.addEventListener("click", toggleJoin);
  pairSel.addEventListener("change", choosePair);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    if (key === "n") toggleNames();
    if (key === "j") toggleJoin();
  });

  board.onTheme(render);
  render();
})();
