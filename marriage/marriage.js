"use strict";

/*
 * Marriage Problem - the page.
 *
 * MarriageCore runs McWorter's algorithm; this file draws the 0-1 matrix,
 * lets you toggle cells and swap rows/columns, and drives Step / Slow / Fast.
 */

(function () {
  const H = MarriageCore;

  const boardEl = document.getElementById("board");
  const nInput = document.getElementById("nInput");
  const stepBtn = document.getElementById("stepBtn");
  const slowBtn = document.getElementById("slowBtn");
  const fastBtn = document.getElementById("fastBtn");
  const backBtn = document.getElementById("backBtn");
  const resetBtn = document.getElementById("resetBtn");
  const swapMode = document.getElementById("swapMode");
  const statusEl = document.getElementById("status");
  const phaseEl = document.getElementById("phase");
  const logEl = document.getElementById("log");

  const SLOW_MS = 500;
  const FAST_MS = 80;

  let state = null;
  let playing = null;
  let pick = -1; // first row/col chosen for a manual swap

  function stopPlay() {
    if (playing) clearTimeout(playing);
    playing = null;
  }

  function render() {
    const n = state.n;
    boardEl.style.setProperty("--n", String(n + 1));
    boardEl.innerHTML = "";

    const corner = document.createElement("div");
    corner.className = "corner";
    corner.setAttribute("aria-hidden", "true");
    boardEl.appendChild(corner);

    for (let c = 0; c < n; c++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hdr colHdr";
      btn.textContent = state.cLabels[c];
      btn.setAttribute("aria-label", "Column " + state.cLabels[c]);
      btn.addEventListener("click", () => onHeader("col", c));
      if (pick >= 0 && swapMode.value !== "rows" && pick === c) btn.classList.add("picked");
      boardEl.appendChild(btn);
    }

    for (let r = 0; r < n; r++) {
      const hdr = document.createElement("button");
      hdr.type = "button";
      hdr.className = "hdr rowHdr";
      hdr.textContent = state.rLabels[r];
      hdr.setAttribute("aria-label", "Row " + state.rLabels[r]);
      hdr.addEventListener("click", () => onHeader("row", r));
      if (pick >= 0 && swapMode.value !== "columns" && pick === r) hdr.classList.add("picked");
      boardEl.appendChild(hdr);

      for (let c = 0; c < n; c++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";
        const v = state.values[r][c];
        btn.textContent = v ? "1" : "0";
        btn.classList.toggle("one", !!v);
        if (r === c && v) btn.classList.add("diag");
        if (state.state === H.FINISHED && r === c) btn.classList.add("happy");
        if (state.state === H.FAILED && r === c) btn.classList.add("sad");
        btn.setAttribute("aria-label",
          "Row " + state.rLabels[r] + ", column " + state.cLabels[c] + ": " + v);
        btn.disabled = !!playing;
        btn.addEventListener("click", () => {
          if (playing) return;
          stopPlay();
          H.toggle(state, r, c);
          pick = -1;
          render();
        });
        boardEl.appendChild(btn);
      }
    }

    const done = state.state === H.FINISHED || state.state === H.FAILED;
    phaseEl.textContent = H.STATE_NAMES[state.state] || "";
    statusEl.textContent = state.announce || "";
    statusEl.className = state.state === H.FINISHED ? "win" : state.state === H.FAILED ? "lose" : "";

    stepBtn.disabled = !!playing || done;
    slowBtn.disabled = !!playing || done;
    fastBtn.disabled = !!playing || done;
    backBtn.disabled = !!playing || state.stack.length === 0;
    nInput.disabled = !!playing;

    logEl.innerHTML = "";
    for (const line of state.log.slice(-40)) {
      const li = document.createElement("li");
      li.textContent = line;
      logEl.appendChild(li);
    }
  }

  function onHeader(kind, i) {
    if (playing) return;
    const mode = swapMode.value;
    if (kind === "row" && mode === "columns") return;
    if (kind === "col" && mode === "rows") return;
    if (pick < 0) {
      pick = i;
      render();
      return;
    }
    if (pick === i) {
      pick = -1;
      render();
      return;
    }
    const a = pick;
    pick = -1;
    // Applet MakeMove: rows, columns, or both (same indices).
    if (mode === "rows" || mode === "both") H.swapRows(state, a, i);
    if (mode === "columns" || mode === "both") H.swapColumns(state, a, i);
    state.state = H.GREEDY;
    state.announce = "";
    H.resetIndices(state);
    H.checkFinished(state);
    render();
  }

  function doStep() {
    H.step(state);
    render();
    return state.state !== H.FINISHED && state.state !== H.FAILED;
  }

  function play(ms) {
    if (playing || state.state === H.FINISHED || state.state === H.FAILED) return;
    const tick = () => {
      if (!doStep()) {
        playing = null;
        render();
        return;
      }
      playing = setTimeout(tick, ms);
    };
    playing = setTimeout(tick, ms);
    render();
  }

  function reset() {
    stopPlay();
    const n = Number(nInput.value);
    state = H.start(n);
    pick = -1;
    render();
  }

  for (let n = H.MIN_N; n <= H.MAX_N; n++) {
    const opt = document.createElement("option");
    opt.value = String(n);
    opt.textContent = String(n);
    if (n === H.DEFAULT_N) opt.selected = true;
    nInput.appendChild(opt);
  }

  nInput.addEventListener("change", reset);
  resetBtn.addEventListener("click", reset);
  stepBtn.addEventListener("click", () => { stopPlay(); doStep(); });
  slowBtn.addEventListener("click", () => play(SLOW_MS));
  fastBtn.addEventListener("click", () => play(FAST_MS));
  backBtn.addEventListener("click", () => {
    stopPlay();
    H.back(state);
    pick = -1;
    render();
  });
  swapMode.addEventListener("change", () => { pick = -1; render(); });

  reset();
})();
