"use strict";

/*
 * The page for GCD and LCM by Plain Factorization: drawing and input only; the rules are
 * in factorization-core.js. Two text fields take numbers or products typed with "*";
 * Compute (or Enter) shows both factorizations, a table of the primes' exponents with the
 * smaller (gcd) and larger (lcm) of each pair marked, and the gcd and lcm.
 */

(function () {
  const Core = FactorizationCore;
  const form = document.getElementById("form");
  const in1 = document.getElementById("n1");
  const in2 = document.getElementById("n2");
  const shortBox = document.getElementById("short");
  const longBox = document.getElementById("long");
  const out = document.getElementById("out");
  const statusEl = document.getElementById("status");

  let state = Core.start({});

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    kind = kind || Core.result(state);
    if (kind) statusEl.classList.add(kind);
  }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const pretty = (s) => s.replace(/ x /g, " × ");

  function render() {
    out.textContent = "";
    if (state.computed) {
      for (const [label, n] of [["N1", state.n1], ["N2", state.n2]]) {
        const p = el("p", "line");
        const fx = pretty(Core.show(n, state.brief));
        p.append(el("strong", "", `${label} = ${n}`), document.createTextNode(fx === String(n) ? "" : " = " + fx));
        out.appendChild(p);
      }
      const c = Core.compare(state.n1, state.n2);
      if (c.gcd !== null && c.rows.length) {
        const table = el("table", "exps");
        table.setAttribute("aria-label", "Exponents of each prime in the two numbers, with the larger (for the lcm) and the smaller (for the gcd)");
        const head = el("tr");
        for (const h of ["prime", "in N1", "in N2", "gcd takes", "lcm takes"]) head.appendChild(el("th", "", h));
        table.appendChild(head);
        for (const r of c.rows) {
          const tr = el("tr");
          tr.append(el("td", "", String(r.prime)), el("td", "", String(r.e1)), el("td", "", String(r.e2)), el("td", "min", String(r.min)), el("td", "max", String(r.max)));
          table.appendChild(tr);
        }
        out.appendChild(table);
      }
      const l = el("p", "result"), g = el("p", "result");
      if (c.gcd === null) { l.textContent = "LCM: needs two numbers above 0"; g.textContent = "GCD: needs two numbers above 0"; }
      else {
        const fl = pretty(Core.show(c.lcm, state.brief)), fg = pretty(Core.show(c.gcd, state.brief));
        l.append(el("strong", "", "LCM"), document.createTextNode(" = " + (Number.isSafeInteger(c.lcm) ? (fl === String(c.lcm) ? fl : fl + " = " + c.lcmBig) : "") + (Number.isSafeInteger(c.lcm) ? "" : c.lcmBig + " (the product of the primes with the larger exponents)")));
        g.append(el("strong", "", "GCD"), document.createTextNode(" = " + (fg === String(c.gcd) ? fg : fg + " = " + c.gcdBig)));
      }
      out.append(l, g);
      if (c.gcd !== null) out.appendChild(el("p", "check", `gcd × lcm = ${c.gcdBig} × ${c.lcmBig} = ${c.gcdBig * c.lcmBig} = N1 × N2`));
    } else out.appendChild(el("p", "hint", "Press Compute."));
    shortBox.checked = state.brief; longBox.checked = !state.brief;
    if (window.Track) window.Track.state(state);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const bad = [in1.value, in2.value].filter((t) => Core.parse(t) === 0);
    state = Core.move(state, { type: "compute", t1: in1.value, t2: in2.value });
    in1.value = state.t1; in2.value = state.t2;
    render();
    say(bad.length ? "A text that is not a whole number or a product of whole numbers with * (or is above 7,000,000,000) became 0." : "Computed.");
  });
  for (const r of [shortBox, longBox]) r.addEventListener("change", () => { state = Core.move(state, { type: "format", brief: shortBox.checked }); render(); });

  in1.value = state.t1; in2.value = state.t2;
  render();
})();
