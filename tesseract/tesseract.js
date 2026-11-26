"use strict";

/*
 * The page for The Tesseract: drawing and input only; the geometry is in
 * tesseract-core.js. Two canvases. The first shows the construction (Start,
 * then Continue: a point, a segment, a square, a cube, the tesseract, each
 * swept out along a new axis) and then the tesseract itself, turned with six
 * sliders or by dragging (Shift or Ctrl changes the planes), with the
 * hyperplane section if wanted. The second is the reper puzzle: the fixed
 * reper (grey) and the moving one (coloured) on the tesseract, eight buttons
 * naming the squares the moving reper can glide to, and Back / Repeat /
 * Reset.
 */

(function () {
  const Core = TesseractCore;
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  /* ------------------------------------------------------- part one */
  const cv = document.getElementById("view");
  const ctx = cv.getContext("2d");
  const goBtn = document.getElementById("goBtn");
  const skipBtn = document.getElementById("skipBtn");
  const playEl = document.getElementById("play");
  const sliders = [...document.querySelectorAll("#sliders input")];
  const labels = [...document.querySelectorAll("#sliders .name")];
  const outs = [...document.querySelectorAll("#sliders output")];
  const cubeBox = document.getElementById("cubeBox");
  const sectionBox = document.getElementById("sectionBox");
  const fixBox = document.getElementById("fixBox");
  const stepEl = document.getElementById("stepText");
  const statusEl = document.getElementById("status");

  const KEYS = ["xy", "yz", "xz", "xh", "yh", "zh"];
  const PKEYS = ["A", "B", "C", "D", "E"];
  let angles = { ...Core.ANGLES };
  let plane = { ...Core.PLANE };
  let step = -1, frame = 0, anim = null, playing = false;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const project = (M, p, W, H, s) => { const q = Core.turn(M, p, fixBox.checked); return [W / 2 + s * q[0], H / 2 - s * q[1], q[2], q[3]]; };

  function drawWire(c, pts, edges, M, opts = {}) {
    const W = c.canvas.width, H = c.canvas.height, s = opts.scale || 150;
    const P = pts.map((p) => project(M, p, W, H, s));
    for (const [i, j, d] of edges) {
      const both = pts[i][3] === pts[j][3];
      let col = css("--muted");
      if (opts.colour && d !== 3) col = pts[i][3] < 0.5 ? css("--accent") : css("--ink");
      c.strokeStyle = col; c.lineWidth = opts.colour && both ? 2.2 : 1.4;
      c.beginPath(); c.moveTo(P[i][0], P[i][1]); c.lineTo(P[j][0], P[j][1]); c.stroke();
    }
    c.fillStyle = css("--ink");
    for (const p of P) { c.beginPath(); c.arc(p[0], p[1], 2.8, 0, 2 * Math.PI); c.fill(); }
    return P;
  }

  function draw() {
    const W = cv.width, H = cv.height;
    ctx.fillStyle = css("--surface"); ctx.fillRect(0, 0, W, H);
    if (step < 0) {
      ctx.fillStyle = css("--muted"); ctx.font = `600 22px ${css("--font")}`; ctx.textAlign = "center";
      ctx.fillText("Press Start to build a tesseract", W / 2, H / 2);
      return;
    }
    const M = Core.rotation(angles);
    if (!playing) {
      const t = anim !== null ? Math.min(1, frame / Core.ANIM_STEPS) : 1;
      const { pts, edges } = Core.construction(step, t);
      drawWire(ctx, pts, edges, M, { scale: 150 });
      return;
    }
    const P = drawWire(ctx, Core.VERTS, Core.EDGES, M, { colour: cubeBox.checked, scale: 150 });
    if (cubeBox.checked) {
      ctx.fillStyle = css("--text"); ctx.font = `700 15px ${css("--font")}`; ctx.textAlign = "left";
      [["O", 0], ["X", 1], ["Y", 2], ["Z", 4], ["H", 8]].forEach(([n, i]) => ctx.fillText(n, P[i][0] + 6, P[i][1] - 6));
    }
    if (sectionBox.checked) {
      const sec = Core.section(plane);
      ctx.strokeStyle = css("--good"); ctx.lineWidth = 3;
      for (const [p, q] of sec.segments) {
        const a = project(M, p, W, H, 150), b = project(M, q, W, H, 150);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }
  }

  function moveMode() { return document.querySelector('input[name="move"]:checked').value; }
  function syncSliders() {
    const hyper = moveMode() === "plane";
    sliders.forEach((s, i) => {
      const row = s.closest(".row");
      if (hyper) {
        row.hidden = i > 4;
        if (i <= 4) { s.min = "-2"; s.max = "2"; s.step = "0.01"; s.value = String(plane[PKEYS[i]]); labels[i].textContent = PKEYS[i]; outs[i].textContent = plane[PKEYS[i]].toFixed(2); }
      } else {
        row.hidden = false;
        s.min = "-180"; s.max = "180"; s.step = "1"; s.value = String(angles[KEYS[i]]); labels[i].textContent = KEYS[i].toUpperCase(); outs[i].textContent = `${Math.round(angles[KEYS[i]])}°`;
      }
      s.setAttribute("aria-label", hyper ? `Hyperplane coefficient ${PKEYS[i] || ""}` : `Rotation in the ${KEYS[i].toUpperCase()} plane`);
    });
  }
  sliders.forEach((s, i) => s.addEventListener("input", () => {
    if (moveMode() === "plane") { plane = { ...plane, [PKEYS[i]]: Number(s.value) }; outs[i].textContent = Number(s.value).toFixed(2); sectionBox.checked = true; }
    else { angles = { ...angles, [KEYS[i]]: Number(s.value) }; outs[i].textContent = `${s.value}°`; }
    draw(); track();
  }));
  document.querySelectorAll('input[name="move"]').forEach((r) => r.addEventListener("change", () => { if (moveMode() === "plane") sectionBox.checked = true; syncSliders(); draw(); }));
  [cubeBox, sectionBox, fixBox].forEach((b) => b.addEventListener("change", draw));

  function play() {
    playing = true;
    playEl.hidden = false;
    goBtn.hidden = true; skipBtn.hidden = true;
    stepText(`The tesseract: ${Core.faceCounts(4).slice(0, 4).join(", ")} vertices, edges, squares and cubes. Drag it, or use the sliders.`);
    syncSliders(); draw(); track();
  }
  function stepText(t) { stepEl.textContent = t; }
  goBtn.addEventListener("click", () => {
    if (anim !== null) return;
    step++;
    goBtn.textContent = "Continue";
    goBtn.disabled = true;
    frame = 0;
    const n = 1 << step;
    stepText(step === 0 ? "A point: 0 dimensions, 1 vertex." : `Moving ${Core.STEP_NAMES[step - 1]} along a new direction, ${Core.AXES[step - 1]}, sweeps out ${Core.STEP_NAMES[step]}: ${n} vertices.`);
    anim = setInterval(() => {
      frame++;
      draw();
      if (frame >= Core.ANIM_STEPS || step === 0) {
        clearInterval(anim); anim = null; goBtn.disabled = false; goBtn.focus();
        if (step >= 4) play();
      }
    }, 60);
    draw();
  });
  skipBtn.addEventListener("click", () => { if (anim !== null) { clearInterval(anim); anim = null; } step = 4; play(); });

  let drag = null;
  cv.addEventListener("pointerdown", (e) => { if (!playing) return; drag = { x: e.clientX, y: e.clientY, mode: e.shiftKey ? 1 : e.ctrlKey ? 2 : 0 }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    const [kx, ky] = [["xz", "yz"], ["xh", "yh"], ["zh", "xy"]][drag.mode];
    const wrap = (v) => ((v + 540) % 360) - 180;
    angles = { ...angles, [kx]: wrap(angles[kx] + dx * 0.6), [ky]: wrap(angles[ky] + dy * 0.6) };
    if (moveMode() === "cube") syncSliders();
    draw();
  });
  cv.addEventListener("pointerup", () => { drag = null; track(); });

  /* ------------------------------------------------------- part two */
  const pv = document.getElementById("puzzle");
  const pctx = pv.getContext("2d");
  const destEl = document.getElementById("dest");
  const hereEl = document.getElementById("here");
  const pathBox = document.getElementById("pathBox");
  let pz = Core.startPuzzle();
  const past = [];
  const PANG = { xy: 25, yz: 115, xz: 40, xh: 20, yh: 30, zh: 35 };

  function drawPuzzle() {
    const W = pv.width, H = pv.height, M = Core.rotation(PANG);
    pctx.fillStyle = css("--surface"); pctx.fillRect(0, 0, W, H);
    const P = drawWire(pctx, Core.VERTS, Core.EDGES, M, { scale: 140 });
    const idx = (v) => v[0] + 2 * v[1] + 4 * v[2] + 8 * v[3];
    const fill = (k, col, alpha) => {
      const cs = Core.corners(Core.SQUARES[k]).map((v) => P[idx(v)]);
      pctx.globalAlpha = alpha; pctx.fillStyle = col;
      pctx.beginPath(); cs.forEach((p, i) => (i ? pctx.lineTo(p[0], p[1]) : pctx.moveTo(p[0], p[1]))); pctx.closePath(); pctx.fill();
      pctx.globalAlpha = 1;
    };
    if (pathBox.checked) for (const k of pz.history) fill(k, css("--highlight"), 1);
    fill(pz.fixed, css("--muted"), 0.35);
    fill(pz.moving, css("--accent"), 0.35);
    const arrows = (k, reper, col, off) => {
      const sq = Core.SQUARES[k];
      const c = [0, 0, 0, 0]; for (const a in sq.fixed) c[a] = sq.fixed[a]; for (const a of sq.free) c[a] = 0.5 + off;
      const o = project(M, c, W, H, 140);
      reper.forEach(([axis, sign], n) => {
        const e = c.slice(); e[axis] += 0.32 * sign;
        const p = project(M, e, W, H, 140);
        pctx.strokeStyle = col; pctx.fillStyle = col; pctx.lineWidth = n ? 3 : 4.5;
        pctx.beginPath(); pctx.moveTo(o[0], o[1]); pctx.lineTo(p[0], p[1]); pctx.stroke();
        const a = Math.atan2(p[1] - o[1], p[0] - o[0]);
        pctx.beginPath(); pctx.moveTo(p[0], p[1]);
        pctx.lineTo(p[0] - 10 * Math.cos(a - 0.4), p[1] - 10 * Math.sin(a - 0.4));
        pctx.lineTo(p[0] - 10 * Math.cos(a + 0.4), p[1] - 10 * Math.sin(a + 0.4));
        pctx.closePath(); pctx.fill();
      });
    };
    arrows(pz.fixed, pz.fixedReper, css("--ink"), -0.12);
    arrows(pz.moving, pz.reper, css("--accent"), pz.moving === pz.fixed ? 0.12 : 0);
  }

  function renderPuzzle() {
    destEl.textContent = "";
    for (const n of Core.neighbours(pz.moving)) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = Core.SQUARES[n.to].name; b.dataset.name = Core.SQUARES[n.to].name;
      b.setAttribute("aria-label", `Glide the moving reper to square ${Core.SQUARES[n.to].name}`);
      destEl.appendChild(b);
    }
    hereEl.textContent = `Fixed reper on ${Core.SQUARES[pz.fixed].name}; moving reper on ${Core.SQUARES[pz.moving].name} (thick arrow ${pz.reper[0][1] > 0 ? "+" : "−"}${pz.reper[0][0] === 3 ? "h" : Core.AXES[pz.reper[0][0]]}). Moves: ${pz.history.length}.`;
    document.getElementById("backBtn").disabled = !past.length;
    drawPuzzle();
    const o = Core.orientation(pz);
    if (o === -1) say(`Back on ${Core.SQUARES[pz.fixed].name} in ${pz.history.length} moves, and the two repers have opposite orientations!`, "win");
    else if (o === 1 && pz.history.length) say(`Back on ${Core.SQUARES[pz.fixed].name}, but the repers still agree. Try another route.`);
    else say(`Bring the coloured reper back to square ${Core.SQUARES[pz.fixed].name} turned over.`);
    track();
  }
  destEl.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    past.push(pz);
    pz = Core.glideTo(pz, b.dataset.name);
    renderPuzzle();
    const f = destEl.querySelector("button"); if (f) f.focus();
  });
  document.getElementById("backBtn").addEventListener("click", () => { if (past.length) { pz = past.pop(); renderPuzzle(); } });
  document.getElementById("repeatBtn").addEventListener("click", () => { past.length = 0; pz = Core.repeat(pz); renderPuzzle(); });
  document.getElementById("resetBtn").addEventListener("click", () => { past.length = 0; pz = Core.startPuzzle(); renderPuzzle(); });
  pathBox.addEventListener("change", drawPuzzle);

  function track() {
    if (window.Track) window.Track.state({ angles, plane, built: playing, fixed: Core.SQUARES[pz.fixed].name, moving: Core.SQUARES[pz.moving].name, reper: pz.reper, fixedReper: pz.fixedReper, path: pz.history.map((k) => Core.SQUARES[k].name) });
  }
  window.addEventListener("themechange", () => { draw(); drawPuzzle(); });

  draw();
  renderPuzzle();
})();
