"use strict";

/*
 * The page for Center Circle: drawing and input only; the geometry is in
 * center-circle-core.js. Seven lines each have two draggable endpoints. The
 * buttons mirror the applet's three checkboxes (Circles, Centers, Intersection)
 * and its seven line checkboxes. The circles, their centers and the common
 * point are drawn from the core's hierarchy; nothing here can be won or lost.
 * The applet picked its first lines at random; this page opens on one fixed,
 * well-spread layout so the circles are on screen, and "New lines" randomises
 * exactly as the applet's Reset does.
 */

(function () {
  const Core = CenterCircleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const view = board.viewBox;
  const fits = (c) => Core.finiteCircle(c) && c.radius < 100 * view.width;

  const LINE = (x1, y1, x2, y2) => ({ a: { x: x1, y: y1 }, b: { x: x2, y: y2 } });
  const FIRST_LINES = [
    LINE(87, 63, 231, 214), LINE(20, 51, 290, 147),
    LINE(304, 124, 38, 80), LINE(39, 195, 312, 124),
    LINE(380, 161, 113, 165), LINE(139, 228, 366, 21),
    LINE(173, 201, 34, 110),
  ];

  let state = Core.start({ lines: FIRST_LINES, width: view.width, height: view.height });
  let checked = false;

  /* Painted back to front: circles, lines, centers, points, labels, handles. */
  const circleLayer = board.layer("circles");
  const lineLayer = board.layer("lines");
  const centerLayer = board.layer("centers");
  const commonLayer = board.layer("common");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  /* Fixed-size pools: the elements are created once and only moved or hidden. */
  const COUNTS = { 3: 35, 4: 35, 5: 21, 6: 7, 7: 1 };
  const circles = {}, centers = {}, commons = {};
  for (const order of Object.keys(COUNTS)) {
    circles[order] = [];
    centers[order] = [];
    commons[order] = [];
    for (let i = 0; i < COUNTS[order]; i++) {
      circles[order].push(board.circle(state.lines[0].a, 1, `cc-circle l${order}`, circleLayer));
      centers[order].push(board.point(state.lines[0].a, `cc-center l${order}`, 3.4, centerLayer));
      if (Number(order) >= 4) {
        commons[order].push(board.point(state.lines[0].a, `cc-common l${order}`, 4.2, commonLayer));
      }
    }
  }

  const lines = [];
  for (let i = 0; i < Core.N_LINES; i++) {
    lines.push(board.line(state.lines[i].a, state.lines[i].b, `cc-line l${i + 1}`, lineLayer));
  }
  const topLabel = board.label(state.lines[0].a, "P", "cc-label", 8, -8, labelLayer);

  /** The status line. "done" is the only class an illustration ever uses. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const d = Core.diagram(state);
    const orders = Object.keys(COUNTS);
    for (const order of orders) {
      circles[order].forEach((o) => o.show(false));
      centers[order].forEach((o) => o.show(false));
      commons[order] && commons[order].forEach((o) => o.show(false));
    }
    topLabel.show(false);

    lines.forEach((line, i) => {
      line.show(Boolean(state.shown[i]));
      if (state.shown[i]) line.set(state.lines[i].a, state.lines[i].b);
    });
    handles.forEach((pair, i) => {
      ["a", "b"].forEach((end, j) => {
        pair[j].show(Boolean(state.shown[i]));
        if (state.shown[i]) pair[j].set(state.lines[i][end]);
      });
    });

    // The applet recomputes the same lower-level circles many times as it
    // walks its recursion. Draw each one once; the picture is identical.
    const used = {}, seen = new Set();
    let unique = 0;
    for (const node of d.nodes) {
      const id = `${node.order}:${node.subset.join(",")}`;
      if (seen.has(id)) continue;
      seen.add(id);
      unique++;
      const key = String(node.order);
      const i = used[key] || 0;
      used[key] = i + 1;
      if (!circles[key] || i >= circles[key].length) continue;
      if (fits(node.circle)) {
        circles[key][i].show(state.showCircles);
        if (state.showCircles) circles[key][i].set(node.circle, node.circle.radius);
        centers[key][i].show(state.showCenters);
        if (state.showCenters) centers[key][i].set(node.circle);
      }
      if (node.point && commons[key] && i < commons[key].length) {
        commons[key][i].show(state.showCommon);
        if (state.showCommon) commons[key][i].set(node.point);
      }
      if (d.root === node && node.point && state.showCommon) {
        topLabel.show(true);
        topLabel.set(node.point);
      }
    }

    const shownCount = state.shown.filter(Boolean).length;
    const drawn = state.showCircles ? unique : 0;
    if (shownCount < 3) {
      say("Show at least three lines to make a circle.", null);
    } else if (checked && Object.values(Core.claims(state)).every(Boolean)) {
      say(`Confirmed: ${unique} circles in the chain; every set of centers lies on a circle and the child circles meet at a point.`, "done");
    } else if (state.showCommon && d.root && d.root.point) {
      say(`All ${d.root.order} circles meet at P; their centers lie on the next circle.`, null);
    } else if (drawn) {
      say(`${drawn} circles drawn from ${shownCount} lines. Press Show centers and Show point to see the pattern.`, null);
    } else {
      say(`${shownCount} lines shown. Press Show circles to build the chain.`, null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const clampPoint = (p) => ({
    x: Geom.clamp(p.x, view.x + 6, view.x + view.width - 6),
    y: Geom.clamp(p.y, view.y + 6, view.y + view.height - 6),
  });
  const handles = [];
  for (let i = 0; i < Core.N_LINES; i++) {
    const pair = [];
    for (const [end, word] of [["a", "first"], ["b", "second"]]) {
      pair.push(board.handle(`L${i + 1}${end}`, state.lines[i][end], {
        r: 6, step: 3, shift: 9, layer: handleLayer, clamp: clampPoint,
        label: `Line ${i + 1}, ${word} point. Drag, or focus and use the arrow keys to move it.`,
        describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
        onMove: (p) => {
          state = Core.withPoint(state, i, end, p);
          checked = false;
          render();
        },
      }));
    }
    handles.push(pair);
  }

  function newLines() {
    state = Core.start({
      width: view.width, height: view.height,
      showCircles: state.showCircles, showCenters: state.showCenters,
      showCommon: state.showCommon,
    });
    checked = false;
    handles.forEach((pair, i) => ["a", "b"].forEach((end, j) => pair[j].set(state.lines[i][end])));
    syncButtons();
    render();
    handles[0][0].node.focus();
  }

  function checkClaims() {
    checked = true;
    render();
    if (!Object.values(Core.claims(state)).every(Boolean)) {
      say("Show at least three well-spread lines, then check again.", null);
    }
  }

  const toggles = [
    ["circlesBtn", "showCircles", "circles"],
    ["centersBtn", "showCenters", "centers"],
    ["commonBtn", "showCommon", "common point"],
  ];

  function syncButtons() {
    for (const [id, key, label] of toggles) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      btn.setAttribute("aria-pressed", String(state[key]));
      btn.textContent = `${state[key] ? "Hide" : "Show"} ${label}`;
      btn.setAttribute("aria-label", `${state[key] ? "Hide" : "Show"} ${label} in the diagram`);
    }
    for (let i = 0; i < Core.N_LINES; i++) {
      const btn = document.getElementById(`line${i + 1}Btn`);
      if (!btn) continue;
      btn.setAttribute("aria-pressed", String(state.shown[i]));
      btn.setAttribute("aria-label", `${state.shown[i] ? "Hide" : "Show"} line ${i + 1}`);
      btn.classList.toggle("off", !state.shown[i]);
    }
  }

  document.getElementById("newBtn").addEventListener("click", newLines);
  document.getElementById("checkBtn").addEventListener("click", checkClaims);
  for (const [id, key] of toggles) {
    document.getElementById(id).addEventListener("click", () => {
      state = Core.withFlag(state, key, !state[key]);
      syncButtons();
      render();
    });
  }
  for (let i = 0; i < Core.N_LINES; i++) {
    document.getElementById(`line${i + 1}Btn`).addEventListener("click", () => {
      state = Core.withShown(state, i, !state.shown[i]);
      checked = false;
      syncButtons();
      render();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") newLines();
    if (e.key === "c" || e.key === "C") checkClaims();
    if (/^[1-7]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      state = Core.withShown(state, i, !state.shown[i]);
      checked = false;
      syncButtons();
      render();
    }
  });

  board.onTheme(render);
  syncButtons();
  render();
})();
