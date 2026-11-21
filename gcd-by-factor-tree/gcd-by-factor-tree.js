"use strict";

/*
 * Browser UI for GCD and LCM via Factor Tree. The arithmetic is in
 * gcd-by-factor-tree-core.js; this file draws two factor trees and the
 * multiset operations below them.
 */
(() => {
  const C = GcdByFactorTreeCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const repeatBtn = document.getElementById("repeatBtn");

  let state = null;

  function treeMarkup(node, depth) {
    const wrap = document.createElement("div");
    wrap.className = "node-wrap";
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "fnode" + (node.children.length ? "" : " leaf");
    pill.textContent = String(node.value);
    pill.setAttribute("aria-label", `Factor ${node.value}${node.children.length ? `, splits into ${node.children.map((c) => c.value).join(" and ")}` : ", a prime"}`);
    pill.addEventListener("click", () => {
      say(`${node.value} ${node.children.length ? "= " + node.children.map((c) => c.value).join(" × ") : "is prime."}`);
    });
    wrap.appendChild(pill);
    if (node.children.length) {
      const kids = document.createElement("div");
      kids.className = "kids";
      for (const child of node.children) kids.appendChild(treeMarkup(child, depth + 1));
      wrap.appendChild(kids);
    }
    return wrap;
  }

  function showPrimeList(title, list) {
    const p = document.createElement("p");
    p.className = "plist";
    p.textContent = title + ": " + (list.join(" × ") || "1");
    return p;
  }

  function render() {
    stage.replaceChildren();
    const r = C.analyze(state.n, state.m);
    const trees = document.createElement("div");
    trees.className = "trees";
    for (const [value, label] of [[state.n, "N"], [state.m, "M"]]) {
      const box = document.createElement("div");
      box.className = "tree-box";
      const h = document.createElement("h2");
      h.className = "tree-title";
      h.textContent = `${label} = ${value}`;
      box.appendChild(h);
      box.appendChild(treeMarkup(C.factorTree(value), 0));
      trees.appendChild(box);
    }
    stage.appendChild(trees);

    stage.appendChild(showPrimeList("Common primes (gcd)", r.gcdFactors));
    stage.appendChild(showPrimeList("All primes (lcm)", r.lcmFactors));
    const result = document.createElement("p");
    result.className = "result";
    result.textContent = `gcd(${state.n}, ${state.m}) = ${r.gcd}   ·   lcm(${state.n}, ${state.m}) = ${r.lcm}   ·   ${state.n}×${state.m} = ${r.gcd}×${r.lcm} = ${r.productNM}`;
    stage.appendChild(result);

    say(`The common primes make the gcd ${r.gcd}; all the primes make the lcm ${r.lcm}.`);
    if (window.Track) window.Track.state({ n: state.n, m: state.m, gcd: r.gcd, lcm: r.lcm });
  }

  function say(text) {
    status.textContent = text;
    status.classList.remove("done");
    status.classList.add("done");
  }

  newBtn.addEventListener("click", () => {
    state = C.start();
    render();
  });
  repeatBtn.addEventListener("click", render);

  state = C.start();
  render();
})();
