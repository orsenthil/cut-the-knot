"use strict";

/* Browser UI: a Life-like automaton whose birth and survival rules can be edited. */
(() => {
  const C = LifeLikeAutomatonCore;
  const canvas = document.getElementById("board");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const sideInput = document.getElementById("sideInput");
  const presetSel = document.getElementById("presetSel");
  const rulesEl = document.getElementById("rulesPanel");
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const stepBtn = document.getElementById("stepBtn");
  const reverseBtn = document.getElementById("reverseBtn");
  const randomBtn = document.getElementById("randomBtn");
  const resetBtn = document.getElementById("resetBtn");
  let state = null;
  let timer = null;

  function draw() {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const cell = W / state.size;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--stage").trim() || "#f3f5f8";
    ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#5b4ee8";
    state.cells.forEach((row, y) => row.forEach((alive, x) => {
      if (alive) ctx.fillRect(x * cell + 1, y * cell + 1, Math.max(1, cell - 2), Math.max(1, cell - 2));
    }));
  }

  function buildRules() {
    rulesEl.replaceChildren();
    for (const kind of ["birth", "survival"]) {
      const group = document.createElement("div");
      group.className = "rule-group";
      const label = document.createElement("span");
      label.textContent = kind === "birth" ? "B — born with" : "S — survives with";
      group.appendChild(label);
      for (let n = 0; n <= 8; n++) {
        const box = document.createElement("label");
        box.className = "rule-box";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = state[kind].includes(n);
        input.setAttribute("aria-label", `${kind === "birth" ? "Birth" : "Survival"} with ${n} neighbours`);
        input.addEventListener("change", () => {
          state = C.setRule(state, kind, n);
          render();
          const again = rulesEl.querySelectorAll("input")[kind === "birth" ? n : 9 + n];
          if (again) again.focus();
        });
        box.append(input, document.createTextNode(String(n)));
        group.appendChild(box);
      }
      rulesEl.appendChild(group);
    }
  }

  function render() {
    draw();
    buildRules();
    const r = C.analyze(state);
    sideInput.value = String(state.size);
    presetSel.value = state.preset || "";
    readout.textContent = `${r.rule} · generation ${r.generation} · ${r.population} live cells`;
    status.textContent = r.population === 0
      ? "The board is empty. Click cells, pick a preset or randomize."
      : `Rule ${r.rule}: ${r.population} cells alive in generation ${r.generation}.`;
    status.className = "done";
    stepBtn.disabled = !!timer;
    reverseBtn.disabled = !!timer || state.history.length === 0;
    if (window.Track) window.Track.state({
      size: state.size, rule: r.rule, birth: r.birth, survival: r.survival,
      generation: r.generation, population: r.population,
    });
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    stopBtn.disabled = true;
    startBtn.disabled = false;
    stepBtn.disabled = false;
  }

  canvas.addEventListener("click", (ev) => {
    const box = canvas.getBoundingClientRect();
    const x = Math.floor((ev.clientX - box.left) * state.size / box.width);
    const y = Math.floor((ev.clientY - box.top) * state.size / box.height);
    state = C.toggle(state, x, y);
    render();
  });
  startBtn.addEventListener("click", () => {
    if (timer) return;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    timer = setInterval(() => { state = C.step(state); render(); }, 150);
  });
  stopBtn.addEventListener("click", stop);
  stepBtn.addEventListener("click", () => { state = C.step(state); render(); });
  reverseBtn.addEventListener("click", () => { state = C.reverse(state); render(); });
  randomBtn.addEventListener("click", () => { state = C.randomize(state, 40); render(); });
  resetBtn.addEventListener("click", () => { stop(); state = C.start({ size: state.size, preset: state.preset || "conway" }); render(); });
  sideInput.addEventListener("input", () => { stop(); state = C.start({ size: Number(sideInput.value) }); render(); });
  presetSel.addEventListener("change", () => {
    stop();
    if (presetSel.value) state = C.setPreset(state, presetSel.value);
    render();
  });
  window.addEventListener("themechange", draw);

  presetSel.appendChild(new Option("Choose a rule…", ""));
  for (const [name, preset] of Object.entries(C.PRESETS)) presetSel.appendChild(new Option(preset.label, name));
  state = C.start();
  stopBtn.disabled = true;
  render();
})();
