"use strict";

/*
 * The page for Half Turn: drawing and input only. The transformation is in
 * half-turn-core.js. An SVG board holds the red arrow AB, one blue copy for
 * each half turn, dashed trails joining matching endpoints and, when asked,
 * the long dashed AA_n and BB_n. Geom handles let a pointer or the arrow keys
 * move A, B or any center O_i; the controls change the spinner and the two
 * checkboxes of the Java applet.
 */

(function () {
  const Core = HalfTurnCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    statement: board.layer("statement"),
    trails: board.layer("trails"),
    segments: board.layer("segments"),
    centers: board.layer("centers"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geometry = Core.compute(state);

  /** Status line; a demo has no win or loss, so no result class is ever set. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const statementLines = [board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "statement-line", layers.statement),
    board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "statement-line", layers.statement)];
  const trailLines = [];
  const arrowLines = [];
  const arrowHeads = [];
  const copyDots = [];
  const centerDots = [];
  const labels = [];

  function grow(list, count, make) {
    while (list.length < count) list.push(make());
    list.forEach((item, i) => item.show(i < count));
  }

  /** The Java applet draws a fixed-size arrowhead at Start, pointing to End. */
  function headPoints(start, end) {
    const dx = start.x - end.x, dy = start.y - end.y;
    const d = Math.hypot(dx, dy) || 1;
    const scale = Math.min(12, d / 2) / d;
    const base = { x: start.x - scale * dx, y: start.y - scale * dy };
    const wing = scale / 4;
    return [start,
      { x: base.x + dy * wing, y: base.y - dx * wing },
      { x: base.x - dy * wing, y: base.y + dx * wing }];
  }

  const arrowHandles = {};
  for (const which of ["a", "b"]) {
    arrowHandles[which] = board.handle(which, { x: 0, y: 0 }, {
      r: 11,
      step: 4,
      cls: "geom-handle endpoint-handle",
      layer: layers.handles,
      label: (which === "a" ? "Arrow head A" : "Arrow tail B") +
        ". Drag it, or focus it and use the arrow keys to move the arrow.",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      onMove: (p, name) => apply({ type: "point", which: name, point: p },
        "Moved " + (name === "a" ? "arrow head A" : "arrow tail B") + " to (" +
        Math.round(p.x) + ", " + Math.round(p.y) + ")."),
    });
  }

  const centerHandles = Array.from({ length: Core.N_MAX }, (_, i) =>
    board.handle("o" + i, { x: 0, y: 0 }, {
      r: 10,
      step: 4,
      cls: "geom-handle center-handle",
      layer: layers.handles,
      label: "Center O" + (i + 1) + " of a half turn. Drag it, or focus it and use the arrow keys.",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      onMove: (p, name) => apply({ type: "point", which: "center", index: Number(name.slice(1)), point: p },
        "Moved center O" + (Number(name.slice(1)) + 1) + " to (" +
        Math.round(p.x) + ", " + Math.round(p.y) + ")."),
    }));

  /** Draw everything from the current state, reusing each SVG element. */
  function draw() {
    geometry = Core.compute(state);
    const segs = geometry.segments;
    const last = segs[segs.length - 1];

    grow(trailLines, 2 * state.n, () => board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "trail", layers.trails));
    for (let i = 0; i < state.n; i++) {
      trailLines[2 * i].set(geometry.aPoints[i], geometry.aPoints[i + 1]);
      trailLines[2 * i + 1].set(geometry.bPoints[i], geometry.bPoints[i + 1]);
    }

    grow(arrowLines, segs.length, () => board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "arrow-line", layers.segments));
    grow(arrowHeads, segs.length, () => board.polygon([{ x: 0, y: 0 }], "arrow-head", layers.segments));
    grow(copyDots, segs.length, () => board.point({ x: 0, y: 0 }, "copy-dot", 3, layers.segments));
    segs.forEach((seg, i) => {
      const cls = "arrow-line" + (i === 0 ? " original" : " copy");
      const dotCls = "copy-dot" + (i === 0 ? " original" : "");
      arrowLines[i].node.setAttribute("class", cls);
      arrowHeads[i].node.setAttribute("class", "arrow-head" + (i === 0 ? " original" : ""));
      copyDots[i].node.setAttribute("class", dotCls);
      const short = Math.hypot(seg.end.x - seg.start.x, seg.end.y - seg.start.y) < 0.1;
      arrowLines[i].show(!short);
      arrowHeads[i].show(!short);
      copyDots[i].show(short);
      if (!short) {
        arrowLines[i].set(seg.start, seg.end);
        arrowHeads[i].set(headPoints(seg.start, seg.end));
      } else {
        copyDots[i].set(seg.start);
      }
    });

    grow(centerDots, state.n, () => board.point({ x: 0, y: 0 }, "center-dot", 5, layers.centers));
    state.centers.slice(0, state.n).forEach((o, i) => centerDots[i].set(o));

    const show = state.showStatement;
    statementLines.forEach((line) => line.show(show));
    if (show) {
      statementLines[0].set(state.a, last.start);
      statementLines[1].set(state.b, last.end);
    }

    const names = [];
    if (state.showNames) {
      names.push({ p: state.a, text: "A", dx: -16, dy: -8 });
      names.push({ p: state.b, text: "B", dx: 7, dy: 16 });
      for (let i = 1; i <= state.n; i++) {
        names.push({ p: geometry.aPoints[i], text: "A" + i, dx: -20, dy: -8 });
        names.push({ p: geometry.bPoints[i], text: "B" + i, dx: 7, dy: 16 });
      }
      state.centers.slice(0, state.n).forEach((o, i) =>
        names.push({ p: o, text: "O" + (i + 1), dx: 7, dy: -8 }));
    }
    grow(labels, names.length, () => board.label({ x: 0, y: 0 }, "", "point-label", 0, 0, layers.labels));
    names.forEach((name, i) => labels[i].set(name.p, name.text, name.dx, name.dy));

    arrowHandles.a.set(state.a);
    arrowHandles.b.set(state.b);
    centerHandles.forEach((handle, i) => {
      const on = i < state.n;
      if (on) handle.set(state.centers[i]);
      handle.show(on);
    });

    nSel.value = String(state.n);
    namesBox.checked = state.showNames;
    statementBox.checked = state.showStatement;
  }

  function statusText() {
    const c = Core.composition(state);
    const r = (v) => Math.round(v);
    if (c.sign > 0) {
      return "After " + state.n + " half turns every point slides by (" + r(c.t.x) + ", " + r(c.t.y) +
        "). A and B land at A" + state.n + " and B" + state.n +
        "; AA" + state.n + " and BB" + state.n + " have the same length and direction.";
    }
    return "After " + state.n + " half turns the arrow is turned halfway around (" + r(c.center.x) + ", " +
      r(c.center.y) + "). The lines AA" + state.n + " and BB" + state.n + " both pass through that point.";
  }

  /** Redraw, speak what happened in words, and save the position for the tutor. */
  function render() {
    draw();
    say(statusText(), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; a refused one leaves the picture and focus as they were. */
  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) {
      draw();
      say("That move could not be made. Try another point.");
      return false;
    }
    state = next;
    render();
    if (note) say(note + " " + statusText(), Core.result(state));
    return true;
  }

  const nSel = document.getElementById("nSel");
  const namesBox = document.getElementById("namesBox");
  const statementBox = document.getElementById("statementBox");

  for (let n = Core.N_MIN; n <= Core.N_MAX; n++) nSel.add(new Option(String(n), String(n)));

  nSel.addEventListener("change", () => apply({ type: "option", key: "n", value: Number(nSel.value) },
    "Now showing " + nSel.value + " half turns in a row."));
  namesBox.addEventListener("change", () => apply({ type: "option", key: "showNames", value: namesBox.checked },
    namesBox.checked ? "Names are shown." : "Names are hidden."));
  statementBox.addEventListener("change", () =>
    apply({ type: "option", key: "showStatement", value: statementBox.checked },
      statementBox.checked ? "The long AA and BB lines are shown." : "The long AA and BB lines are hidden."));
  document.getElementById("centersBtn").addEventListener("click", () =>
    apply({ type: "newCenters" }, "The centers jumped to new positions."));
  document.getElementById("resetBtn").addEventListener("click", () =>
    apply({ type: "reset" }, "The arrow and centers are back at their opening positions."));

  // Colours are CSS classes, so a theme flip only needs a fresh draw.
  board.onTheme(() => draw());

  draw();
  render();
})();
