"use strict";

/*
 * Page layer for the Emergence of Chaos demo. All the mathematics lives in
 * ChaosCore (chaos-core.js); this file only draws and takes input.
 *
 * The canvas has two panels. On the left we draw y = f(x) = 4 a x(1-x) and
 * the diagonal y = x, then trace the cobweb: up to the graph, across to the
 * diagonal, again and again. On the right we draw the applet's bifurcation
 * diagram — one column per value of a, made from the iterates left over
 * after its warm-up. Clicking the right panel chooses a (the slider does too)
 * and starts a fresh web; clicking the left panel pauses it, as in the applet.
 */

(() => {
  const Core = ChaosCore;
  const canvas = document.getElementById("chaosCanvas");
  const ctx = canvas.getContext("2d");
  const lambdaInput = document.getElementById("lambda");
  const lambdaVal = document.getElementById("lambdaVal");
  const newBtn = document.getElementById("newBtn");
  const playBtn = document.getElementById("playBtn");
  const stepBtn = document.getElementById("stepBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MAX_STEPS = 60; // a short, redrawable trail instead of the applet's XOR pen
  const TOP = 8;
  const BOTTOM = 8;
  const GAP = 12;

  let tokens = {};
  let state = Core.start({});
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let columns = null; // the cached right-hand diagram
  let timer = null;

  function refreshTokens() {
    const cs = getComputedStyle(document.documentElement);
    tokens = {
      stage: cs.getPropertyValue("--stage").trim(),
      ink: cs.getPropertyValue("--ink").trim(),
      accent: cs.getPropertyValue("--accent").trim(),
      text: cs.getPropertyValue("--text").trim(),
      muted: cs.getPropertyValue("--muted").trim(),
      border: cs.getPropertyValue("--border").trim(),
      highlight: cs.getPropertyValue("--highlight").trim(),
    };
  }
  refreshTokens();
  window.addEventListener("themechange", () => {
    refreshTokens();
    draw();
  });

  /** Shows a line under the game. "done" is how a demo tells the record it
   *  has been explored; the sentence says in words what just changed. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function setLambda(L) {
    state = Core.move(state, { type: "setLambda", lambda: L, x0: Math.random() });
    if (reducedMotion) {
      for (let i = 0; i < 24; i++) state = Core.move(state, { type: "step" });
    }
    lambdaInput.value = String(state.lambda);
    say(`a = ${state.lambda.toFixed(3)}: ${Core.behavior(state.lambda)}.`, "done");
    render();
  }

  function pause(why) {
    state = Core.move(state, { type: "pause" });
    say(why, "done");
    render();
  }

  function sizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    cssW = Math.max(1, Math.round(rect.width));
    cssH = Math.max(1, Math.round(rect.height));
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function panels() {
    const leftW = Math.round(cssW * 0.46);
    const rightX = leftW + GAP;
    const rightW = Math.max(1, cssW - rightX);
    const H = Math.max(1, cssH - TOP - BOTTOM);
    return { leftW, rightX, rightW, H };
  }

  /** The right panel is the same for every visit: one column per a. */
  function buildColumns(rightW, H) {
    const out = [];
    for (let j = 0; j < rightW; j++) {
      const L = Core.FIRST_LAMBDA + (j * Core.C_WIDTH) / rightW;
      out.push({ j, ys: Core.bifurcationColumn(L, Core.DEFAULT_X0, H) });
    }
    return out;
  }

  function strokeRect(x, y, w, h) {
    ctx.strokeStyle = tokens.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  }

  function drawDiagram(p) {
    ctx.fillStyle = tokens.stage;
    ctx.fillRect(p.rightX, TOP, p.rightW, p.H);
    strokeRect(p.rightX, TOP, p.rightW, p.H);

    if (!columns || columns.length !== p.rightW || columns.H !== p.H) {
      columns = buildColumns(p.rightW, p.H);
      columns.H = p.H;
    }
    ctx.fillStyle = tokens.ink;
    ctx.globalAlpha = 0.7;
    for (const col of columns) {
      const px = p.rightX + col.j;
      for (const y of col.ys) {
        const py = TOP + p.H - Math.round(y * p.H);
        ctx.fillRect(px, py, 1, 1);
      }
    }
    ctx.globalAlpha = 1;

    // The chosen parameter, and its value written out, not just a tint.
    const mx = p.rightX + ((state.lambda - Core.FIRST_LAMBDA) / Core.C_WIDTH) * p.rightW;
    ctx.strokeStyle = tokens.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx, TOP);
    ctx.lineTo(mx, TOP + p.H);
    ctx.stroke();
    ctx.fillStyle = tokens.text;
    ctx.font = "600 12px " + getComputedStyle(document.documentElement).fontFamily;
    ctx.textAlign = mx > p.rightX + p.rightW * 0.6 ? "right" : "left";
    ctx.fillText(`a = ${state.lambda.toFixed(3)}`, mx + (ctx.textAlign === "right" ? -4 : 4), TOP + 14);
    ctx.textAlign = "left";
  }

  function drawCobweb(p) {
    const px = (x) => x * p.leftW;
    const py = (y) => TOP + p.H - y * p.H;
    ctx.fillStyle = tokens.stage;
    ctx.fillRect(0, TOP, p.leftW, p.H);
    strokeRect(0, TOP, p.leftW, p.H);

    // Axes, the diagonal y = x, and the graph y = f(x).
    ctx.strokeStyle = tokens.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, py(0));
    ctx.lineTo(p.leftW, py(0));
    ctx.moveTo(0, TOP);
    ctx.lineTo(0, TOP + p.H);
    ctx.stroke();
    ctx.strokeStyle = tokens.ink;
    ctx.beginPath();
    ctx.moveTo(px(0), py(0));
    ctx.lineTo(px(1), py(1));
    ctx.stroke();
    ctx.strokeStyle = tokens.accent;
    ctx.beginPath();
    for (let i = 0; i <= p.leftW; i++) {
      const x = i / p.leftW;
      const y = Core.F(state.lambda, x);
      if (i === 0) ctx.moveTo(px(x), py(y));
      else ctx.lineTo(px(x), py(y));
    }
    ctx.stroke();

    // The web: up from x_i on the diagonal to f(x_i), then across to the
    // diagonal again. This is the iteration x_{i+1} = 4 a x_i (1 - x_i).
    const n = Math.min(state.steps, MAX_STEPS);
    const orbit = Core.orbit(state.lambda, state.x0, n);
    ctx.strokeStyle = tokens.accent;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.25;
    for (let i = 0; i < orbit.length - 1; i++) {
      const x = orbit[i];
      const xn = orbit[i + 1];
      ctx.beginPath();
      ctx.moveTo(px(x), py(x));
      ctx.lineTo(px(x), py(xn));
      ctx.lineTo(px(xn), py(xn));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (orbit.length) {
      const last = orbit[orbit.length - 1];
      ctx.fillStyle = tokens.highlight;
      ctx.strokeStyle = tokens.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px(last), py(last), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function draw() {
    sizeCanvas();
    const p = panels();
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = tokens.stage;
    ctx.fillRect(0, 0, cssW, cssH);
    drawCobweb(p);
    drawDiagram(p);
  }

  function render() {
    lambdaVal.textContent = state.lambda.toFixed(3);
    if (Number(lambdaInput.value) !== state.lambda) lambdaInput.value = String(state.lambda);
    playBtn.textContent = state.running ? "Pause web" : "Play web";
    playBtn.setAttribute("aria-label", state.running ? "Pause the cobweb animation" : "Play the cobweb animation");
    draw();
    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        lambda: state.lambda,
        x0: state.x0,
        running: state.running,
        steps: state.steps,
        behavior: Core.behavior(state.lambda),
      });
    }
    schedule();
  }

  function schedule() {
    if (timer !== null || !state.running || reducedMotion) return;
    timer = setTimeout(() => {
      timer = null;
      if (!state.running) return;
      if (state.steps >= MAX_STEPS) {
        state = Core.move(state, { type: "restart", x0: Math.random() });
      } else {
        state = Core.move(state, { type: "step" });
      }
      render();
    }, 45);
  }

  function canvasPoint(e) {
    // Map the pointer through the device-pixel size, then back to CSS pixels
    // (the context has been scaled by dpr), so a shrunken canvas still works.
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    return {
      x: ((e.clientX - rect.left) * scale) / dpr,
      y: ((e.clientY - rect.top) * scale) / dpr,
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    const pt = canvasPoint(e);
    const p = panels();
    if (pt.x >= p.rightX && pt.x <= p.rightX + p.rightW && pt.y >= TOP && pt.y <= TOP + p.H) {
      setLambda(Core.lambdaFromClick(pt.x, p.leftW, GAP, p.rightW));
    } else {
      pause("Web paused — the picture on the left is the same iteration drawn as a web.");
    }
    canvas.focus();
  });

  lambdaInput.addEventListener("input", () => setLambda(Number(lambdaInput.value)));

  newBtn.addEventListener("click", () => {
    state = Core.move(state, { type: "restart", x0: Math.random() });
    if (reducedMotion) for (let i = 0; i < 24; i++) state = Core.move(state, { type: "step" });
    say(`New starting point x = ${state.x0.toFixed(3)}: ${Core.behavior(state.lambda)}.`, "done");
    render();
  });

  playBtn.addEventListener("click", () => {
    state = Core.move(state, { type: "toggle" });
    say(state.running ? "The web is moving again: each step follows the graph to the diagonal." : "Web paused — the steps stop where they are.", "done");
    render();
  });

  stepBtn.addEventListener("click", () => {
    state = Core.move(state, { type: "step" });
    say(`One more step: the dot is now at ${state.steps} ${state.steps === 1 ? "step" : "steps"}.`, "done");
    render();
  });

  resetBtn.addEventListener("click", () => {
    state = Core.start({});
    say("Back to a = 0.700: the dot settles down on one resting spot.", "done");
    render();
  });

  // Keyboard-only play. Home/End and the arrow keys move a; Space starts or
  // pauses the web; Enter and R choose a fresh starting point.
  canvas.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 0.02 : 0.005;
    let L = null;
    if (e.key === "ArrowLeft") L = state.lambda - step;
    else if (e.key === "ArrowRight") L = state.lambda + step;
    else if (e.key === "Home") L = Core.FIRST_LAMBDA;
    else if (e.key === "End") L = 1;
    else if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      state = Core.move(state, { type: "toggle" });
      say(state.running ? "The web is moving again." : "Web paused.", "done");
      render();
      return;
    } else if (e.key === "Enter" || e.key.toLowerCase() === "r") {
      e.preventDefault();
      state = Core.move(state, { type: "restart", x0: Math.random() });
      say(`New starting point x = ${state.x0.toFixed(3)}: ${Core.behavior(state.lambda)}.`, "done");
      render();
      return;
    }
    if (L !== null) {
      e.preventDefault();
      setLambda(L);
    }
  });

  const resize = () => {
    columns = null;
    draw();
  };
  window.addEventListener("resize", resize);

  lambdaVal.textContent = state.lambda.toFixed(3);
  say("Choose a value of a on the right picture, or press 'New starting point' to watch the web.");
  render();
})();
