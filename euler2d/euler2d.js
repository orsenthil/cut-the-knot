"use strict";

/*
 * UI/rendering layer for the Euler2D demo. All the physics lives in
 * Euler2DCore (euler2d-core.js); this file just owns the canvas, the
 * controls, and a small ring buffer of recent steps used to draw trails.
 *
 * Trails: the original C program erased each segment exactly `tail_len`
 * frames after drawing it, producing a constant-length "worm". Canvas makes
 * it cheap to redraw everything every frame, so instead each trail segment
 * fades out over its lifetime -- same idea, smoother look.
 */
(() => {
  const canvas = document.getElementById("flowCanvas");
  const ctx = canvas.getContext("2d");
  const canvasBox = document.getElementById("canvasBox");

  const particlesInput = document.getElementById("particlesInput");
  const particlesVal = document.getElementById("particlesVal");
  const trailInput = document.getElementById("trailInput");
  const trailVal = document.getElementById("trailVal");
  const cyclesInput = document.getElementById("cyclesInput");
  const cyclesVal = document.getElementById("cyclesVal");
  const speedInput = document.getElementById("speedInput");
  const speedVal = document.getElementById("speedVal");
  const powerInput = document.getElementById("powerInput");
  const vortexInput = document.getElementById("vortexInput");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const newFlowBtn = document.getElementById("newFlowBtn");
  const liveStatus = document.getElementById("liveStatus");
  const pausedNotice = document.getElementById("pausedNotice");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let tokens = {};
  function refreshTokens() {
    const cs = getComputedStyle(document.documentElement);
    tokens = {
      stage: cs.getPropertyValue("--stage").trim(),
      ink: cs.getPropertyValue("--ink").trim(),
      accent: cs.getPropertyValue("--accent").trim(),
      muted: cs.getPropertyValue("--muted").trim(),
    };
  }
  refreshTokens();
  window.addEventListener("themechange", refreshTokens);

  let sp = null;
  let trail = []; // ring buffer of { particles, vortices, age }
  let running = !reducedMotion;
  let flowNumber = 0;
  let cssWidth = 0;
  let cssHeight = 0;

  function currentOpts() {
    return {
      particles: Number(particlesInput.value),
      cycles: Number(cyclesInput.value),
      power: Number(powerInput.value),
    };
  }

  function sizeCanvas() {
    const rect = canvasBox.getBoundingClientRect();
    cssWidth = Math.max(200, Math.round(rect.width));
    cssHeight = Math.max(140, Math.round(rect.height));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function newFlow() {
    sizeCanvas();
    sp = Euler2DCore.create(cssWidth, cssHeight, currentOpts());
    trail = [];
    flowNumber++;
    updateStatus(0, 0);
  }

  function updateStatus(aliveParticles, totalParticles) {
    liveStatus.textContent = `Flow #${flowNumber} — step ${sp.count} of ${sp.cycles} — ${aliveParticles} of ${totalParticles} tracer points still moving`;
  }

  function drawBoundary() {
    const b = Euler2DCore.getBoundary(sp);
    ctx.strokeStyle = tokens.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (b.kind === "circle") {
      ctx.arc(b.cx, b.cy, Math.max(0, b.r), 0, Math.PI * 2);
    } else {
      const pts = b.points;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    }
    ctx.stroke();
  }

  function draw(showVortex) {
    ctx.fillStyle = tokens.stage;
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    drawBoundary();

    const n = trail.length;
    for (let f = 0; f < n; f++) {
      const frame = trail[f];
      const alpha = 0.15 + 0.85 * ((f + 1) / n);
      ctx.lineWidth = 1.4;
      for (const seg of frame.particles) {
        const hue = ((seg.index - sp.Nvortex) / Math.max(1, sp.N - sp.Nvortex)) * 320;
        ctx.strokeStyle = `hsla(${hue}, 70%, 50%, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
      }
      if (showVortex) {
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = withAlpha(tokens.accent, alpha);
        for (const seg of frame.vortices) {
          ctx.beginPath();
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
          ctx.stroke();
        }
      }
    }
  }

  // tokens.accent is a hex/rgb CSS color; blend in an alpha channel cheaply
  // by drawing through a temporary rgba() rather than parsing the color.
  function withAlpha(color, alpha) {
    return color.startsWith("#") ? hexToRgba(color, alpha) : color;
  }
  function hexToRgba(hex, alpha) {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function tick() {
    const speed = Number(speedInput.value);
    const maxTrail = Number(trailInput.value);
    let result = null;
    for (let s = 0; s < speed; s++) {
      result = Euler2DCore.step(sp);
      trail.push(result);
      if (trail.length > maxTrail) trail.shift();
      if (result.finished) {
        Euler2DCore.randomize(sp);
        trail = [];
        flowNumber++;
      }
    }
    draw(vortexInput.checked);
    if (result) updateStatus(result.aliveParticles, sp.N - sp.Nvortex);
  }

  let rafId = null;
  function loop() {
    if (!running) return;
    tick();
    rafId = requestAnimationFrame(loop);
  }

  function play() {
    if (running) return;
    running = true;
    playPauseBtn.textContent = "Pause";
    pausedNotice.hidden = true;
    rafId = requestAnimationFrame(loop);
  }
  function pause() {
    running = false;
    playPauseBtn.textContent = "Play";
    pausedNotice.hidden = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  playPauseBtn.addEventListener("click", () => (running ? pause() : play()));
  newFlowBtn.addEventListener("click", () => {
    newFlow();
    draw(vortexInput.checked);
  });

  particlesInput.addEventListener("input", () => {
    particlesVal.textContent = particlesInput.value;
  });
  particlesInput.addEventListener("change", () => {
    newFlow();
    draw(vortexInput.checked);
  });

  trailInput.addEventListener("input", () => {
    trailVal.textContent = trailInput.value;
    const maxTrail = Number(trailInput.value);
    if (trail.length > maxTrail) trail = trail.slice(trail.length - maxTrail);
  });

  cyclesInput.addEventListener("input", () => {
    cyclesVal.textContent = `${cyclesInput.value} steps`;
    if (sp) sp.cycles = Number(cyclesInput.value);
  });

  speedInput.addEventListener("input", () => {
    speedVal.textContent = `${speedInput.value}×`;
  });

  powerInput.addEventListener("change", () => {
    newFlow();
    draw(vortexInput.checked);
  });

  vortexInput.addEventListener("change", () => {
    if (!running) draw(vortexInput.checked);
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      newFlow();
      draw(vortexInput.checked);
    }, 200);
  });

  newFlow();
  draw(vortexInput.checked);
  if (reducedMotion) {
    pausedNotice.hidden = false;
    playPauseBtn.textContent = "Play";
  } else {
    play();
  }
})();
