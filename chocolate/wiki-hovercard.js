"use strict";

/*
 * Lightweight Wikipedia-style hover/focus preview cards.
 * Any element with class="wiki-term" and data-wiki="Page_Title" gets a
 * floating card (title, thumbnail, extract, "Read more" link) built from
 * Wikipedia's public REST summary endpoint, shown on hover or keyboard focus.
 */

const cardCache = new Map();
let card = null;
let hideTimer = null;

function ensureCard() {
  if (card) return card;
  card = document.createElement("div");
  card.className = "wiki-card";
  card.setAttribute("role", "tooltip");
  document.body.appendChild(card);
  card.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  card.addEventListener("mouseleave", scheduleHide);
  return card;
}

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    card.classList.remove("visible");
  }, 150);
}

function renderCard(data, title) {
  const extract = data.extract || "";
  const thumb = data.thumbnail ? `<img src="${data.thumbnail.source}" alt="">` : "";
  const displayTitle = data.title || title.replace(/_/g, " ");
  const url =
    (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page) ||
    `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
  card.innerHTML = `
    ${thumb}
    <h4>${displayTitle}</h4>
    <p>${extract}</p>
    <a class="wiki-more" href="${url}" target="_blank" rel="noopener">Read on Wikipedia &rarr;</a>
  `;
}

async function loadSummary(title) {
  if (cardCache.has(title)) return cardCache.get(title);
  const resp = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`);
  if (!resp.ok) throw new Error(`Wikipedia lookup failed: ${resp.status}`);
  const data = await resp.json();
  cardCache.set(title, data);
  return data;
}

function positionCard(target) {
  const rect = target.getBoundingClientRect();
  const top = window.scrollY + rect.bottom + 6;
  let left = window.scrollX + rect.left;
  const maxLeft = window.scrollX + document.documentElement.clientWidth - 296;
  left = Math.max(8, Math.min(left, maxLeft));
  card.style.top = `${top}px`;
  card.style.left = `${left}px`;
}

async function showCard(target) {
  clearTimeout(hideTimer);
  const title = target.dataset.wiki;
  ensureCard();
  positionCard(target);
  card.innerHTML = `<p class="wiki-loading">Loading&hellip;</p>`;
  card.classList.add("visible");
  try {
    const data = await loadSummary(title);
    renderCard(data, title);
    positionCard(target);
  } catch (err) {
    card.innerHTML = `<p class="wiki-loading">Couldn't load preview.</p>`;
  }
}

function init() {
  for (const el of document.querySelectorAll(".wiki-term[data-wiki]")) {
    el.addEventListener("mouseenter", () => showCard(el));
    el.addEventListener("mouseleave", scheduleHide);
    el.addEventListener("focus", () => showCard(el));
    el.addEventListener("blur", scheduleHide);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
