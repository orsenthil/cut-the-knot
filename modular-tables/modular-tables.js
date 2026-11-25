"use strict";

/*
 * The page for Modular Arithmetic Tables: drawing and input only. A table of
 * buttons with sticky headers; pressing an entry lights up every entry with the
 * same remainder (an addition to the applet, to explore the page's rook and
 * permutation patterns). The rules are in modular-tables-core.js.
 */

(function () {
  const Core = ModularCore;
  const tbl = document.getElementById("tbl");
  const statusEl = document.getElementById("status");
  const nEl = document.getElementById("n");
  const opsEl = document.querySelector("fieldset.ops");
  const nOut = document.getElementById("nOut");

  let state = Core.start();

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const radios = Core.OPS.map((o, i) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio"; input.name = "op"; input.value = i; input.checked = i === 0;
    input.setAttribute("aria-label", ["plus", "times", "minus", "divide (prime moduli only)"][i]);
    input.addEventListener("change", () => { const s = Core.setOp(state, i); if (s) { state = s; render(); } });
    const span = document.createElement("span"); span.textContent = o.sign;
    label.append(input, span); opsEl.appendChild(label);
    return input;
  });

  function render() {
    const t = Core.table(state.n, state.op), sign = Core.OPS[state.op].sign;
    nOut.textContent = state.n; nEl.value = state.n;
    radios.forEach((r, i) => { r.checked = i === state.op; r.disabled = !Core.available(state.n, i); });
    tbl.textContent = "";
    const head = tbl.createTHead().insertRow();
    const corner = document.createElement("th"); corner.textContent = sign; corner.setAttribute("scope", "col"); head.appendChild(corner);
    t.headers.forEach((h) => { const th = document.createElement("th"); th.textContent = h; th.setAttribute("scope", "col"); head.appendChild(th); });
    const body = tbl.createTBody();
    t.cells.forEach((row, r) => {
      const tr = body.insertRow();
      const th = document.createElement("th"); th.textContent = t.headers[r]; th.setAttribute("scope", "row"); tr.appendChild(th);
      row.forEach((v, c) => {
        const td = tr.insertCell(), b = document.createElement("button");
        b.type = "button"; b.textContent = v; b.className = state.mark === v ? "on" : "";
        b.setAttribute("aria-label", `${t.headers[r]} ${sign} ${t.headers[c]} = ${v} (mod ${state.n})`);
        b.setAttribute("aria-pressed", state.mark === v ? "true" : "false");
        b.addEventListener("click", () => { state = Core.setMark(state, state.mark === v ? null : v); mark(); });
        td.appendChild(b);
      });
    });
    mark();
    if (window.Track) window.Track.state({ n: state.n, op: state.op, mark: state.mark });
  }

  function mark() {
    let count = 0;
    tbl.querySelectorAll("td button").forEach((b) => { const on = state.mark !== null && Number(b.textContent) === state.mark; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); if (on) count++; });
    say(state.mark === null ? (state.op === 3 || state.n >= 2 ? `Modulus ${state.n}.${Core.isPrime(state.n) ? " A prime: division works." : ""}` : "") : `The remainder ${state.mark} appears ${count} time${count === 1 ? "" : "s"}.`, state.mark === null ? null : "done");
    if (window.Track) window.Track.state({ n: state.n, op: state.op, mark: state.mark });
  }

  nEl.addEventListener("input", () => { state = Core.setModulus(state, nEl.value); render(); });
  document.getElementById("clearBtn").addEventListener("click", () => { state = Core.setMark(state, null); mark(); });
  render();
})();
