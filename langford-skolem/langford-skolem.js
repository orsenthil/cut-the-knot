"use strict";

/* Browser UI: solve Langford/Skolem arrangements for the chosen parameters. */
(() => {
  const C = LangfordSkolemCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const nInput = document.getElementById("nInput");
  const dInput = document.getElementById("dInput");
  const mSel = document.getElementById("mSel");
  const hSel = document.getElementById("hSel");
  const kindRadios = [...document.querySelectorAll('input[name="kind"]')];
  let state = null;

  const colors = ["#6a5df0", "#d9534f", "#15803d", "#d9a441", "#c026d3", "#0e7490", "#7c3aed", "#b45309", "#2563eb", "#be123c", "#4d7c0f", "#9333ea"];

  function render() {
    const r = C.analyze(state);
    stage.replaceChildren();
    if (r.solution) {
      r.solution.forEach((value, i) => {
        const cell = document.createElement("span");
        cell.className = "cell" + (value === -1 ? " hole" : "");
        cell.textContent = value === -1 ? "·" : String(value);
        if (value > 0) {
          cell.style.setProperty("--tone", colors[(value - 1) % colors.length]);
        }
        cell.setAttribute("aria-label", value === -1 ? `Position ${i + 1}, empty` : `Position ${i + 1}, number ${value}`);
        stage.appendChild(cell);
      });
    } else {
      const empty = document.createElement("p");
      empty.className = "none";
      empty.textContent = "No arrangement exists for these parameters.";
      stage.appendChild(empty);
    }

    nInput.value = String(state.N);
    dInput.value = String(state.D);
    dInput.max = String(state.N);
    mSel.value = String(state.M);
    hSel.value = String(state.H);
    kindRadios.forEach((radio) => { radio.checked = radio.value === state.kind; });
    readout.textContent = `${state.kind === "langford" ? "Langford" : "Skolem"} · numbers ${state.D}–${state.N} · ${state.M} copies each · ${state.H} hole${state.H === 1 ? "" : "s"} · ${r.solution ? r.solution.length : 0} positions · ${r.visited.toLocaleString()} states searched`;
    const perfect = state.D === 1 && state.M === 2 && state.H === 0;
    status.textContent = !r.solution
      ? perfect
        ? `No sequence exists here — the modulo-4 rule agrees.`
        : `No arrangement exists for these parameters.`
      : r.validation.valid
        ? `Valid sequence: ${r.text}. Check the gaps between matching numbers.`
        : `A sequence was found but failed validation.`;
    status.className = r.solution && r.validation.valid ? "win" : "done";
    if (window.Track) window.Track.state({
      N: state.N, D: state.D, M: state.M, H: state.H, kind: state.kind,
      sequence: r.solution ? r.solution.slice() : [], text: r.text, valid: r.validation.valid,
    });
  }

  const bind = (input, key) => input.addEventListener("input", () => {
    state = C.setParam(state, key, Number(input.value));
    render();
  });
  bind(nInput, "N");
  bind(dInput, "D");
  mSel.addEventListener("change", () => { state = C.setParam(state, "M", Number(mSel.value)); render(); });
  hSel.addEventListener("change", () => { state = C.setParam(state, "H", Number(hSel.value)); render(); });
  kindRadios.forEach((r) => r.addEventListener("change", () => {
    if (r.checked) { state = { ...state, kind: r.value }; render(); }
  }));

  state = C.start();
  render();
})();
