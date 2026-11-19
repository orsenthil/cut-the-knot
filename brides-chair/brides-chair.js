"use strict";

/*
 * Browser view of Brides' Chair. All the geometry is in
 * brides-chair-core.js; this file only draws it and takes input.
 *
 * The play area shows a triangle with a square on each side and the three
 * flank triangles between them. Drag A, B or C (or focus the picture, press
 * 1/2/3 and use the arrow keys). The slider turns a copy of the A-flank about
 * A; at 90 degrees its corner B' lands on C. The four checkboxes are the
 * applet's own Show names / Show lines / Fill triangles / Show medians.
 */

(() => {
  const C = BridesChairCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const range = document.getElementById("rotationRange");
  const rangeValue = document.getElementById("rangeValue");
  const resetBtn = document.getElementById("resetBtn");
  const rightBtn = document.getElementById("rightBtn");
  const checks = {
    showNames: document.getElementById("namesCheck"),
    showLines: document.getElementById("linesCheck"),
    fillTriangles: document.getElementById("fillCheck"),
    medians: document.getElementById("mediansCheck"),
  };

  const W = C.WIDTH;
  const H = C.HEIGHT;
  const MARGIN = 20; // logical room for point labels at the edges of the figure
  const NAMES = ["A", "B", "C"];
  const OUTER = ["A_b", "A_c", "B_a", "B_c", "C_a", "C_b"];

  let state = null;
  let message = "";
  let tokens = {};
  let view = { scale: 1, ox: 0, oy: 0 };

  function refreshTokens() {
    const cs = getComputedStyle(document.documentElement);
    const get = (name) => cs.getPropertyValue(name).trim();
    tokens = {
      stage: get("--stage"),
      ink: get("--ink"),
      text: get("--text"),
      muted: get("--muted"),
      accent: get("--accent"),
      soft: get("--accent-soft"),
      board: get("--board-a"),
      highlight: get("--highlight"),
      good: get("--good"),
    };
  }

  /** The status line doubles as the record's "demo explored" signal. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  // ---- drawing -----------------------------------------------------------

  function line(a, b, colour, width, dash) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = colour;
    ctx.lineWidth = width || 1;
    ctx.setLineDash(dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function polygon(points, fill, stroke, width) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 1.5; ctx.stroke(); }
  }

  function dot(p, radius, colour, ring) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = colour;
    ctx.fill();
    if (ring) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 4, 0, 2 * Math.PI);
      ctx.strokeStyle = ring;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function label(p, text, colour, dx, dy) {
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.fillStyle = colour;
    ctx.fillText(text, p.x + (dx === undefined ? 8 : dx), p.y + (dy === undefined ? -8 : dy));
  }

  /** Intersection of lines ab and cd, or null when they are parallel. */
  function intersect(a, b, c, d) {
    const u = C.sub(b, a), v = C.sub(d, c);
    const den = C.cross(u, v);
    if (Math.abs(den) < 1e-9) return null;
    const t = C.cross(C.sub(c, a), v) / den;
    return C.add(a, C.scale(u, t));
  }

  function draw() {
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(200, rect.width);
    const cssH = Math.max(150, rect.height);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const scale = Math.min(cssW / (W + 2 * MARGIN), cssH / (H + 2 * MARGIN));
    const ox = (cssW - (W + 2 * MARGIN) * scale) / 2 + MARGIN * scale;
    const oy = (cssH - (H + 2 * MARGIN) * scale) / 2 + MARGIN * scale;
    view = { scale, ox, oy };
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);

    ctx.fillStyle = tokens.stage;
    ctx.fillRect(0, 0, W, H);

    const g = C.geometry(state);
    const { A, B, Cc } = { A: g.A, B: g.B, Cc: g.C };

    // The three squares, as blue outlines in the applet (here: the accent).
    for (const quad of [g.squares.AB, g.squares.BC, g.squares.CA]) {
      polygon(quad, state.fillTriangles ? null : tokens.soft, tokens.accent, 1.6);
    }

    // Flanks: pink fill in the applet; every flank has the triangle's area.
    if (state.fillTriangles) {
      polygon(g.flanks.A, tokens.soft, null);
      polygon(g.flanks.B, tokens.soft, null);
      polygon(g.flanks.C, tokens.soft, null);
    }
    polygon([A, B, Cc], tokens.board, tokens.ink, 2);

    // The outer side of each flank, drawn red when "Show lines" is on.
    if (state.showLines) {
      line(g.BA, g.CA, tokens.good, 1.4, [5, 4]);
      line(g.AB, g.CB, tokens.good, 1.4, [5, 4]);
      line(g.AC, g.BC, tokens.good, 1.4, [5, 4]);
    }

    // Medians of the flanks: the same lines are altitudes of ABC.
    if (state.medians) {
      // The applet's DrawMedian extends each flank's median to its far side.
      const triples = [
        [A, g.medians.A, B, Cc, g.BA],
        [B, g.medians.B, Cc, A, g.AB],
        [Cc, g.medians.C, A, B, g.AC],
      ];
      for (const [vertex, mid, r, s, p] of triples) {
        line(vertex, mid, tokens.good, 1.5);
        const far = intersect(r, mid, s, p);
        if (far) line(mid, far, tokens.good, 1.5);
        dot(mid, 3, tokens.good);
      }
    }

    // The slider turns a blue copy of the flank at A around that corner.
    if (g.moving) {
      polygon([A, g.movedBA, g.movedCA], null, tokens.accent, 2.5);
      if (state.medians) line(A, g.movedMid, tokens.good, 2);
      dot(g.movedBA, 4, tokens.accent);
      dot(g.movedCA, 4, tokens.accent);
      if (state.showNames) {
        label(g.movedBA, "B\u2032", tokens.text, 8, -8);
        label(g.movedCA, "C\u2032", tokens.text, 8, -8);
        if (state.medians) label(g.movedMid, "M\u2032", tokens.text, 8, -8);
      }
    }

    // The three draggable corners, with a ring on the selected one.
    [A, B, Cc].forEach((p, i) => dot(p, 5, tokens.ink, i === state.selected ? tokens.accent : null));

    if (state.showNames) {
      label(A, "A", tokens.text);
      label(B, "B", tokens.text);
      label(Cc, "C", tokens.text);
      const outer = [g.CB, g.CA, g.AC, g.AB, g.BC, g.BA];
      outer.forEach((p, i) => label(p, OUTER[i], tokens.text, 4, -8));
      if (state.medians) {
        label(g.medians.A, "M_a", tokens.good, 6, 14);
        label(g.medians.B, "M_b", tokens.good, 6, 14);
        label(g.medians.C, "M_c", tokens.good, 6, 14);
      }
    }
  }

  function render() {
    range.value = String(state.rotation);
    rangeValue.textContent = `${state.rotation}\u00b0`;
    for (const key of Object.keys(checks)) checks[key].checked = Boolean(state[key]);
    const words = message || "A triangle with a square on each side. Drag a corner or use the arrow keys to explore.";
    say(words, state.explored ? "done" : null);
    draw();
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(C.snapshot(state));
  }

  // ---- input -------------------------------------------------------------

  function act(next, words) {
    if (next === state) return;
    state = next;
    message = words;
    render();
  }

  function pointerPosition(ev) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left - view.ox) / view.scale,
      y: (ev.clientY - rect.top - view.oy) / view.scale,
    };
  }

  let drag = null;
  canvas.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    canvas.focus();
    const p = pointerPosition(ev);
    const corners = [state.A, state.B, state.C];
    let nearest = -1;
    let best = 18;
    corners.forEach((v, i) => {
      const d = C.dist(p, v);
      if (d < best) { best = d; nearest = i; }
    });
    if (nearest < 0) return;
    drag = { index: nearest };
    canvas.setPointerCapture(ev.pointerId);
  });

  canvas.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    ev.preventDefault();
    const p = pointerPosition(ev);
    act(C.move(state, { type: "vertex", index: drag.index, x: p.x, y: p.y }),
      `You moved point ${NAMES[drag.index]}, so all three squares and flanks were rebuilt around the new triangle.`);
  });

  function endDrag() { drag = null; }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("keydown", (ev) => {
    if (ev.key >= "1" && ev.key <= "3") {
      const index = Number(ev.key) - 1;
      act(C.move(state, { type: "select", index }),
        `Point ${NAMES[index]} is selected; the arrow keys will move it.`);
      ev.preventDefault();
      return;
    }
    const step = ev.shiftKey ? 12 : 4;
    const delta = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0],
      ArrowUp: [0, -step], ArrowDown: [0, step],
    }[ev.key];
    if (delta) {
      const p = [state.A, state.B, state.C][state.selected];
      act(C.move(state, {
        type: "vertex", index: state.selected,
        x: p.x + delta[0], y: p.y + delta[1],
      }), `You moved point ${NAMES[state.selected]} with the arrow keys; the squares follow it.`);
      ev.preventDefault();
    }
  });

  range.addEventListener("input", () => {
    const value = Number(range.value);
    const detail = value === 90
      ? " The blue flap has turned a quarter turn until B\u2032 lands on C, and CA now cuts triangle B C C\u2032 into two equal halves."
      : value === 0
        ? " The flap is back where it started."
        : ` The blue flap has turned ${value} degrees clockwise about A.`;
    act(C.move(state, { type: "rotation", value }), `You set the turn slider to ${value} degrees.${detail}`);
  });

  for (const key of Object.keys(checks)) {
    checks[key].addEventListener("change", () => {
      const words = {
        showNames: checks.showNames.checked ? "Names are on: the corners of the squares are labelled." : "Names are off: only the shapes remain.",
        showLines: checks.showLines.checked ? "Show lines is on: the far sides of the three flanks are drawn." : "Show lines is off: the far sides of the flanks are hidden.",
        fillTriangles: checks.fillTriangles.checked ? "Fill triangles is on: the triangle and its three flanks are shaded." : "Fill triangles is off: the shading is gone.",
        medians: checks.medians.checked ? "Show medians/altitudes is on: the green lines are medians of the flanks and altitudes of the triangle." : "Show medians/altitudes is off: those lines are hidden.",
      }[key];
      // The applet's itemStateChanged also stops the slider's rotation.
      act(C.move(state, { type: "option", key, value: checks[key].checked }), words);
    });
  }

  rightBtn.addEventListener("click", () => {
    act(C.move(state, { type: "right" }),
      "I made the angle at C a right angle. Now the square on AB has exactly the area of the two squares on AC and BC put together.");
  });

  resetBtn.addEventListener("click", () => {
    act(C.move(state, { type: "reset" }),
      "Back to the starting triangle, with the turn slider at zero and every option off.");
  });

  window.addEventListener("themechange", () => { refreshTokens(); draw(); });
  window.addEventListener("resize", () => draw());

  refreshTokens();
  state = C.start({});
  message = "";
  render();
})();
