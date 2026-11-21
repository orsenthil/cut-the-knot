"use strict";

/*
 * The page for Distance to a Line: drawing and input only; the rules are in
 * distance-to-line-core.js. One canvas shows the plane from -6 to 6 with a
 * line through two draggable points, a third draggable point P, the foot of
 * the perpendicular and the distance. Drag a point, or drag the line itself to
 * slide it. The number boxes move the points by keyboard.
 */

(function () {
  const Core = DistanceToLineCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const eqEl = document.getElementById("equation");
  const distEl = document.getElementById("distance");
  const normBox = document.getElementById("normBox");
  const levelBox = document.getElementById("levelBox");
  const digitsIn = document.getElementById("digitsIn");
  const resetBtn = document.getElementById("resetBtn");
  const fields = { p1: ["p1x", "p1y"], p2: ["p2x", "p2y"], p: ["px", "py"] };
  const W = canvas.width, H = canvas.height, L = Core.LIM, PAD = 20;
  const sx = (x) => PAD + ((x + L) / (2 * L)) * (W - 2 * PAD);
  const sy = (y) => H - PAD - ((y + L) / (2 * L)) * (H - 2 * PAD);
  const ux = (px) => ((px - PAD) / (W - 2 * PAD)) * 2 * L - L;
  const uy = (py) => ((H - PAD - py) / (H - 2 * PAD)) * 2 * L - L;

  let state = Core.start({});
  let drag = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const tok = (styles, name, fb) => styles.getPropertyValue(name).trim() || fb;

  function draw() {
    const st = getComputedStyle(document.documentElement);
    const stage = tok(st, "--stage", "#f3f5f8"), ink = tok(st, "--ink", "#1f2430"), muted = tok(st, "--muted", "#5d6472"), accent = tok(st, "--accent", "#5b4ee8"), good = tok(st, "--good", "#1a8f4d");
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = stage; ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1; ctx.strokeStyle = muted; ctx.globalAlpha = 0.35;
    for (let i = -L; i <= L; i++) {
      ctx.beginPath(); ctx.moveTo(sx(i), sy(-L)); ctx.lineTo(sx(i), sy(L)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx(-L), sy(i)); ctx.lineTo(sx(L), sy(i)); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.strokeStyle = ink; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sx(-L), sy(0)); ctx.lineTo(sx(L), sy(0)); ctx.moveTo(sx(0), sy(-L)); ctx.lineTo(sx(0), sy(L)); ctx.stroke();
    const m = Core.measure(state);
    const unit = m.norm === 0 ? 1 : 1 / m.norm; // distance between lines f = c and f = c + 1
    const along = (c, tt) => {
      // the line f = c, as two far-away points
      const dx = -m.B / m.norm, dy = m.A / m.norm;
      const bx = -(m.A * (m.C - c)) / (m.norm * m.norm), by = -(m.B * (m.C - c)) / (m.norm * m.norm);
      return [bx + dx * tt, by + dy * tt];
    };
    const seg = (c, style, w, dash) => {
      if (m.norm === 0) return;
      const a = along(c, -30), b = along(c, 30);
      ctx.save(); ctx.beginPath(); ctx.rect(PAD, PAD, W - 2 * PAD, H - 2 * PAD); ctx.clip();
      ctx.strokeStyle = style; ctx.lineWidth = w; ctx.setLineDash(dash || []);
      ctx.beginPath(); ctx.moveTo(sx(a[0]), sy(a[1])); ctx.lineTo(sx(b[0]), sy(b[1])); ctx.stroke(); ctx.restore();
    };
    if (state.levels && m.norm > 0) {
      const step = state.normalize ? 1 : 1; // f changes by `step` (a unit of f) from one level line to the next
      for (let k = -40; k <= 40; k++) if (k !== 0) seg(k * step, muted, 1, [4, 4]);
    }
    seg(0, ink, 2.5);
    // the normal from the line's midpoint
    const mid = [(state.p1[0] + state.p2[0]) / 2, (state.p1[1] + state.p2[1]) / 2];
    if (m.norm > 0) {
      const nx = (m.A / m.norm) * 1.5, ny = (m.B / m.norm) * 1.5;
      ctx.strokeStyle = accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx(mid[0]), sy(mid[1])); ctx.lineTo(sx(mid[0] + nx), sy(mid[1] + ny)); ctx.stroke();
      const ax = sx(mid[0] + nx), ay = sy(mid[1] + ny), ang = Math.atan2(-ny, nx);
      ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(ax, ay);
      ctx.lineTo(ax - 9 * Math.cos(ang - 0.4), ay - 9 * Math.sin(ang - 0.4)); ctx.lineTo(ax - 9 * Math.cos(ang + 0.4), ay - 9 * Math.sin(ang + 0.4)); ctx.fill();
    }
    // the distance
    ctx.strokeStyle = good; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(sx(state.p[0]), sy(state.p[1])); ctx.lineTo(sx(m.foot[0]), sy(m.foot[1])); ctx.stroke();
    ctx.fillStyle = good; ctx.beginPath(); ctx.arc(sx(m.foot[0]), sy(m.foot[1]), 3.5, 0, 2 * Math.PI); ctx.fill();
    const dot = (p, col, r) => { ctx.fillStyle = col; ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx(p[0]), sy(p[1]), r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); };
    dot(state.p1, stage, 7); dot(state.p2, stage, 7); dot(state.p, accent, 7);
    ctx.fillStyle = ink; ctx.font = "13px system-ui, sans-serif";
    ctx.fillText("P", sx(state.p[0]) + 10, sy(state.p[1]) - 8);
  }

  function updateFields() {
    for (const k of Object.keys(fields)) {
      const [a, b] = fields[k];
      const ea = document.getElementById(a), eb = document.getElementById(b);
      if (document.activeElement !== ea) ea.value = String(Core.cut(state[k][0], 2));
      if (document.activeElement !== eb) eb.value = String(Core.cut(state[k][1], 2));
    }
  }

  function render() {
    draw();
    const m = Core.measure(state);
    eqEl.textContent = Core.equationText(state);
    distEl.textContent = `dist(P, L) = |${Core.cut(m.A, state.digits)}·${Core.cut(state.p[0], state.digits)} + ${Core.cut(m.B, state.digits)}·${Core.cut(state.p[1], state.digits)} + ${Core.cut(m.C, state.digits)}| / ${Core.cut(m.norm, state.digits)} = ${Core.cut(m.dist, state.digits)}`;
    normBox.checked = state.normalize; levelBox.checked = state.levels; digitsIn.value = String(state.digits);
    updateFields();
    if (window.Track) window.Track.state(state);
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next; render();
    if (note !== undefined) say(note, Core.result(state));
    return true;
  }

  const pos = (e) => { const r = canvas.getBoundingClientRect(); return [ux(((e.clientX - r.left) * W) / r.width), uy(((e.clientY - r.top) * H) / r.height)]; };
  const pickRadius = () => (14 * 2 * Core.LIM * W) / ((W - 2 * PAD) * canvas.getBoundingClientRect().width) ;

  canvas.addEventListener("pointerdown", (e) => {
    const q = pos(e), r = pickRadius();
    const near = (p) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= r;
    let what = null;
    if (near(state.p)) what = "p"; else if (near(state.p1)) what = "p1"; else if (near(state.p2)) what = "p2";
    else { const m = Core.measure(state); if (m.norm > 0 && Math.abs(m.A * q[0] + m.B * q[1] + m.C) / m.norm <= r) what = "line"; }
    if (!what) return;
    drag = { what, last: q };
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const q = pos(e);
    if (drag.what === "line") { apply({ type: "shift", dx: q[0] - drag.last[0], dy: q[1] - drag.last[1] }); drag.last = q; }
    else apply({ type: drag.what, x: q[0], y: q[1] });
    say(`Distance ${Core.cut(Core.measure(state).dist, state.digits)}.`, Core.result(state));
  });
  const end = () => { drag = null; };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  for (const k of Object.keys(fields)) {
    for (const [i, id] of fields[k].entries()) {
      document.getElementById(id).addEventListener("change", (e) => {
        const v = Number(e.target.value);
        const cur = state[k].slice();
        if (!Number.isFinite(v)) { say("Type a number from −6 to 6."); updateFields(); return; }
        cur[i] = v;
        if (!apply({ type: k, x: cur[0], y: cur[1] }, `Moved ${k === "p" ? "P" : "a point of the line"}.`)) say("The two points of the line must be different.");
        updateFields();
      });
    }
  }
  normBox.addEventListener("change", () => apply({ type: "normalize", value: normBox.checked }, normBox.checked ? "The equation is normalized: A² + B² = 1, so the distance is just |Au + Bv + C|." : "The equation is as the two points give it."));
  levelBox.addEventListener("change", () => apply({ type: "levels", value: levelBox.checked }, levelBox.checked ? "The dashed lines are level lines: f is the same along each one." : "Level lines hidden."));
  digitsIn.addEventListener("change", () => { if (!apply({ type: "digits", value: Number(digitsIn.value) }, "Rounded to " + digitsIn.value + " digits.")) { say("Digits run from 0 to 6."); digitsIn.value = String(state.digits); } });
  resetBtn.addEventListener("click", () => { state = Core.move(state, { type: "reset" }); render(); say("Back to the start."); });
  window.addEventListener("themechange", render);

  render();
})();
