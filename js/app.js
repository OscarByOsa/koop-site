/* ============================================================================
   КООПЕРАТИВ — приложение
   Каталог по прайс-листу, склады, крафт авто, броня тир-5, экспорт.

   Система печати сохранена без изменений в поведении:
   assets/ittems/textures/svgs/pechat.svg -> PNG dataURL -> штамп на каждом
   экспортированном документе (PDF и PNG).
   ========================================================================== */

/* ============================================================================
   0. УТИЛИТЫ
   ========================================================================== */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.prototype.slice.call(root.querySelectorAll(sel));

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, ch => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
));

const fmt = n => Number(n || 0).toLocaleString("ru-RU");

function pluralGayka(n) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "гаек";
  if (last === 1) return "гайка";
  if (last >= 2 && last <= 4) return "гайки";
  return "гаек";
}

function priceText(item) {
  if (!item) return "—";
  if (item.priceLabel) return item.priceLabel;
  return fmt(item.price);
}

function debounce(fn, ms) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

const tierOf = id => TIERS.find(t => t.id === id) || TIERS[TIERS.length - 1];

/* ============================================================================
   1. ПЕЧАТЬ (система добавления печати — сохранена)
   ========================================================================== */
const Seal = (function () {
  let cachedPng = null;
  let inflight = null;

  function rasterize(svgText) {
    return new Promise(function (resolve) {
      /* Печать рендерим в PNG через canvas: так она одинаково вставляется
         и в PDF (addImage), и в PNG-экспорт (drawImage). */
      const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = function () {
        const size = 512;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(blobUrl);
        try { resolve(canvas.toDataURL("image/png")); }
        catch (e) { console.warn("Печать: canvas недоступен", e); resolve(null); }
      };
      img.onerror = function (e) {
        console.warn("Не удалось отрисовать SVG печати", e);
        URL.revokeObjectURL(blobUrl);
        resolve(null);
      };
      img.src = blobUrl;
    });
  }

  async function build() {
    try {
      const res = await fetch(CONFIG.sealPath);
      if (!res.ok) { console.warn("Печать не найдена:", CONFIG.sealPath, res.status); return null; }
      let svgText = await res.text();

      // Приводим размеры к квадрату, чтобы печать вписывалась в штамп.
      if (!/width=/.test(svgText) || !/height=/.test(svgText)) {
        svgText = svgText.replace(/<svg\b([^>]*)>/i, function (m, attrs) {
          const cleaned = attrs.replace(/\s(width|height)="[^"]*"/g, "");
          return `<svg${cleaned} width="512" height="512">`;
        });
      }
      return await rasterize(svgText);
    } catch (e) {
      console.warn("Ошибка загрузки печати", e);
      return null;
    }
  }

  /** PNG dataURL печати или null. Кэшируется, повторные вызовы бесплатны. */
  function get() {
    if (cachedPng) return Promise.resolve(cachedPng);
    if (!inflight) {
      inflight = build().then(function (png) { cachedPng = png; return png; });
    }
    return inflight;
  }

  /** Штамп на текущую страницу PDF (правый нижний угол). */
  async function stampPdf(doc, opts) {
    const png = await get();
    if (!png) return;
    const o = Object.assign({ size: 38, margin: 14, bottom: 10 }, opts || {});
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    try {
      doc.addImage(png, "PNG", pageW - o.size - o.margin, pageH - o.size - o.bottom,
        o.size, o.size, undefined, "FAST");
    } catch (e) { console.warn("Ошибка вставки печати в PDF", e); }
  }

  /** Штамп на каждую страницу документа. Вызывать один раз в конце сборки. */
  async function stampPdfAllPages(doc, opts) {
    const png = await get();
    if (!png) return;
    const o = Object.assign({ size: 38, margin: 14, bottom: 10 }, opts || {});
    const total = doc.internal.getNumberOfPages();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      try {
        doc.addImage(png, "PNG", pageW - o.size - o.margin, pageH - o.size - o.bottom,
          o.size, o.size, undefined, "FAST");
      } catch (e) { console.warn("Ошибка вставки печати в PDF", e); }
    }
  }

  /** Штамп поверх готового canvas (PNG-экспорт). */
  async function stampCanvas(canvas, opts) {
    const png = await get();
    if (!png) return;
    const o = Object.assign({ alpha: 0.35, pad: 40 }, opts || {});
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.src = png;
    await new Promise(function (r) { img.onload = r; img.onerror = r; });
    const size = Math.min(canvas.width, canvas.height) * 0.20;
    ctx.globalAlpha = o.alpha;
    ctx.drawImage(img, canvas.width - size - o.pad, canvas.height - size - o.pad, size, size);
    ctx.globalAlpha = 1;
  }

  return { get: get, stampPdf: stampPdf, stampPdfAllPages: stampPdfAllPages, stampCanvas: stampCanvas };
})();

/* ============================================================================
   2. ИКОНКИ
   ========================================================================== */
const ICON_CACHE = Object.create(null);

function iconPath(id) { return CONFIG.iconDir + id + ".png"; }

function iconTag(id, size, cls) {
  const s = size || 34;
  const c = cls ? " " + cls : "";
  return `<img class="card-icon${c}" src="${iconPath(id)}" width="${s}" height="${s}" alt=""
            loading="lazy" onerror="this.classList.add('missing');this.removeAttribute('src')">`;
}

function iconTagSm(id) {
  return `<img src="${iconPath(id)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
}

function loadIconDataUrl(id) {
  id = ALIASES[id] || id;
  if (id in ICON_CACHE) return Promise.resolve(ICON_CACHE[id]);
  return fetch(iconPath(id))
    .then(res => (res.ok ? res.blob() : null))
    .then(blob => {
      if (!blob) { ICON_CACHE[id] = null; return null; }
      return new Promise(function (resolve, reject) {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    })
    .then(dataUrl => { ICON_CACHE[id] = dataUrl; return dataUrl; })
    .catch(function () { ICON_CACHE[id] = null; return null; });
}

function preloadIcons(ids) {
  const uniq = [...new Set(ids.map(i => ALIASES[i] || i))];
  return Promise.all(uniq.map(loadIconDataUrl));
}

function iconData(id) { return ICON_CACHE[ALIASES[id] || id] || null; }

/* ============================================================================
   3. СОСТОЯНИЕ
   ========================================================================== */
const state = {
  edits: {},        // id -> { price, name, cat, tier, note, priceLabel }
  custom: [],       // добавленные вручную ресурсы
  removed: [],      // удалённые из каталога id
  faction: [],      // [{ id, qty }]
  players: [],      // [{ player, role, items: [{ id, qty }] }]
  autoNeed: {}      // id -> нужное количество для сборки авто
};

let editMode = false;
let resourceIndex = new Map();   // id -> ресурс (актуальный, с учётом правок)
let resourceList = [];           // плоский список

function applyEdits(item) {
  const e = state.edits[item.id];
  return e ? Object.assign({}, item, e) : item;
}

function rebuildIndex() {
  const removed = new Set(state.removed);
  const list = [];
  CATALOG.forEach(function (item) {
    if (removed.has(item.id)) return;
    list.push(applyEdits(item));
  });
  state.custom.forEach(function (item) { list.push(item); });

  resourceList = list;
  resourceIndex = new Map();
  list.forEach(function (r) { resourceIndex.set(r.id, r); });
}

function findResource(id) {
  const key = ALIASES[id] || id;
  return resourceIndex.get(key) || {
    id: key, name: key, price: 0, cat: "—", tier: "other", note: null,
    priceLabel: null, out: true, unknown: true
  };
}

function allResources() { return resourceList; }

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function normalizeStockList(items) {
  const out = [];
  (Array.isArray(items) ? items : []).forEach(function (it) {
    if (!it || !it.id) return;
    const id = ALIASES[it.id] || it.id;
    const qty = Math.max(0, parseInt(it.qty, 10) || 0);
    const found = out.find(x => x.id === id);
    if (found) found.qty += qty;
    else out.push({ id: id, qty: qty });
  });
  return out;
}

function normalizePlayers(players) {
  return (Array.isArray(players) ? players : []).map(function (p) {
    return {
      player: String(p.player || "Без имени"),
      role: String(p.role || "Участник фракции"),
      items: normalizeStockList(p.items)
    };
  });
}

function makeDefaultState() {
  return {
    edits: {},
    custom: [],
    removed: [],
    faction: [],
    players: deepClone(DEFAULT_PLAYERS),
    autoNeed: {}
  };
}

function replaceState(next) {
  state.edits = next.edits || {};
  state.custom = Array.isArray(next.custom) ? next.custom : [];
  state.removed = Array.isArray(next.removed) ? next.removed : [];
  state.faction = normalizeStockList(next.faction);
  state.players = normalizePlayers(next.players);
  state.autoNeed = next.autoNeed && typeof next.autoNeed === "object" ? next.autoNeed : {};
}

function loadState() {
  // Текущий формат
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.dataVersion === CONFIG.dataVersion) {
        replaceState(parsed);
        return;
      }
    }
  } catch (e) { console.warn("Не удалось прочитать сохранение", e); }

  // Миграция со старой версии сайта: сохраняем склады и игроков,
  // цены берём из нового прайса.
  for (let i = 0; i < CONFIG.legacyKeys.length; i++) {
    try {
      const raw = localStorage.getItem(CONFIG.legacyKeys[i]);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const migrated = makeDefaultState();
      migrated.faction = normalizeStockList(parsed.faction);
      if (Array.isArray(parsed.players) && parsed.players.length) {
        migrated.players = normalizePlayers(parsed.players);
      }
      replaceState(migrated);
      saveState();
      return;
    } catch (e) { /* следующий ключ */ }
  }

  replaceState(makeDefaultState());
}

function saveState() {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(Object.assign(
      { dataVersion: CONFIG.dataVersion }, state
    )));
  } catch (e) {
    setStatus("Не удалось сохранить данные: " + e.message, "error");
  }
}

/* ============================================================================
   4. СТАТУС
   ========================================================================== */
let statusTimer = null;
function setStatus(msg, type, autoHide) {
  const el = $("#statusBanner");
  if (!el) return;
  el.textContent = msg;
  el.className = "status-banner show " + (type || "info");
  clearTimeout(statusTimer);
  if (autoHide) statusTimer = setTimeout(() => el.classList.remove("show"), autoHide);
}

/* ============================================================================
   5. ПРОГРАММА ПРОСМОТРА: КАТАЛОГ
   ========================================================================== */
const view = {
  search: "",
  cat: "",
  sort: "list",           // list | name | priceAsc | priceDesc
  tiers: new Set()        // пусто = все
};

function buildTierChips() {
  const box = $("#tierChips");
  if (!box) return;
  box.innerHTML = TIERS.map(function (t) {
    return `<button class="btn btn-sm tier-chip" data-tier="${t.id}" title="${esc(t.hint)}">
      <span class="tier-dot" style="background:${t.color};display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px"></span>${esc(t.name)}
    </button>`;
  }).join("");
  box.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-tier]");
    if (!btn) return;
    const id = btn.dataset.tier;
    if (view.tiers.has(id)) view.tiers.delete(id);
    else view.tiers.add(id);
    syncTierChips();
    renderCatalog();
  });
  syncTierChips();
}

function syncTierChips() {
  $$("#tierChips .tier-chip").forEach(function (btn) {
    btn.classList.toggle("is-on", view.tiers.size === 0 || view.tiers.has(btn.dataset.tier));
  });
}

function filteredCatalog() {
  const q = view.search.trim().toLowerCase();
  const cat = view.cat;
  const tiers = view.tiers;

  let list = allResources().filter(function (r) {
    if (cat && r.cat !== cat) return false;
    if (tiers.size && !tiers.has(r.tier)) return false;
    if (!q) return true;
    return (r.name || "").toLowerCase().indexOf(q) !== -1 ||
           (r.id || "").toLowerCase().indexOf(q) !== -1 ||
           (CATS[r.cat] || "").toLowerCase().indexOf(q) !== -1;
  });

  if (view.sort === "priceAsc")       list.sort((a, b) => a.price - b.price);
  else if (view.sort === "priceDesc") list.sort((a, b) => b.price - a.price);
  else if (view.sort === "name")      list.sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return list;
}

function cardHtml(r) {
  const t = tierOf(r.tier);
  const chips = [
    `<span class="chip">${esc(CATS[r.cat] || "—")}</span>`,
    `<span class="chip" style="color:${t.color};border-color:${t.color}40">${esc(t.name)}</span>`
  ];
  if (r.out) chips.push(`<span class="chip chip-warn">вне прайса</span>`);
  if (r.unknown) chips.push(`<span class="chip chip-warn">нет в справочнике</span>`);

  return `
    <article class="card${editMode ? " editable" : ""}${r.out ? " is-out" : ""}" data-id="${esc(r.id)}">
      <div class="card-edit">
        <button class="btn" data-act="edit-resource" title="Редактировать">✎</button>
        <button class="btn btn-danger" data-act="delete-resource" title="Удалить">✕</button>
      </div>
      <div class="card-top">
        ${iconTag(r.id, 34)}
        <div class="card-name">${esc(r.name)}</div>
      </div>
      <div class="card-price">${priceText(r)}<small>${pluralGayka(r.price)}</small></div>
      <div class="card-meta">${chips.join("")}</div>
      ${r.note ? `<div class="card-note">${esc(r.note)}</div>` : ""}
    </article>`;
}

function renderCatalog() {
  const box = $("#catalogBody");
  if (!box) return;

  const list = filteredCatalog();
  const total = list.reduce((s, r) => s + (r.price || 0), 0);

  if (!list.length) {
    box.innerHTML = `<div class="empty-note">Ничего не найдено. Измените фильтры или запрос.</div>`;
  } else {
    const byTier = new Map();
    TIERS.forEach(t => byTier.set(t.id, []));
    list.forEach(function (r) {
      const key = byTier.has(r.tier) ? r.tier : "other";
      byTier.get(key).push(r);
    });

    let html = "";
    TIERS.forEach(function (t) {
      const items = byTier.get(t.id);
      if (!items || !items.length) return;
      if (view.sort === "name" || view.sort === "list") {
        if (view.sort === "name") items.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      }
      html += `
        <section class="tier-section">
          <header class="tier-head">
            <h2 class="tier-title">
              <span class="tier-dot" style="background:${t.color}"></span>${esc(t.name)}
            </h2>
            <span class="tier-hint">${esc(t.hint)}</span>
            <span class="tier-qty">${items.length} поз.</span>
          </header>
          <div class="grid">${items.map(cardHtml).join("")}</div>
        </section>`;
    });
    box.innerHTML = html;
  }

  const note = $("#catalogNote");
  if (note) {
    note.innerHTML = `Показано <b>${fmt(list.length)}</b> из <b>${fmt(allResources().length)}</b> · сумма каталога <b>${fmt(total)}</b> ${pluralGayka(total)}`;
  }
  const countEl = $("#countCatalog");
  if (countEl) countEl.textContent = fmt(allResources().length);
}

/* ============================================================================
   6. КРАФТ АВТО
   ========================================================================== */
function autoNeedOf(id) {
  const v = state.autoNeed[id];
  return v === undefined ? 1 : Math.max(0, Number(v) || 0);
}

function factionQtyOf(id) {
  const key = ALIASES[id] || id;
  const it = state.faction.find(x => x.id === key);
  return it ? it.qty : 0;
}

function autoGroupsResolved() {
  return AUTO_GROUPS.map(function (g) {
    const items = g.items.map(function (id) {
      const r = findResource(id);
      return {
        id: r.id,
        name: r.name,
        price: r.price,
        tier: tierOf(r.tier),
        need: autoNeedOf(r.id),
        have: factionQtyOf(r.id)
      };
    });
    return Object.assign({}, g, { resolved: items });
  });
}

function autoTotals(groups) {
  let sum = 0, positions = 0, covered = 0;
  groups.forEach(function (g) {
    g.resolved.forEach(function (it) {
      sum += it.price * it.need;
      if (it.need > 0) positions++;
      if (it.need > 0 && it.have >= it.need) covered++;
    });
  });
  return { sum: sum, positions: positions, covered: covered };
}

function autoRowHtml(it) {
  const isCovered = it.need > 0 && it.have >= it.need;
  const deficit = Math.max(0, it.need - it.have);
  return `
    <div class="auto-row${isCovered ? " covered" : ""}" data-auto-id="${esc(it.id)}">
      <div class="auto-name">
        ${iconTagSm(it.id)}
        <span>${esc(it.name)}</span>
      </div>
      <span class="auto-tier" style="color:${it.tier.color}">
        ${isCovered ? "✓ на складе" : (deficit > 0 && it.have > 0 ? `не хватает ${deficit}` : "")}
      </span>
      <input class="qty-input" type="number" min="0" max="9999"
             value="${it.need}" data-auto-qty="${esc(it.id)}" aria-label="Количество">
      <span class="auto-sum" data-auto-sum="${esc(it.id)}">${fmt(it.price * it.need)}</span>
    </div>`;
}

function renderAuto() {
  const box = $("#autoBody");
  if (!box) return;

  const groups = autoGroupsResolved();
  const totals = autoTotals(groups);

  const overview = `
    <div class="auto-overview">
      <div class="stat-card">
        <div class="stat-label">Комплект целиком</div>
        <div class="stat-value" id="autoTotalSum">${fmt(totals.sum)} <small>${pluralGayka(totals.sum)}</small></div>
        <div class="stat-sub">по ценам прайса, по 1 шт. каждой позиции</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Позиций в комплекте</div>
        <div class="stat-value">${fmt(totals.positions)}</div>
        <div class="stat-sub">${AUTO_GROUPS.length} систем</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Есть на складе фракции</div>
        <div class="stat-value" data-auto-covered>${fmt(totals.covered)} <small>из ${fmt(totals.positions)}</small></div>
        <div class="stat-sub">зелёным отмечено собранное</div>
      </div>
    </div>
    <div class="legend">
      <span><i style="background:#5aa860"></i>позиция уже есть на складе фракции</span>
      <span>Количество меняется под конкретную сборку, цены — из прайса</span>
    </div>`;

  box.innerHTML = overview + groups.map(function (g) {
    const sum = g.resolved.reduce((s, it) => s + it.price * it.need, 0);
    const need = g.resolved.filter(it => it.need > 0).length;
    return `
      <section class="group-card" data-group="${g.id}">
        <header class="group-head">
          <h3>${esc(g.title)}</h3>
          <span class="group-hint">${esc(g.hint)}</span>
          <span class="group-sum" data-group-sum="${g.id}">
            ${fmt(sum)} ${pluralGayka(sum)}${need ? "" : " · пусто"}
          </span>
        </header>
        <div class="group-body">${g.resolved.map(autoRowHtml).join("")}</div>
      </section>`;
  }).join("");

  const countEl = $("#countAuto");
  if (countEl) countEl.textContent = fmt(totals.positions);
}

/** Пересчёт сумм без перерисовки: строки, заголовки групп, итог комплекта. */
function recalcAuto(groupId) {
  const groups = autoGroupsResolved();
  groups.forEach(function (g) {
    if (groupId && g.id !== groupId) return;

    g.resolved.forEach(function (it) {
      const sumEl = $(`[data-auto-sum="${it.id}"]`);
      if (sumEl) sumEl.textContent = fmt(it.price * it.need);

      const row = $(`[data-auto-id="${it.id}"]`);
      if (row) {
        const covered = it.need > 0 && it.have >= it.need;
        row.classList.toggle("covered", covered);
        const tierEl = row.querySelector(".auto-tier");
        if (tierEl) {
          const deficit = Math.max(0, it.need - it.have);
          tierEl.textContent = covered
            ? "✓ на складе"
            : (deficit > 0 && it.have > 0 ? `не хватает ${deficit}` : "");
        }
      }
    });

    const sum = g.resolved.reduce((s, it) => s + it.price * it.need, 0);
    const headEl = $(`[data-group-sum="${g.id}"]`);
    if (headEl) {
      const need = g.resolved.filter(it => it.need > 0).length;
      headEl.textContent = `${fmt(sum)} ${pluralGayka(sum)}${need ? "" : " · пусто"}`;
    }
  });

  const totals = autoTotals(groups);
  const totalEl = $("#autoTotalSum");
  if (totalEl) totalEl.innerHTML = `${fmt(totals.sum)} <small>${pluralGayka(totals.sum)}</small>`;
  const coveredEl = $("[data-auto-covered]");
  if (coveredEl) coveredEl.innerHTML = `${fmt(totals.covered)} <small>из ${fmt(totals.positions)}</small>`;
}

/* ============================================================================
   7. БРОНЯ ТИР-5
   ========================================================================== */
function renderArmor() {
  const box = $("#armorBody");
  if (!box) return;

  box.innerHTML = `<div class="armor-grid">${ARMOR_SETS.map(function (set) {
    let resCost = 0;
    const rows = set.resources.map(function (pair) {
      const r = findResource(pair[0]);
      const qty = pair[1];
      const cost = (r.price || 0) * qty;
      resCost += cost;
      return `
        <div class="armor-res">
          <div class="ar-name">${iconTagSm(r.id)}<span>${esc(r.name)}</span></div>
          <span class="ar-need">×${fmt(qty)}</span>
          <span class="ar-cost">${fmt(cost)}</span>
        </div>`;
    }).join("");

    return `
      <article class="armor-card" style="--armor-accent:${set.accent}" data-armor="${set.id}">
        <header class="armor-head">
          <h3 class="armor-title">${esc(set.title)}</h3>
          <div class="armor-price">${fmt(set.price)} <small>гаек</small></div>
          <div class="armor-sub">В цену включена 15% надбавка за сборку фракции</div>
        </header>
        <div class="armor-list">${rows}</div>
        <footer class="armor-foot">
          <span>${set.resources.length} позиций</span>
          <span>ресурсы по прайсу: <b>${fmt(resCost)}</b></span>
        </footer>
      </article>`;
  }).join("")}</div>`;

  const countEl = $("#countArmor");
  if (countEl) countEl.textContent = String(ARMOR_SETS.length);
}

/* ============================================================================
   7.1 РЕЦЕПТЫ КРАФТА
   ========================================================================== */
function craftItemName(itemId) {
  if (CRAFT_ITEMS[itemId]) return CRAFT_ITEMS[itemId];
  if (itemId.indexOf("ittems:") === 0) {
    const r = findResource(itemId.slice(7));
    return r.name;
  }
  return itemId;
}

/** Локальный id иконки для предмета или null (у minecraft-предметов иконок нет). */
function craftIconId(itemId) {
  if (itemId.indexOf("ittems:") !== 0) return null;
  const id = itemId.slice(7);
  return resourceIndex.has(id) ? id : null;
}

function renderCraft() {
  const box = $("#craftBody");
  if (!box) return;

  box.innerHTML = `<div class="craft-grid">${CRAFTS.map(function (c) {
    const name = craftItemName(c.item);
    const cells = [];
    c.pattern.forEach(function (row) {
      for (let i = 0; i < 3; i++) {
        const ch = row.charAt(i) || " ";
        const itemId = ch === " " ? null : c.key[ch];
        const icon = itemId ? craftIconId(itemId) : null;
        cells.push(itemId
          ? `<div class="craft-slot" title="${esc(craftItemName(itemId))}">
               ${icon ? iconTagSm(icon) : `<span class="craft-slot-dot"></span>`}
             </div>`
          : `<div class="craft-slot is-empty"></div>`);
      }
    });

    return `
      <article class="craft-card" data-craft="${esc(c.id)}">
        <header class="craft-head">
          <div class="craft-result">${esc(name)}${c.count > 1 ? ` <small>×${c.count}</small>` : ""}</div>
          <code class="craft-id">${esc(c.item)}</code>
        </header>
        <div class="craft-body">
          <div class="craft-grid-matrix craft-3x3">${cells.join("")}</div>
          <ul class="craft-legend">
            ${Object.keys(c.key).sort().map(function (ch) {
              const itemId = c.key[ch];
              const icon = craftIconId(itemId);
              return `<li>
                        <b>${esc(ch)}</b>
                        ${icon ? iconTagSm(icon) : ""}
                        <span>${esc(craftItemName(itemId))}</span>
                        <small>${esc(itemId)}</small>
                      </li>`;
            }).join("")}
          </ul>
        </div>
      </article>`;
  }).join("")}</div>`;

  const countEl = $("#countCraft");
  if (countEl) countEl.textContent = String(CRAFTS.length);
}

/* ============================================================================
   8. СКЛАДЫ
   ========================================================================== */
function stockRows(items, query) {
  const q = (query || "").trim().toLowerCase();
  return items
    .map(function (it) {
      const r = findResource(it.id);
      return { id: it.id, qty: it.qty, res: r };
    })
    .filter(function (row) {
      if (!q) return true;
      return row.res.name.toLowerCase().indexOf(q) !== -1 ||
             row.id.toLowerCase().indexOf(q) !== -1;
    })
    .sort(function (a, b) {
      const ca = CATS[a.res.cat] || "—";
      const cb = CATS[b.res.cat] || "—";
      if (ca !== cb) return ca.localeCompare(cb, "ru");
      return a.res.name.localeCompare(b.res.name, "ru");
    });
}

function stockTotal(items) {
  return items.reduce((s, it) => s + (it.res.price || 0) * it.qty, 0);
}

function stockTableHtml(rows, ctx) {
  if (!rows.length) {
    return `<div class="table-wrap"><div class="empty-note">Склад пуст</div></div>
            <div class="stock-total"><span>Итого:</span><span class="sum" data-stock-total="${ctx}">0 ${pluralGayka(0)}</span></div>`;
  }
  const body = rows.map(function (row) {
    const r = row.res;
    return `
      <tr${r.out ? ` class="is-out"` : ""} data-stock-row="${esc(r.id)}">
        <td><div class="res-name">${iconTagSm(r.id)}<span>${esc(r.name)}</span></div></td>
        <td class="c-cat">${esc(CATS[r.cat] || "—")}</td>
        <td class="num c-price">${priceText(r)}</td>
        <td class="num${editMode ? "" : " c-qty"}">
          ${editMode
            ? `<input class="qty-input" type="number" min="0" max="999999" value="${row.qty}"
                      data-stock-qty="${esc(r.id)}" data-stock-ctx="${ctx}" aria-label="Количество">`
            : fmt(row.qty)}
        </td>
        <td class="num c-sum" data-stock-sum="${esc(r.id)}" data-stock-ctx="${ctx}">${fmt((r.price || 0) * row.qty)}</td>
        ${editMode
          ? `<td class="row-actions"><button class="btn btn-danger btn-icon"
                  data-stock-remove="${esc(r.id)}" data-stock-ctx="${ctx}">✕</button></td>`
          : ""}
      </tr>`;
  }).join("");

  const total = stockTotal(rows);
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ресурс</th>
            <th>Тип</th>
            <th class="num">Цена</th>
            <th class="num">Кол-во</th>
            <th class="num">Стоимость</th>
            ${editMode ? "<th></th>" : ""}
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <div class="stock-total">
      <span>Итого:</span>
      <span class="sum" data-stock-total="${ctx}">${fmt(total)} ${pluralGayka(total)}</span>
    </div>`;
}

function addBarHtml(ctx, label) {
  if (!editMode) return "";
  const opts = allResources()
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    .map(r => `<option value="${esc(r.id)}">${esc(r.name)} — ${priceText(r)}</option>`)
    .join("");
  return `
    <div class="add-bar">
      <select class="field" data-add-select="${ctx}">
        <option value="">— выбрать ресурс для «${esc(label)}» —</option>
        ${opts}
      </select>
      <input class="qty-input" type="number" min="1" value="1" data-add-qty="${ctx}" aria-label="Количество">
      <button class="btn btn-good btn-sm" data-add-submit="${ctx}">+ Добавить</button>
      <button class="btn btn-sm" data-stock-clear="${ctx}">Очистить</button>
    </div>`;
}

function renderFaction() {
  const box = $("#factionBody");
  if (!box) return;
  const q = $("#searchFaction") ? $("#searchFaction").value : "";
  const rows = stockRows(state.faction, q);
  const total = state.faction.reduce((s, it) => s + (findResource(it.id).price || 0) * it.qty, 0);

  box.innerHTML = `
    <div class="stock-block">
      <div class="stock-head">
        <h3>Склад фракции</h3>
        <span class="badge badge-gold">${fmt(state.faction.length)} поз.</span>
        <span class="badge" data-stock-badge="faction">${fmt(total)} ${pluralGayka(total)}</span>
      </div>
      ${addBarHtml("faction", "склад фракции")}
      ${stockTableHtml(rows, "faction")}
    </div>`;

  const countEl = $("#countFaction");
  if (countEl) countEl.textContent = fmt(state.faction.length);
}

function renderPlayers() {
  const box = $("#playersBody");
  if (!box) return;
  const q = $("#searchPlayers") ? $("#searchPlayers").value : "";
  const ql = q.trim().toLowerCase();

  const blocks = state.players.map(function (p, idx) {
    const rows = stockRows(p.items, q);
    if (ql && !rows.length && p.player.toLowerCase().indexOf(ql) === -1) return "";
    const total = p.items.reduce((s, it) => s + (findResource(it.id).price || 0) * it.qty, 0);
    return `
      <div class="stock-block">
        <div class="stock-head">
          <h3>${esc(p.player)}</h3>
          <span class="badge">${esc(p.role)}</span>
          <span class="badge">${fmt(p.items.length)} поз.</span>
          <span class="badge badge-gold" data-stock-badge="player:${idx}">${fmt(total)} ${pluralGayka(total)}</span>
          <span class="badge-spacer"></span>
          ${editMode ? `<button class="btn btn-danger btn-sm" data-del-player="${idx}">Удалить игрока</button>` : ""}
        </div>
        ${addBarHtml("player:" + idx, p.player)}
        ${stockTableHtml(rows, "player:" + idx)}
      </div>`;
  }).filter(Boolean).join("");

  box.innerHTML = blocks || `<div class="empty-note">Ничего не найдено</div>`;

  const countEl = $("#countPlayers");
  if (countEl) countEl.textContent = fmt(state.players.length);
}

function stockCtxItems(ctx) {
  if (ctx === "faction") return state.faction;
  if (ctx.indexOf("player:") === 0) {
    const idx = parseInt(ctx.split(":")[1], 10);
    const p = state.players[idx];
    return p ? p.items : null;
  }
  return null;
}

function recalcStockRow(ctx, id) {
  const items = stockCtxItems(ctx);
  if (!items) return;
  const it = items.find(x => x.id === id);
  if (!it) return;
  const r = findResource(id);
  const sumEl = $(`[data-stock-sum="${id}"][data-stock-ctx="${ctx}"]`);
  if (sumEl) sumEl.textContent = fmt((r.price || 0) * it.qty);
  const total = items.reduce((s, x) => s + (findResource(x.id).price || 0) * x.qty, 0);
  const totalEl = $(`[data-stock-total="${ctx}"]`);
  if (totalEl) totalEl.textContent = `${fmt(total)} ${pluralGayka(total)}`;
  const badge = $(`[data-stock-badge="${ctx}"]`);
  if (badge) badge.textContent = `${fmt(total)} ${pluralGayka(total)}`;
}

/* ============================================================================
   9. РЕНДЕР ВСЕГО
   ========================================================================== */
function renderAll() {
  rebuildIndex();
  renderCatalog();
  renderAuto();
  renderCraft();
  renderArmor();
  renderFaction();
  renderPlayers();
}

/* ============================================================================
   10. МОДАЛЬНЫЕ ОКНА
   ========================================================================== */
function closeModal(el) {
  if (!el) return;
  if (typeof el._cleanup === "function") el._cleanup();
  if (el.parentNode) el.parentNode.removeChild(el);
}

function modalShell(innerHtml) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal">${innerHtml}</div>`;
  document.body.appendChild(backdrop);

  const onKey = function (e) {
    if (e.key === "Escape") { closeModal(backdrop); }
  };
  backdrop._cleanup = function () { document.removeEventListener("keydown", onKey); };

  document.addEventListener("keydown", onKey);
  backdrop.addEventListener("mousedown", function (e) {
    if (e.target === backdrop) closeModal(backdrop);
  });
  return backdrop;
}

function openResourceModal(editId) {
  const isEdit = !!editId;
  const src = isEdit ? findResource(editId) : {
    id: "", name: "", price: 1, priceLabel: "", cat: "weapon", tier: "other", note: ""
  };

  const catOpts = Object.keys(CATS).map(k =>
    `<option value="${k}"${src.cat === k ? " selected" : ""}>${esc(CATS[k])}</option>`).join("");
  const tierOpts = TIERS.map(t =>
    `<option value="${t.id}"${src.tier === t.id ? " selected" : ""}>${esc(t.name)}</option>`).join("");

  const backdrop = modalShell(`
    <h2>${isEdit ? "Редактировать ресурс" : "Новый ресурс"}</h2>
    <label>ID (имя файла иконки)</label>
    <input class="field" id="rId" type="text" value="${esc(src.id)}" ${isEdit ? "disabled" : ""} placeholder="naprimer stvol_vintovka">
    <label>Название</label>
    <input class="field" id="rName" type="text" value="${esc(src.name)}" placeholder="Винтовочный ствол">
    <label>Цена за 1 шт. (гайки)</label>
    <input class="field" id="rPrice" type="number" min="0" step="1" value="${src.price}">
    <label>Подпись цены (если диапазон)</label>
    <input class="field" id="rPriceLabel" type="text" value="${esc(src.priceLabel || "")}" placeholder="например 3–4">
    <label>Тип</label>
    <select class="field" id="rCat">${catOpts}</select>
    <label>Редкость</label>
    <select class="field" id="rTier">${tierOpts}</select>
    <label>Комментарий</label>
    <input class="field" id="rNote" type="text" value="${esc(src.note || "")}" placeholder="необязательно">
    <div class="modal-error" id="mErr"></div>
    <div class="modal-actions">
      <button class="btn" id="mCancel">Отмена</button>
      <button class="btn btn-accent" id="mSave">Сохранить</button>
    </div>
  `);

  const err = $("#mErr", backdrop);
  $("#mCancel", backdrop).addEventListener("click", () => closeModal(backdrop));
  $("#mSave", backdrop).addEventListener("click", function () {
    const id = $("#rId", backdrop).value.trim();
    const name = $("#rName", backdrop).value.trim();
    const price = parseInt($("#rPrice", backdrop).value, 10);
    const priceLabel = $("#rPriceLabel", backdrop).value.trim();
    const cat = $("#rCat", backdrop).value;
    const tier = $("#rTier", backdrop).value;
    const note = $("#rNote", backdrop).value.trim();

    if (!id) { err.textContent = "ID обязателен"; return; }
    if (!name) { err.textContent = "Название обязательно"; return; }
    if (isNaN(price) || price < 0) { err.textContent = "Цена должна быть числом ≥ 0"; return; }

    if (isEdit) {
      state.edits[editId] = Object.assign({}, state.edits[editId], {
        name: name, price: price, priceLabel: priceLabel || null,
        cat: cat, tier: tier, note: note || null
      });
      const custom = state.custom.find(x => x.id === editId);
      if (custom) Object.assign(custom, state.edits[editId]);
    } else {
      if (resourceIndex.has(id)) { err.textContent = "Ресурс с таким ID уже существует"; return; }
      state.custom.push({
        id: id, name: name, price: price, priceLabel: priceLabel || null,
        cat: cat, tier: tier, note: note || null, out: true
      });
    }
    saveState();
    closeModal(backdrop);
    renderAll();
    setStatus(isEdit ? "Ресурс обновлён" : "Ресурс добавлен", "success", 2500);
  });

  $("#rId", backdrop).focus();
}

function openPlayerModal() {
  const backdrop = modalShell(`
    <h2>Новый игрок</h2>
    <label>Ник</label>
    <input class="field" id="pNick" type="text" placeholder="naprimer Ivan_Torg">
    <label>Роль</label>
    <input class="field" id="pRole" type="text" value="Участник фракции">
    <div class="modal-error" id="mErr"></div>
    <div class="modal-actions">
      <button class="btn" id="mCancel">Отмена</button>
      <button class="btn btn-accent" id="mSave">Создать</button>
    </div>
  `);
  const err = $("#mErr", backdrop);
  $("#mCancel", backdrop).addEventListener("click", () => closeModal(backdrop));
  $("#mSave", backdrop).addEventListener("click", function () {
    const nick = $("#pNick", backdrop).value.trim();
    const role = $("#pRole", backdrop).value.trim() || "Участник фракции";
    if (!nick) { err.textContent = "Введите ник"; return; }
    if (state.players.some(p => p.player.toLowerCase() === nick.toLowerCase())) {
      err.textContent = "Игрок уже есть"; return;
    }
    state.players.push({ player: nick, role: role, items: [] });
    saveState(); closeModal(backdrop); renderAll();
    setStatus("Игрок добавлен", "success", 2500);
  });
  $("#pNick", backdrop).focus();
}

function openPasswordModal() {
  const backdrop = modalShell(`
    <h2>Вход в режим редактирования</h2>
    <label>Пароль</label>
    <input class="field" type="password" id="pwd" autofocus>
    <div class="modal-error" id="mErr"></div>
    <div class="modal-actions">
      <button class="btn" id="mCancel">Отмена</button>
      <button class="btn btn-accent" id="mOk">Войти</button>
    </div>
  `);
  const err = $("#mErr", backdrop);
  const input = $("#pwd", backdrop);
  const close = () => closeModal(backdrop);
  const attempt = function () {
    if (input.value === CONFIG.editPassword) { close(); setEditMode(true); }
    else { err.textContent = "Неверный пароль"; input.value = ""; input.focus(); }
  };
  $("#mCancel", backdrop).addEventListener("click", close);
  $("#mOk", backdrop).addEventListener("click", attempt);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") attempt();
    if (e.key === "Escape") close();
  });
  input.focus();
}

function setEditMode(on) {
  editMode = on;
  const btn = $("#editToggle");
  btn.classList.toggle("is-on", on);
  btn.textContent = on ? "🔓 Редактирование включено" : "🔒 Режим редактирования";
  const addBtn = $("#addResourceBtn");
  if (addBtn) addBtn.hidden = !on;
  const addPlayerBtn = $("#addPlayerBtn");
  if (addPlayerBtn) addPlayerBtn.hidden = !on;
  const resetBtn = $("#resetPricesBtn");
  if (resetBtn) resetBtn.hidden = !on;
  renderAll();
  setStatus(on ? "Режим редактирования включён" : "Режим редактирования выключен", "info", 2200);
}

/* ============================================================================
   11. ЭКСПОРТ: ОБЩИЕ ХЕЛПЕРЫ
   ========================================================================== */
async function loadCyrillicFont(doc) {
  const urls = [
    "https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/src/hinted/Roboto-Regular.ttf",
    "https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf"
  ];
  for (let i = 0; i < urls.length; i++) {
    try {
      const res = await fetch(urls[i]);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
      doc.addFileToVFS("Roboto-Regular.ttf", btoa(binary));
      doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
      return true;
    } catch (e) { console.warn("Шрифт не загружен с", urls[i], e); }
  }
  return false;
}

async function newPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const ok = await loadCyrillicFont(doc);
  if (!ok) throw new Error("не удалось загрузить шрифт с кириллицей");
  doc.setFont("Roboto");
  return doc;
}

function pdfPageSize(doc) {
  return { w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight() };
}

function pdfDocHeader(doc, title, subtitle) {
  const { w } = pdfPageSize(doc);
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text(title, 14, 18);
  doc.setFontSize(8.5);
  doc.setTextColor(120);
  doc.text(subtitle, 14, 24);
  doc.setTextColor(0);
  doc.setDrawColor(212, 160, 23);
  doc.setLineWidth(0.6);
  doc.line(14, 27, w - 14, 27);
  return 33;
}

function pdfSectionTitle(doc, text, y) {
  const { h } = pdfPageSize(doc);
  if (y > h - 30) { doc.addPage(); y = 20; }
  doc.setFont("Roboto");
  doc.setFontSize(11);
  doc.setTextColor(184, 134, 11);
  doc.text(text, 14, y);
  doc.setTextColor(0);
  return y + 3;
}

function pdfTable(doc, opts) {
  const { w, h } = pdfPageSize(doc);
  const ICON = opts.iconSize || 5;
  const ids = opts.ids || [];

  doc.autoTable({
    startY: opts.startY,
    head: opts.head,
    body: opts.body,
    foot: opts.foot,
    styles: { font: "Roboto", fontSize: 7.8, cellPadding: 1.4, minCellHeight: opts.rowHeight || 7 },
    headStyles: { font: "Roboto", fillColor: [36, 42, 52], textColor: [240, 192, 64], fontStyle: "bold", fontSize: 7.6 },
    footStyles: { font: "Roboto", fillColor: [30, 36, 46], textColor: [240, 192, 64], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 247, 249] },
    columnStyles: opts.columnStyles || {},
    margin: { left: 14, right: 14, bottom: 18 },
    didDrawCell: function (data) {
      if (data.section !== "body" || data.column.index !== 0) return;
      const id = ids[data.row.index];
      const dataUrl = id ? iconData(id) : null;
      if (!dataUrl) return;
      const x = data.cell.x + (data.cell.width - ICON) / 2;
      const y = data.cell.y + (data.cell.height - ICON) / 2;
      try { doc.addImage(dataUrl, "PNG", x, y, ICON, ICON); } catch (e) { /* пропускаем */ }
    },
    didDrawPage: function (data) {
      doc.setFont("Roboto");
      doc.setFontSize(7.5);
      doc.setTextColor(150);
      doc.text("Кооператив · прайс в гайках", 14, h - 8);
      doc.text("Страница " + data.pageNumber, w - 26, h - 8);
      doc.setTextColor(0);
    }
  });

  return doc.lastAutoTable.finalY + 6;
}

async function htmlToPng(innerHtml, filename, statusLabel) {
  const seal = await Seal.get();

  const wrap = document.createElement("div");
  wrap.style.cssText =
    "position:fixed;left:-99999px;top:0;background:#ffffff;color:#111;" +
    "font-family:'Segoe UI',Roboto,Arial,sans-serif;padding:26px;width:1080px;";
  wrap.innerHTML = innerHtml;
  document.body.appendChild(wrap);

  await new Promise(r => setTimeout(r, 350));

  const canvas = await window.html2canvas(wrap, {
    backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false
  });
  if (seal) await Seal.stampCanvas(canvas);

  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  document.body.removeChild(wrap);
  setStatus(statusLabel || "PNG сгенерирован", "success", 3000);
}

function pngShell(title, subtitle, bodyHtml) {
  return `
    <h1 style="font-size:23px;margin:0 0 3px;color:#111;letter-spacing:.2px;">${esc(title)}</h1>
    <div style="color:#6b7280;font-size:12.5px;margin-bottom:18px;">${esc(subtitle)}</div>
    ${bodyHtml}`;
}

function pngTable(head, rows, opts) {
  const o = opts || {};
  const radius = o.alignRightFrom;

  const headHtml = head.map(function (h, i) {
    const align = (radius !== undefined && i >= radius) ? "right" : "left";
    return `<th style="padding:6px 7px;text-align:${align};font-size:11.5px;letter-spacing:.3px;">${esc(h)}</th>`;
  }).join("");

  const bodyHtml = rows.map(function (row, ri) {
    const id = o.ids ? o.ids[ri] : null;
    const dataUrl = id ? iconData(id) : null;
    const tds = [];
    tds.push(`<td style="padding:3px 5px;text-align:center;border-bottom:1px solid #eceff3;width:32px;">
      ${dataUrl ? `<img src="${dataUrl}" style="width:20px;height:20px;image-rendering:pixelated;vertical-align:middle;">` : ""}
    </td>`);
    row.forEach(function (cell, ci) {
      const align = (radius !== undefined && ci >= radius) ? "right" : "left";
      const bold = o.boldFrom !== undefined && ci >= o.boldFrom;
      const color = bold ? "#b8860b" : "#1f2937";
      const weight = bold ? "700" : "400";
      const mono = (radius !== undefined && ci >= radius) ? "font-family:Consolas,monospace;" : "";
      tds.push(`<td style="padding:4px 7px;text-align:${align};border-bottom:1px solid #eceff3;color:${color};font-weight:${weight};${mono}">${esc(cell)}</td>`);
    });
    const bg = ri % 2 ? "#f7f8fa" : "#ffffff";
    return `<tr style="background:${bg};">${tds.join("")}</tr>`;
  }).join("");

  const footHtml = o.foot
    ? `<tfoot><tr style="background:#1e2430;color:#f0c040;font-weight:700;">
         ${o.foot.map(function (c, ci) {
           const align = ci >= o.foot.length - 2 ? "right" : "left";
           return `<td colspan="${ci === 0 ? 2 : 1}" style="padding:6px 7px;text-align:${align};font-size:12px;">${esc(c)}</td>`;
         }).join("")}
       </tr></tfoot>`
    : "";

  return `
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:14px;">
      <thead><tr style="background:#f0c040;color:#111;">${headHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
      ${footHtml}
    </table>`;
}

function pngSection(title, subtitle, head, rows, opts) {
  return `
    <h2 style="font-size:14px;color:#b8860b;margin:20px 0 2px;letter-spacing:.2px;">${esc(title)}</h2>
    ${subtitle ? `<div style="font-size:11.5px;color:#8a93a0;margin-bottom:6px;">${esc(subtitle)}</div>` : ""}
    ${pngTable(head, rows, opts)}`;
}

function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const stamp = () => new Date().toISOString().slice(0, 10);

async function withBusy(btn, busyLabel, fn) {
  const original = btn ? btn.textContent : "";
  if (btn) { btn.disabled = true; btn.textContent = busyLabel; }
  try {
    await fn();
  } catch (e) {
    console.error(e);
    setStatus("Ошибка экспорта: " + (e && e.message ? e.message : e), "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = original; }
  }
}

/* ============================================================================
   12. ЭКСПОРТ: КАТАЛОГ
   ========================================================================== */
async function exportCatalogPdf(btn) {
  await withBusy(btn, "⏳ Генерация…", async function () {
    const list = filteredCatalog();
    if (!list.length) { setStatus("Нечего экспортировать: пустой список", "error", 3000); return; }

    setStatus("Загрузка шрифта и иконок…", "info");
    await preloadIcons(list.map(r => r.id));

    const doc = await newPdf();
    setStatus("Генерация PDF…", "info");

    let y = pdfDocHeader(doc,
      "Кооператив — Каталог ресурсов",
      `Прайс-лист в гайках · обновлено ${new Date().toLocaleString("ru-RU")}`);

    const byTier = new Map();
    TIERS.forEach(t => byTier.set(t.id, []));
    list.forEach(r => {
      const key = byTier.has(r.tier) ? r.tier : "other";
      byTier.get(key).push(r);
    });

    TIERS.forEach(function (t) {
      const items = byTier.get(t.id);
      if (!items || !items.length) return;
      const sum = items.reduce((s, r) => s + (r.price || 0), 0);
      y = pdfSectionTitle(doc, `${t.name} — ${items.length} поз. (${fmt(sum)} гаек)`, y);
      y = pdfTable(doc, {
        startY: y,
        head: [["", "Ресурс", "Тип", "Цена, гайки", "Комментарий"]],
        body: items.map(r => ["", r.name, CATS[r.cat] || "—", priceText(r), r.note || ""]),
        ids: items.map(r => r.id),
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 74 },
          2: { cellWidth: 31 },
          3: { cellWidth: 24, halign: "right" },
          4: { cellWidth: "auto" }
        }
      });
    });

    await Seal.stampPdfAllPages(doc);
    doc.save(`koop-catalog-${stamp()}.pdf`);
    setStatus("PDF-каталог готов", "success", 3000);
  });
}

async function exportCatalogPng(btn) {
  await withBusy(btn, "⏳ Генерация…", async function () {
    const list = filteredCatalog();
    if (!list.length) { setStatus("Нечего экспортировать: пустой список", "error", 3000); return; }
    setStatus("Загрузка иконок…", "info");
    await preloadIcons(list.map(r => r.id));

    const byTier = new Map();
    TIERS.forEach(t => byTier.set(t.id, []));
    list.forEach(r => {
      const key = byTier.has(r.tier) ? r.tier : "other";
      byTier.get(key).push(r);
    });

    let body = "";
    TIERS.forEach(function (t) {
      const items = byTier.get(t.id);
      if (!items || !items.length) return;
      body += pngSection(t.name, t.hint,
        ["Ресурс", "Тип", "Цена, гайки"],
        items.map(r => [r.name, CATS[r.cat] || "—", priceText(r)]),
        { ids: items.map(r => r.id), alignRightFrom: 2, boldFrom: 2 });
    });

    await htmlToPng(
      pngShell("Кооператив — Каталог ресурсов",
        `Прайс-лист в гайках · ${list.length} позиций · ${new Date().toLocaleString("ru-RU")}`,
        body),
      `koop-catalog-${stamp()}.png`,
      "PNG-каталог готов"
    );
  });
}

function exportCatalogXlsx(btn) {
  withBusy(btn, "⏳ Генерация…", function () {
    const list = filteredCatalog().slice().sort(function (a, b) {
      const ta = tierOf(a.tier).order, tb = tierOf(b.tier).order;
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name, "ru");
    });
    if (!list.length) { setStatus("Нечего экспортировать: пустой список", "error", 3000); return; }

    const data = [
      ["Редкость", "Ресурс", "ID", "Тип", "Цена за 1 шт. (гайки)", "Комментарий"]
    ].concat(list.map(r => [
      tierOf(r.tier).name, r.name, r.id, CATS[r.cat] || "—",
      r.price, r.note || ""
    ]));

    const ws = window.XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 18 }, { wch: 34 }, { wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 34 }];
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Каталог");
    window.XLSX.writeFile(wb, `koop-catalog-${stamp()}.xlsx`);
    setStatus("Excel-каталог готов", "success", 3000);
  });
}

/* ============================================================================
   13. ЭКСПОРТ: СКЛАДЫ
   ========================================================================== */
function stockExportBlocks() {
  const blocks = [{ title: "Склад фракции", items: state.faction }];
  state.players.forEach(p => blocks.push({ title: `${p.player} (${p.role})`, items: p.items }));
  return blocks;
}

async function exportStocksPdf(btn) {
  await withBusy(btn, "⏳ Генерация…", async function () {
    const blocks = stockExportBlocks();
    const ids = new Set();
    blocks.forEach(b => b.items.forEach(it => ids.add(it.id)));

    setStatus("Загрузка шрифта и иконок…", "info");
    await preloadIcons([...ids]);

    const doc = await newPdf();
    setStatus("Генерация PDF…", "info");

    let y = pdfDocHeader(doc, "Кооператив — Склады",
      `Оценка по прайсу в гайках · обновлено ${new Date().toLocaleString("ru-RU")}`);

    blocks.forEach(function (block) {
      const rows = stockRows(block.items, "")
        .filter(r => r.qty > 0);
      const total = stockTotal(rows);
      const { h } = pdfPageSize(doc);
      if (y > h - 40) { doc.addPage(); y = 20; }

      y = pdfSectionTitle(doc, `${block.title} — ${rows.length} поз., ${fmt(total)} гаек`, y);
      if (!rows.length) {
        doc.setFontSize(8.5);
        doc.setTextColor(150);
        doc.text("Склад пуст", 18, y + 5);
        doc.setTextColor(0);
        y += 12;
        return;
      }
      y = pdfTable(doc, {
        startY: y,
        head: [["", "Ресурс", "Тип", "Цена", "Кол-во", "Стоимость"]],
        body: rows.map(r => ["", r.res.name, CATS[r.res.cat] || "—",
          priceText(r.res), String(r.qty), fmt((r.res.price || 0) * r.qty)]),
        foot: [["", "Итого", "", "", "", fmt(total) + " г."]],
        ids: rows.map(r => r.res.id),
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 66 },
          2: { cellWidth: 30 },
          3: { cellWidth: 20, halign: "right" },
          4: { cellWidth: 18, halign: "right" },
          5: { cellWidth: "auto", halign: "right" }
        }
      });
    });

    await Seal.stampPdfAllPages(doc);
    doc.save(`koop-stocks-${stamp()}.pdf`);
    setStatus("PDF по складам готов", "success", 3000);
  });
}

async function exportStocksPng(btn) {
  await withBusy(btn, "⏳ Генерация…", async function () {
    const blocks = stockExportBlocks();
    const ids = new Set();
    blocks.forEach(b => b.items.forEach(it => ids.add(it.id)));
    setStatus("Загрузка иконок…", "info");
    await preloadIcons([...ids]);

    let body = "";
    blocks.forEach(function (block) {
      const rows = stockRows(block.items, "").filter(r => r.qty > 0);
      const total = stockTotal(rows);
      if (!rows.length) {
        body += `<h2 style="font-size:14px;color:#b8860b;margin:20px 0 4px;">${esc(block.title)}</h2>
                 <div style="color:#9aa2ae;font-style:italic;font-size:12.5px;">Склад пуст</div>`;
        return;
      }
      body += pngSection(block.title, `${rows.length} позиций · ${fmt(total)} гаек`,
        ["Ресурс", "Тип", "Цена", "Кол-во", "Стоимость"],
        rows.map(r => [r.res.name, CATS[r.res.cat] || "—", priceText(r.res),
          String(r.qty), fmt((r.res.price || 0) * r.qty)]),
        { ids: rows.map(r => r.res.id), alignRightFrom: 2, boldFrom: 4 });
    });

    await htmlToPng(
      pngShell("Кооператив — Склады",
        `Оценка по прайсу в гайках · ${new Date().toLocaleString("ru-RU")}`, body),
      `koop-stocks-${stamp()}.png`,
      "PNG по складам готов"
    );
  });
}

function exportStocksXlsx(btn) {
  withBusy(btn, "⏳ Генерация…", function () {
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    const blocks = stockExportBlocks();
    let sheets = 0;

    blocks.forEach(function (block) {
      const rows = stockRows(block.items, "");
      const total = stockTotal(rows);
      const data = [
        ["Ресурс", "Тип", "Цена за 1 шт.", "Количество", "Стоимость"]
      ].concat(rows.map(r => [
        r.res.name, CATS[r.res.cat] || "—", r.res.price, r.qty, (r.res.price || 0) * r.qty
      ])).concat([["", "", "", "ИТОГО:", total]]);

      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = [{ wch: 34 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, block.title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
      sheets++;
    });

    if (!sheets) { setStatus("Нет складов для экспорта", "error", 3000); return; }
    XLSX.writeFile(wb, `koop-stocks-${stamp()}.xlsx`);
    setStatus("Excel по складам готов", "success", 3000);
  });
}

/* ============================================================================
   14. ЭКСПОРТ: КРАФТ АВТО
   ========================================================================== */
async function exportAutoPdf(btn) {
  await withBusy(btn, "⏳ Генерация…", async function () {
    const groups = autoGroupsResolved();
    const totals = autoTotals(groups);
    const ids = [];
    groups.forEach(g => g.resolved.forEach(it => ids.push(it.id)));

    setStatus("Загрузка шрифта и иконок…", "info");
    await preloadIcons(ids);

    const doc = await newPdf();
    let y = pdfDocHeader(doc, "Кооператив — Ресурсы для сборки авто",
      `Комплектация по системам · комплект целиком: ${fmt(totals.sum)} гаек · ${new Date().toLocaleString("ru-RU")}`);

    groups.forEach(function (g) {
      const sum = g.resolved.reduce((s, it) => s + it.price * it.need, 0);
      y = pdfSectionTitle(doc, `${g.title} — ${fmt(sum)} гаек`, y);
      y = pdfTable(doc, {
        startY: y,
        head: [["", "Ресурс", "Редкость", "Нужно", "На складе", "Цена", "Сумма"]],
        body: g.resolved.map(it => ["", it.name, it.tier.name, String(it.need),
          String(it.have), priceText(it), fmt(it.price * it.need)]),
        ids: g.resolved.map(it => it.id),
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 62 },
          2: { cellWidth: 30 },
          3: { cellWidth: 16, halign: "right" },
          4: { cellWidth: 18, halign: "right" },
          5: { cellWidth: 18, halign: "right" },
          6: { cellWidth: "auto", halign: "right" }
        }
      });
    });

    await Seal.stampPdfAllPages(doc);
    doc.save(`koop-auto-craft-${stamp()}.pdf`);
    setStatus("PDF по крафту авто готов", "success", 3000);
  });
}

async function exportAutoPng(btn) {
  await withBusy(btn, "⏳ Генерация…", async function () {
    const groups = autoGroupsResolved();
    const totals = autoTotals(groups);
    const ids = [];
    groups.forEach(g => g.resolved.forEach(it => ids.push(it.id)));
    setStatus("Загрузка иконок…", "info");
    await preloadIcons(ids);

    let body = `<div style="display:flex;gap:12px;margin-bottom:16px;">
      <div style="border:1px solid #e3e7ec;border-radius:8px;padding:10px 14px;">
        <div style="font-size:10.5px;color:#8a93a0;text-transform:uppercase;letter-spacing:.6px;">Комплект целиком</div>
        <div style="font-size:20px;font-weight:700;color:#b8860b;">${fmt(totals.sum)} гаек</div>
      </div>
      <div style="border:1px solid #e3e7ec;border-radius:8px;padding:10px 14px;">
        <div style="font-size:10.5px;color:#8a93a0;text-transform:uppercase;letter-spacing:.6px;">Позиций</div>
        <div style="font-size:20px;font-weight:700;">${fmt(totals.positions)}</div>
      </div>
    </div>`;

    groups.forEach(function (g) {
      const sum = g.resolved.reduce((s, it) => s + it.price * it.need, 0);
      body += pngSection(`${g.title} — ${fmt(sum)} гаек`, g.hint,
        ["Ресурс", "Редкость", "Нужно", "Цена", "Сумма"],
        g.resolved.map(it => [it.name, it.tier.name, String(it.need), priceText(it), fmt(it.price * it.need)]),
        { ids: g.resolved.map(it => it.id), alignRightFrom: 2, boldFrom: 4 });
    });

    await htmlToPng(
      pngShell("Кооператив — Ресурсы для сборки авто",
        `Комплектация по системам · ${new Date().toLocaleString("ru-RU")}`, body),
      `koop-auto-craft-${stamp()}.png`,
      "PNG по крафту авто готов"
    );
  });
}

function exportAutoXlsx(btn) {
  withBusy(btn, "⏳ Генерация…", function () {
    const groups = autoGroupsResolved();
    const data = [
      ["Система", "Ресурс", "Редкость", "Тип", "Нужно", "На складе", "Цена за 1 шт.", "Сумма"]
    ];
    groups.forEach(function (g) {
      g.resolved.forEach(function (it) {
        data.push([g.title, it.name, it.tier.name, CATS[findResource(it.id).cat] || "—",
          it.need, it.have, it.price, it.price * it.need]);
      });
    });
    const totals = autoTotals(groups);
    data.push(["", "", "", "", "", "", "ИТОГО:", totals.sum]);

    const ws = window.XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 22 }, { wch: 34 }, { wch: 16 }, { wch: 16 },
                   { wch: 9 }, { wch: 11 }, { wch: 15 }, { wch: 12 }];
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Крафт авто");
    window.XLSX.writeFile(wb, `koop-auto-craft-${stamp()}.xlsx`);
    setStatus("Excel по крафту авто готов", "success", 3000);
  });
}

/* ============================================================================
   15. ЭКСПОРТ: БРОНЯ ТИР-5
   ========================================================================== */
async function exportArmorPdf(btn) {
  await withBusy(btn, "⏳ Генерация…", async function () {
    const ids = [];
    ARMOR_SETS.forEach(s => s.resources.forEach(p => ids.push(p[0])));
    setStatus("Загрузка шрифта и иконок…", "info");
    await preloadIcons(ids);

    const doc = await newPdf();
    let y = pdfDocHeader(doc, "Кооператив — Броня тир-5",
      `Рецепты из прайса · цена включает 15% за сборку · ${new Date().toLocaleString("ru-RU")}`);

    ARMOR_SETS.forEach(function (set) {
      const rows = set.resources.map(function (pair) {
        const r = findResource(pair[0]);
        return { id: r.id, name: r.name, qty: pair[1], price: r.price || 0 };
      });
      const cost = rows.reduce((s, r) => s + r.price * r.qty, 0);
      y = pdfSectionTitle(doc, `${set.title} — ${fmt(set.price)} гаек (ресурсы по прайсу: ${fmt(cost)})`, y);
      y = pdfTable(doc, {
        startY: y,
        head: [["", "Ресурс", "Кол-во", "Цена", "Стоимость"]],
        body: rows.map(r => ["", r.name, String(r.qty), fmt(r.price), fmt(r.price * r.qty)]),
        ids: rows.map(r => r.id),
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 84 },
          2: { cellWidth: 22, halign: "right" },
          3: { cellWidth: 24, halign: "right" },
          4: { cellWidth: "auto", halign: "right" }
        }
      });
    });

    await Seal.stampPdfAllPages(doc);
    doc.save(`koop-armor-t5-${stamp()}.pdf`);
    setStatus("PDF по броне тир-5 готов", "success", 3000);
  });
}

async function exportArmorPng(btn) {
  await withBusy(btn, "⏳ Генерация…", async function () {
    const ids = [];
    ARMOR_SETS.forEach(s => s.resources.forEach(p => ids.push(p[0])));
    setStatus("Загрузка иконок…", "info");
    await preloadIcons(ids);

    let body = "";
    ARMOR_SETS.forEach(function (set) {
      const rows = set.resources.map(function (pair) {
        const r = findResource(pair[0]);
        return { id: r.id, name: r.name, qty: pair[1], price: r.price || 0 };
      });
      const cost = rows.reduce((s, r) => s + r.price * r.qty, 0);
      body += pngSection(`${set.title} — ${fmt(set.price)} гаек`,
        `Ресурсы по прайсу: ${fmt(cost)} гаек · в цену включена 15% надбавка за сборку`,
        ["Ресурс", "Кол-во", "Цена", "Стоимость"],
        rows.map(r => [r.name, String(r.qty), fmt(r.price), fmt(r.price * r.qty)]),
        { ids: rows.map(r => r.id), alignRightFrom: 1, boldFrom: 3 });
    });

    await htmlToPng(
      pngShell("Кооператив — Броня тир-5",
        `Рецепты из прайса · ${new Date().toLocaleString("ru-RU")}`, body),
      `koop-armor-t5-${stamp()}.png`,
      "PNG по броне тир-5 готов"
    );
  });
}

function exportArmorXlsx(btn) {
  withBusy(btn, "⏳ Генерация…", function () {
    const data = [["Сет", "Цена сета", "Ресурс", "Количество", "Цена за 1 шт.", "Стоимость"]];
    ARMOR_SETS.forEach(function (set) {
      set.resources.forEach(function (pair) {
        const r = findResource(pair[0]);
        data.push([set.title, set.price, r.name, pair[1], r.price || 0, (r.price || 0) * pair[1]]);
      });
    });
    const ws = window.XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 24 }, { wch: 13 }, { wch: 34 }, { wch: 12 }, { wch: 15 }, { wch: 13 }];
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Броня тир-5");
    window.XLSX.writeFile(wb, `koop-armor-t5-${stamp()}.xlsx`);
    setStatus("Excel по броне тир-5 готов", "success", 3000);
  });
}

/* ============================================================================
   16. JSON: ЭКСПОРТ / ИМПОРТ / СБРОС
   ========================================================================== */
function exportJson() {
  const payload = Object.assign({ dataVersion: CONFIG.dataVersion }, state);
  download(`koop-backup-${stamp()}.json`,
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  setStatus("Резервная копия JSON скачана", "success", 3000);
}

function importJson() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", function () {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const parsed = JSON.parse(e.target.result);
        const looksNew = parsed && (parsed.edits || parsed.custom ||
          parsed.faction || parsed.players || parsed.autoNeed);
        const looksOld = parsed && Array.isArray(parsed.resources);
        if (!looksNew && !looksOld) throw new Error("неверный формат файла");

        if (!confirm("Заменить текущие данные импортированными?")) return;

        if (looksOld) {
          // Старый бэкап: забираем склады, цены — из прайса.
          const migrated = makeDefaultState();
          migrated.faction = normalizeStockList(parsed.faction);
          if (Array.isArray(parsed.players) && parsed.players.length) {
            migrated.players = normalizePlayers(parsed.players);
          }
          replaceState(migrated);
        } else {
          replaceState(parsed);
        }
        saveState();
        renderAll();
        setStatus("Импорт выполнен", "success", 3000);
      } catch (err) {
        setStatus("Ошибка импорта: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

function resetPrices() {
  if (!confirm("Сбросить цены и каталог к исходному прайсу?\nПравки, удаления и добавленные ресурсы будут потеряны. Склады сохранятся.")) return;
  state.edits = {};
  state.custom = [];
  state.removed = [];
  saveState();
  renderAll();
  setStatus("Каталог сброшен к прайсу", "success", 3000);
}

/* ============================================================================
   17. СОБЫТИЯ
   ========================================================================== */
function bindEvents() {
  /* --- табы --- */
  $("#tabs").addEventListener("click", function (e) {
    const tab = e.target.closest("[data-view]");
    if (!tab) return;
    const name = tab.dataset.view;
    $$("#tabs .tab").forEach(t => t.classList.toggle("active", t === tab));
    $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + name));
    if (history.replaceState) history.replaceState(null, "", "#" + name);
  });

  /* --- каталог --- */
  $("#search").addEventListener("input", debounce(function (e) {
    view.search = e.target.value;
    renderCatalog();
  }, 120));
  $("#categoryFilter").addEventListener("change", function (e) {
    view.cat = e.target.value;
    renderCatalog();
  });
  $("#sortBy").addEventListener("change", function (e) {
    view.sort = e.target.value;
    renderCatalog();
  });
  $("#addResourceBtn").addEventListener("click", () => openResourceModal(null));

  /* --- склад фракции / участников --- */
  $("#searchFaction").addEventListener("input", debounce(renderFaction, 120));
  $("#searchPlayers").addEventListener("input", debounce(renderPlayers, 120));
  $("#addPlayerBtn").addEventListener("click", openPlayerModal);

  /* --- общий делегированный обработчик --- */
  document.addEventListener("click", function (e) {
    const t = e.target;

    /* ресурс: правка */
    const editBtn = t.closest("[data-act='edit-resource']");
    if (editBtn) {
      const card = editBtn.closest("[data-id]");
      if (card) openResourceModal(card.dataset.id);
      return;
    }

    /* ресурс: удаление */
    const delBtn = t.closest("[data-act='delete-resource']");
    if (delBtn) {
      const card = delBtn.closest("[data-id]");
      if (!card) return;
      const id = card.dataset.id;
      const r = findResource(id);
      if (!confirm(`Удалить «${r.name}» из каталога?`)) return;
      if (state.custom.some(x => x.id === id)) {
        state.custom = state.custom.filter(x => x.id !== id);
      } else {
        state.removed.push(id);
      }
      delete state.edits[id];
      state.faction = state.faction.filter(x => x.id !== id);
      state.players.forEach(p => { p.items = p.items.filter(x => x.id !== id); });
      saveState();
      renderAll();
      setStatus("Ресурс удалён", "info", 2500);
      return;
    }

    /* склады: удалить строку */
    const removeBtn = t.closest("[data-stock-remove]");
    if (removeBtn) {
      const id = removeBtn.dataset.stockRemove;
      const ctx = removeBtn.dataset.stockCtx;
      const items = stockCtxItems(ctx);
      if (!items) return;
      const idx = items.findIndex(x => x.id === id);
      if (idx !== -1) items.splice(idx, 1);
      saveState();
      renderAll();
      return;
    }

    /* склады: очистить */
    const clearBtn = t.closest("[data-stock-clear]");
    if (clearBtn) {
      const ctx = clearBtn.dataset.stockClear;
      const items = stockCtxItems(ctx);
      if (!items) return;
      if (!confirm("Очистить склад?")) return;
      items.length = 0;
      saveState();
      renderAll();
      return;
    }

    /* склады: добавить ресурс */
    const addBtn2 = t.closest("[data-add-submit]");
    if (addBtn2) {
      const ctx = addBtn2.dataset.addSubmit;
      const items = stockCtxItems(ctx);
      if (!items) return;
      const wrap = addBtn2.closest(".add-bar");
      const sel = wrap.querySelector("[data-add-select]");
      const qtyInput = wrap.querySelector("[data-add-qty]");
      const id = ALIASES[sel.value] || sel.value;
      const count = parseInt(qtyInput.value, 10);
      if (!id) { setStatus("Выберите ресурс", "error", 2500); return; }
      if (isNaN(count) || count <= 0) { setStatus("Количество должно быть больше нуля", "error", 2500); return; }
      const existing = items.find(x => x.id === id);
      if (existing) existing.qty += count;
      else items.push({ id: id, qty: count });
      saveState();
      renderAll();
      setStatus("Добавлено на склад: " + findResource(id).name, "success", 2200);
      return;
    }

    /* игрок: удалить */
    const delPlayer = t.closest("[data-del-player]");
    if (delPlayer) {
      const idx = parseInt(delPlayer.dataset.delPlayer, 10);
      const p = state.players[idx];
      if (!p) return;
      if (!confirm(`Удалить игрока ${p.player}?`)) return;
      state.players.splice(idx, 1);
      saveState();
      renderAll();
      return;
    }
  });

  /* количества на складах */
  document.addEventListener("input", function (e) {
    const inp = e.target;
    if (inp.matches("[data-stock-qty]")) {
      const id = inp.dataset.stockQty;
      const ctx = inp.dataset.stockCtx;
      const items = stockCtxItems(ctx);
      if (!items) return;
      const it = items.find(x => x.id === id);
      if (!it) return;
      const val = parseInt(inp.value, 10);
      it.qty = isNaN(val) || val < 0 ? 0 : val;
      if (inp.value !== String(it.qty)) inp.value = it.qty;
      recalcStockRow(ctx, id);
      return;
    }
    if (inp.matches("[data-auto-qty]")) {
      const id = inp.dataset.autoQty;
      const val = parseInt(inp.value, 10);
      state.autoNeed[id] = isNaN(val) || val < 0 ? 0 : val;
      const row = inp.closest("[data-auto-id]");
      const group = row ? row.closest("[data-group]") : null;
      recalcAuto(group ? group.dataset.group : null);
      return;
    }
  });

  /* смена значений — фиксируем в localStorage */
  document.addEventListener("change", function (e) {
    const inp = e.target;
    if (inp.matches("[data-stock-qty]") || inp.matches("[data-auto-qty]")) saveState();
  });

  /* шапка */
  $("#editToggle").addEventListener("click", function () {
    if (editMode) setEditMode(false);
    else openPasswordModal();
  });
  $("#exportJsonBtn").addEventListener("click", exportJson);
  $("#importBtn").addEventListener("click", importJson);
  $("#resetPricesBtn").addEventListener("click", resetPrices);

  /* экспорт */
  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-export]");
    if (!btn) return;
    const kind = btn.dataset.export;
    const map = {
      "catalog-pdf": exportCatalogPdf, "catalog-png": exportCatalogPng, "catalog-xlsx": exportCatalogXlsx,
      "stocks-pdf": exportStocksPdf,   "stocks-png": exportStocksPng,   "stocks-xlsx": exportStocksXlsx,
      "auto-pdf": exportAutoPdf,       "auto-png": exportAutoPng,       "auto-xlsx": exportAutoXlsx,
      "armor-pdf": exportArmorPdf,     "armor-png": exportArmorPng,     "armor-xlsx": exportArmorXlsx
    };
    const fn = map[kind];
    if (fn) fn(btn);
  });
}

function recalcAutoTotals() {
  const groups = autoGroupsResolved();
  const totals = autoTotals(groups);
  const el = $("#autoTotalSum");
  if (el) el.innerHTML = `${fmt(totals.sum)} <small>${pluralGayka(totals.sum)}</small>`;
  const covered = $("[data-auto-covered]");
  if (covered) covered.innerHTML = `${fmt(totals.covered)} <small>из ${fmt(totals.positions)}</small>`;
}

/* ============================================================================
   18. СТАРТ
   ========================================================================== */
function fillCategoryFilter() {
  const sel = $("#categoryFilter");
  const used = new Set(allResources().map(r => r.cat));
  sel.innerHTML = `<option value="">Все типы</option>` +
    Object.keys(CATS)
      .filter(k => used.has(k))
      .map(k => `<option value="${k}">${esc(CATS[k])}</option>`)
      .join("");
}

function init() {
  loadState();
  rebuildIndex();
  buildTierChips();
  fillCategoryFilter();
  bindEvents();
  renderAll();

  const hash = (location.hash || "").replace("#", "");
  if (hash && $("#view-" + hash)) {
    const tab = $(`#tabs .tab[data-view="${hash}"]`);
    if (tab) tab.click();
  }

  setStatus("Прайс загружен · данные хранятся в браузере", "info", 3500);
}

document.addEventListener("DOMContentLoaded", init);