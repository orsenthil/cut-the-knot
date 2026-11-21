"use strict";

/* Browser UI: three rectangles show the gcd tiling and the two ways to build the lcm. */
(() => {
  const C = GcdLcmRectanglesCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const mInput = document.getElementById("mInput");
  const nInput = document.getElementById("nInput");

  function rectangle(r, mode) {
    const box = document.createElement("div");
    box.className = "rect-box";
    const title = document.createElement("h2");
    title.className = "rect-title";
    title.textContent = mode === "gcd" ? `${r.m} × ${r.n} tiled by ${r.g}×${r.g}` :
      mode === "cols" ? `${r.a} of ${r.n} → ${r.lcmByColumns}` : `${r.m} of ${r.b} → ${r.lcmByRows}`;
    box.appendChild(title);
    const grid = document.createElement("div");
    grid.className = "grid";
    grid.style.setProperty("--cols", String(mode === "gcd" ? r.a : mode === "cols" ? r.a : r.m));
    grid.style.setProperty("--rows", String(mode === "gcd" ? r.b : mode === "cols" ? 1 : 1));
    const cols = mode === "gcd" ? r.a : mode === "cols" ? r.a : r.m;
    const rows = mode === "gcd" ? r.b : 1;
    for (let i = 0; i < cols * rows; i++) {
      const cell = document.createElement("span");
      cell.className = "cell" + (mode !== "gcd" && i % 2 ? " alt" : "");
      grid.appendChild(cell);
    }
    box.appendChild(grid);
    return box;
  }

  function render() {
    stage.replaceChildren();
    const r = C.analyze(Number(mInput.value) || 6, Number(nInput.value) || 4);
    for (const mode of ["gcd", "cols", "rows"]) stage.appendChild(rectangle(r, mode));
    const identity = document.createElement("p");
    identity.className = "identity";
    identity.textContent = `S = ${r.a} × ${r.b} = ${r.squares} squares · L = S × G = ${r.lcm} · ${r.m} × ${r.n} = ${r.g} × ${r.lcm} = ${r.product}`;
    stage.appendChild(identity);
    say(`${r.g}×${r.g} squares tile the ${r.m}×${r.n} rectangle; the lcm is ${r.lcm}.`);
    if (window.Track) window.Track.state({ m: r.m, n: r.n, gcd: r.g, lcm: r.lcm });
  }

  function say(text) { status.textContent = text; status.classList.add("done"); }
  mInput.addEventListener("change", render);
  nInput.addEventListener("change", render);
  render();
})();
