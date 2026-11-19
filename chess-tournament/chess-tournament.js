"use strict";

/*
 * Chess Tournament page: drawing and input only; all the maths lives in
 * chess-tournament-core.js. The stage holds the applet's 3x3 table of win
 * chances (rows A, B, C; columns AB, BC, AC) and a small bar chart of B's
 * three chances, with the chosen starting pair picked out in the accent
 * colour. Three sliders set p, q and r over the applet's 0.50-1.00 range,
 * four buttons choose a starting pair or reset, and the arrow keys walk the
 * chart while it keeps focus.
 *
 * Colours come from the CSS custom properties at draw time, so a theme flip
 * redraws the chart; the table itself is plain HTML and follows the theme on
 * its own. A sentence under the game always says in words how B's chances
 * changed. This is a demo, so finishing an exploration marks it "done".
 */

(function () {
  const Core = ChessTournamentCore;
  const stageEl = document.getElementById("stage");
  const statusEl = document.getElementById("status");
  const chart = document.getElementById("chart");
  const ctx = chart.getContext("2d");
  const table = document.getElementById("chances");
  const sliders = {
    p: document.getElementById("pSlider"),
    q: document.getElementById("qSlider"),
    r: document.getElementById("rSlider"),
  };
  const readouts = {
    p: document.getElementById("pValue"),
    q: document.getElementById("qValue"),
    r: document.getElementById("rValue"),
  };
  const newBtn = document.getElementById("newBtn");
  const pairBtns = {
    AB: document.getElementById("abBtn"),
    BC: document.getElementById("bcBtn"),
    AC: document.getElementById("acBtn"),
  };

  let state = Core.start({});

  /** Resolve one of the shared CSS colour tokens at draw time. */
  function token(name) {
    return getComputedStyle(stageEl).getPropertyValue(name).trim();
  }

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are also how the player's record learns that a play
   * has ended (assets/progress.js), so use them for that and nothing else.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** The layout of the three bars, in device pixels. */
  function geometry() {
    const dpr = window.devicePixelRatio || 1;
    const padL = 34 * dpr;
    const padR = 12 * dpr;
    const padT = 22 * dpr;
    const padB = 32 * dpr;
    const left = padL;
    const right = Math.max(left + 1, chart.width - padR);
    const top = padT;
    const bottom = Math.max(top + 1, chart.height - padB);
    return { dpr, left, right, top, bottom, barW: (right - left) / 3 };
  }

  /** Draw B's three chances as bars, reading the theme's tokens afresh. */
  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const rect = chart.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (chart.width !== w || chart.height !== h) {
      chart.width = w;
      chart.height = h;
    }

    const stage = token("--stage");
    const muted = token("--muted");
    const accent = token("--accent");
    const border = token("--border-strong");
    const g = geometry();

    ctx.fillStyle = stage;
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.strokeStyle = border;
    ctx.lineWidth = g.dpr;
    ctx.beginPath();
    ctx.moveTo(g.left, g.bottom + 0.5);
    ctx.lineTo(g.right, g.bottom + 0.5);
    ctx.stroke();

    const t = Core.computeTable(state.p, state.q, state.r);
    const names = ["A vs B", "B vs C", "A vs C"];
    const bw = Math.max(1, g.barW * 0.6);
    for (let i = 0; i < 3; i++) {
      const pair = Core.PAIRS[i];
      const value = t[pair].B;
      const x = g.left + (i + 0.5) * g.barW - bw / 2;
      const barH = Math.max(1, value * (g.bottom - g.top));
      ctx.fillStyle = state.pair === pair ? accent : muted;
      ctx.globalAlpha = state.pair === pair ? 1 : 0.55;
      ctx.fillRect(x, g.bottom - barH, bw, barH);
      ctx.globalAlpha = 1;

      ctx.textAlign = "center";
      ctx.fillStyle = state.pair === pair ? accent : muted;
      ctx.font = `${11 * dpr}px system-ui, sans-serif`;
      ctx.fillText(Core.formatProb(value), x + bw / 2, g.bottom - barH - 5 * dpr);
      ctx.fillStyle = muted;
      ctx.fillText(names[i], g.left + (i + 0.5) * g.barW, chart.height - 5 * dpr);
    }
  }

  /** Fill the table, slider labels and chart from the current position. */
  function render() {
    for (const key of ["p", "q", "r"]) {
      readouts[key].textContent = Core.formatP(state[key]);
      sliders[key].value = String(Math.round(state[key] * 100));
    }

    const t = Core.computeTable(state.p, state.q, state.r);
    for (const cell of table.querySelectorAll("td[data-player][data-pair]")) {
      cell.textContent = Core.formatProb(t[cell.dataset.pair][cell.dataset.player]);
    }
    table.dataset.focus = state.pair;
    for (const pair of Core.PAIRS) pairBtns[pair].setAttribute("aria-pressed", String(pair === state.pair));

    draw();
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  /** A sentence that says in words what the current numbers mean. */
  function comparison() {
    const t = Core.computeTable(state.p, state.q, state.r);
    const a = t.AB.B;
    const b = t.BC.B;
    const c = t.AC.B;
    const top = Math.max(a, b, c);
    const allTied = a + 1e-9 >= top && b + 1e-9 >= top && c + 1e-9 >= top;
    const best = b >= a && b >= c ? "B vs C" : (a >= c ? "A vs B" : "A vs C");
    const intro = `With p = ${Core.formatP(state.p)}, q = ${Core.formatP(state.q)} and r = ${Core.formatP(state.r)}, ` +
      `B's chance of winning is ${Core.formatProb(a)} starting A vs B, ${Core.formatProb(b)} starting B vs C, ` +
      `and ${Core.formatProb(c)} starting A vs C. `;
    const which = allTied
      ? "Every starting pair gives B the same chance. "
      : `The best start for B is ${best}. `;
    const edge = Math.abs(b - a);
    const againstA = edge <= 1e-9
      ? "Starting against C gives B just the same chance as starting against A."
      : `Starting against C is ${Core.formatProb(edge)} ${b > a ? "better" : "worse"} than starting against A.`;
    return intro + which + againstA;
  }

  /** Apply a new position, then describe it after the state has changed. */
  function changeState(next, describe) {
    state = next;
    say(describe(), "done");
    render();
  }

  for (const key of ["p", "q", "r"]) {
    sliders[key].addEventListener("input", () => {
      const before = state[key];
      const value = Core.SCROLL[key].toValue(+sliders[key].value);
      if (value === before) return;
      const next = key === "p" ? Core.setP(state, value)
        : key === "q" ? Core.setQ(state, value) : Core.setR(state, value);
      changeState(next, () => `You set ${key} to ${Core.formatP(value)}. ` + comparison());
    });
  }

  newBtn.addEventListener("click", () => {
    changeState(Core.reset(), () => "Reset to p = .55, q = .60, r = .75. " + comparison());
  });

  for (const pair of Core.PAIRS) {
    pairBtns[pair].addEventListener("click", () => {
      changeState(Core.selectPair(state, pair),
        () => `You highlighted ${pair} as the first game. ` + comparison());
    });
  }

  function selectFromChart(index) {
    if (index < 0 || index > 2) return;
    const pair = Core.PAIRS[index];
    if (pair === state.pair) return;
    changeState(Core.selectPair(state, pair),
      () => `You chose ${pair} as the first game with the arrow keys. ` + comparison());
  }

  chart.addEventListener("keydown", (event) => {
    let index = Core.PAIRS.indexOf(state.pair);
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") index--;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") index++;
    else if (event.key === "Home") index = 0;
    else if (event.key === "End") index = 2;
    else return;
    event.preventDefault();
    selectFromChart(index);
  });

  chart.addEventListener("pointerdown", (event) => {
    const rect = chart.getBoundingClientRect();
    const px = (event.clientX - rect.left) * (chart.width / rect.width);
    const g = geometry();
    selectFromChart(Math.round((px - g.left) / g.barW - 0.5));
  });

  window.addEventListener("themechange", draw);
  window.addEventListener("resize", draw);

  say(comparison(), "done");
  render();
})();
