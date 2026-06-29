const STORAGE_KEY = "keyword-workbench-v1";

const defaultCategories = [
  "核心类目词",
  "长尾需求词",
  "功能卖点词",
  "尺寸规格词",
  "材质结构词",
  "颜色风格词",
  "人群场景词",
  "竞品品牌词",
  "否词候选",
  "待判断"
];

let categories = [...defaultCategories];
let currentPage = 1;
let pageSize = 100;

const actions = [
  "优先处理",
  "Listing 埋词",
  "标题核心词",
  "内容扩展词",
  "单独观察",
  "否词",
  "人工复核"
];

const statuses = [
  "待判断",
  "可处理",
  "已放入 Listing",
  "否词候选",
  "观察中"
];

const sampleKeywords = [
  { term: "queen bed frame", searchVolume: "60500" },
  { term: "metal bed frame", searchVolume: "49500" },
  { term: "no box spring needed bed frame", searchVolume: "18100" },
  { term: "14 inch bed frame queen", searchVolume: "14800" },
  { term: "bed frame with storage", searchVolume: "40500" },
  { term: "noise free bed frame", searchVolume: "5400" },
  { term: "black metal platform bed frame", searchVolume: "6600" },
  { term: "bed frame for small apartment", searchVolume: "1900" },
  { term: "zinus bed frame", searchVolume: "22200" },
  { term: "wood bed frame", searchVolume: "27100" },
  { term: "cheap bed frame queen", searchVolume: "8100" },
  { term: "heavy duty metal bed frame queen", searchVolume: "12100" }
];

let keywords = [];
let selectedId = null;

const els = {
  fileInput: document.getElementById("fileInput"),
  pasteInput: document.getElementById("pasteInput"),
  parsePasteBtn: document.getElementById("parsePasteBtn"),
  loadSampleBtn: document.getElementById("loadSampleBtn"),
  clearBtn: document.getElementById("clearBtn"),
  saveBtn: document.getElementById("saveBtn"),
  exportPlanBtn: document.getElementById("exportPlanBtn"),
  exportAllBtn: document.getElementById("exportAllBtn"),
  exportNegativeBtn: document.getElementById("exportNegativeBtn"),
  exportListingBtn: document.getElementById("exportListingBtn"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageInfo: document.getElementById("pageInfo"),
  pageSizeSelect: document.getElementById("pageSizeSelect"),
  resetFiltersBtn: document.getElementById("resetFiltersBtn"),
  searchInput: document.getElementById("searchInput"),
  categoryFilter: document.getElementById("categoryFilter"),
  customCategoryInput: document.getElementById("customCategoryInput"),
  addCategoryBtn: document.getElementById("addCategoryBtn"),
  categoryChips: document.getElementById("categoryChips"),
  actionFilter: document.getElementById("actionFilter"),
  statusFilter: document.getElementById("statusFilter"),
  keywordTable: document.getElementById("keywordTable"),
  emptyState: document.getElementById("emptyState"),
  totalCount: document.getElementById("totalCount"),
  readyCount: document.getElementById("readyCount"),
  listingCount: document.getElementById("listingCount"),
  negativeCount: document.getElementById("negativeCount"),
  resultHint: document.getElementById("resultHint"),
  detailKeyword: document.getElementById("detailKeyword"),
  detailMeaning: document.getElementById("detailMeaning"),
  detailVolume: document.getElementById("detailVolume"),
  detailReason: document.getElementById("detailReason"),
  detailUsage: document.getElementById("detailUsage"),
  detailPlacement: document.getElementById("detailPlacement"),
  copyTermBtn: document.getElementById("copyTermBtn")
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function normalizeTerm(term) {
  return String(term || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeSearchVolume(value) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function containsAny(term, words) {
  return words.some((word) => term.includes(word));
}

function normalizeActionValue(value) {
  const action = String(value || "").trim();
  const mapping = {
    "SP 精准": "优先处理",
    "SP 词组": "内容扩展词",
    "SP 广泛测试": "单独观察",
    "SB / SB Video": "内容扩展词",
    "观察": "人工复核"
  };
  return mapping[action] || (actions.includes(action) ? action : "人工复核");
}

function normalizeStatusValue(value) {
  const status = String(value || "").trim();
  if (status === "可投放") return "可处理";
  return statuses.includes(status) ? status : "待判断";
}

function explainTerm(term, category) {
  const parts = [];
  if (containsAny(term, ["no box spring"])) parts.push("不需要额外床箱，属于强购买理由");
  if (containsAny(term, ["storage", "under bed"])) parts.push("关注床下收纳空间");
  if (containsAny(term, ["heavy duty", "sturdy", "strong"])) parts.push("关注承重和稳定性");
  if (containsAny(term, ["noise free", "quiet", "noise"])) parts.push("关注异响问题，文案建议避免绝对承诺");
  if (containsAny(term, ["queen", "king", "full", "twin", "14 inch", "18 inch", "12 inch"])) parts.push("带明确规格，购买意图更清楚");
  if (containsAny(term, ["black", "white", "gold", "rustic", "modern"])) parts.push("带颜色或风格偏好");
  if (containsAny(term, ["apartment", "guest", "kids", "college", "dorm"])) parts.push("带使用场景或人群");
  if (category === "竞品品牌词") parts.push("疑似竞品品牌词，建议独立低预算测试");
  if (category === "否词候选") parts.push("与当前产品方向可能不匹配，适合先放入否词候选");
  return parts.length ? parts.join("；") : "需要结合产品进一步判断";
}

function classify(term) {
  const t = normalizeTerm(term);
  const competitorBrands = ["zinus", "ikea", "amazon basics", "wayfair", "lucid", "mellow", "vecelo"];
  const negativeHints = ["wood", "wooden", "mattress", "headboard only", "replacement parts", "used", "free"];

  let category = "待判断";
  let action = "观察";
  let status = "待判断";
  let reason = "暂未命中明确规则，建议人工复核。";
  let placement = "关键词池";

  if (containsAny(t, competitorBrands)) {
    category = "竞品品牌词";
    action = "单独观察";
    status = "观察中";
    reason = "命中常见品牌词，流量可能有价值，但相关性和转化风险更高。";
    placement = "竞品词观察清单";
  } else if (containsAny(t, negativeHints)) {
    category = "否词候选";
    action = "否词";
    status = "否词候选";
    reason = "命中不匹配或容易跑偏的词根。";
    placement = "否定关键词表";
  } else if (containsAny(t, ["queen", "king", "full", "twin", "inch", "size"])) {
    category = "尺寸规格词";
    action = "优先处理";
    status = "可处理";
    reason = "带明确尺寸规格，搜索意图更接近购买。";
    placement = "优先处理清单、标题、五点";
  } else if (containsAny(t, ["storage", "no box spring", "noise", "quiet", "heavy duty", "foldable", "easy assembly", "tool free"])) {
    category = "功能卖点词";
    action = "Listing 埋词";
    status = "已放入 Listing";
    reason = "命中功能卖点，适合承接到 Listing 文案和图片文案。";
    placement = "标题、五点、A+、图片文案";
  } else if (containsAny(t, ["metal", "steel", "platform", "slat", "frame"])) {
    category = "核心类目词";
    action = "标题核心词";
    status = "可处理";
    reason = "命中核心类目词根，适合承担基础流量。";
    placement = "标题、类目词清单";
  } else if (containsAny(t, ["black", "white", "gold", "modern", "rustic", "industrial", "minimalist"])) {
    category = "颜色风格词";
    action = "内容扩展词";
    status = "可处理";
    reason = "带风格偏好，适合用图片或视频表达差异。";
    placement = "Listing 图片、A+、风格词清单";
  } else if (containsAny(t, ["apartment", "dorm", "college", "guest", "kids", "bedroom"])) {
    category = "人群场景词";
    action = "内容扩展词";
    status = "可处理";
    reason = "带具体使用场景，适合单独观察转化。";
    placement = "场景词清单、图片文案";
  } else if (t.split(" ").length >= 4) {
    category = "长尾需求词";
    action = "优先处理";
    status = "可处理";
    reason = "长尾词通常意图更具体，适合低预算精准测试。";
    placement = "长尾优先清单";
  }

  return {
    category,
    action,
    status,
    reason,
    placement,
    meaning: explainTerm(t, category)
  };
}

function createKeyword(term, source = "手工导入", extras = {}) {
  const normalized = normalizeTerm(term);
  const profile = classify(normalized);
  return {
    id: uid(),
    term: normalized,
    searchVolume: normalizeSearchVolume(extras.searchVolume),
    source,
    note: "",
    ...profile
  };
}

function mergeKeywords(newTerms, source) {
  const existing = new Map(keywords.map((item) => [item.term, item]));
  const additions = [];
  let updated = 0;
  newTerms.forEach((entry) => {
    const term = getEntryTerm(entry);
    const normalized = normalizeTerm(term);
    const searchVolume = normalizeSearchVolume(getEntrySearchVolume(entry));
    if (!normalized) return;
    if (existing.has(normalized)) {
      const current = existing.get(normalized);
      if (searchVolume && current.searchVolume !== searchVolume) {
        current.searchVolume = searchVolume;
        updated += 1;
      }
      return;
    }
    const created = createKeyword(normalized, source, { searchVolume });
    additions.push(created);
    existing.set(normalized, created);
  });
  keywords = [...keywords, ...additions];
  if (!selectedId && keywords[0]) selectedId = keywords[0].id;
  render();
  showToast(`已导入 ${additions.length} 个新关键词${updated ? `，更新 ${updated} 个搜索量` : ""}`);
}

function getEntryTerm(entry) {
  if (typeof entry === "object" && entry !== null) {
    return entry.term || entry.keyword || entry.searchTerm || entry["关键词"] || entry["搜索词"];
  }
  return entry;
}

function getEntrySearchVolume(entry) {
  if (typeof entry !== "object" || entry === null) return "";
  return entry.searchVolume || entry.volume || entry.monthlySearches || entry["搜索量"] || entry["月搜索量"];
}

function parseDelimited(text) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!rows.length) return [];

  const delimiter = text.includes("\t") ? "\t" : ",";
  const first = splitRow(rows[0], delimiter);
  const normalizedHeaders = first.map((cell) => normalizeTerm(cell));
  const keywordIndex = normalizedHeaders.findIndex((header) =>
    ["keyword", "keywords", "search term", "customer search term", "关键词", "搜索词"].includes(header)
  );
  const searchVolumeIndex = normalizedHeaders.findIndex((header) =>
    ["search volume", "search_volume", "monthly searches", "monthly_searches", "monthly search volume", "volume", "搜索量", "月搜索量", "搜索热度", "搜索频次"].includes(header)
  );

  if (keywordIndex >= 0) {
    return rows.slice(1).map((row) => {
      const cells = splitRow(row, delimiter);
      return {
        term: cells[keywordIndex],
        searchVolume: searchVolumeIndex >= 0 ? cells[searchVolumeIndex] : ""
      };
    }).filter((entry) => entry.term);
  }

  if (rows.some((row) => row.includes(delimiter))) {
    return rows.map((row) => {
      const cells = splitRow(row, delimiter);
      return {
        term: cells[0],
        searchVolume: cells[1] || ""
      };
    }).filter((entry) => entry.term);
  }

  return rows;
}

function splitRow(row, delimiter) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    const next = row[i + 1];
    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

async function readUploadedText(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (isLikelyExcelWorkbook(bytes)) {
    throw new Error("检测到 Excel 工作簿文件，请先另存为 CSV / TSV / TXT 后再上传");
  }

  return decodeText(bytes);
}

function isLikelyExcelWorkbook(bytes) {
  return bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;
}

function decodeText(bytes) {
  if (hasBom(bytes, [0xef, 0xbb, 0xbf])) return decodeWith("utf-8", bytes);
  if (hasBom(bytes, [0xff, 0xfe])) return decodeWith("utf-16le", bytes);
  if (hasBom(bytes, [0xfe, 0xff])) return decodeWith("utf-16be", bytes);

  if (looksLikeUtf16(bytes)) {
    return decodeWith(countEvenZeroBytes(bytes) > countOddZeroBytes(bytes) ? "utf-16be" : "utf-16le", bytes);
  }

  const candidates = ["utf-8", "gb18030", "big5"];
  return candidates
    .map((encoding) => {
      const text = decodeWith(encoding, bytes);
      return { text, score: scoreDecodedText(text) };
    })
    .sort((a, b) => b.score - a.score)[0].text;
}

function decodeWith(encoding, bytes) {
  return new TextDecoder(encoding).decode(bytes).replace(/^\ufeff/, "");
}

function hasBom(bytes, bom) {
  return bom.every((byte, index) => bytes[index] === byte);
}

function looksLikeUtf16(bytes) {
  const sampleLength = Math.min(bytes.length, 200);
  if (sampleLength < 4) return false;
  const zeroBytes = countEvenZeroBytes(bytes, sampleLength) + countOddZeroBytes(bytes, sampleLength);
  return zeroBytes / sampleLength > 0.2;
}

function countEvenZeroBytes(bytes, sampleLength = Math.min(bytes.length, 200)) {
  let count = 0;
  for (let index = 0; index < sampleLength; index += 2) {
    if (bytes[index] === 0) count += 1;
  }
  return count;
}

function countOddZeroBytes(bytes, sampleLength = Math.min(bytes.length, 200)) {
  let count = 0;
  for (let index = 1; index < sampleLength; index += 2) {
    if (bytes[index] === 0) count += 1;
  }
  return count;
}

function scoreDecodedText(text) {
  const replacementCount = (text.match(/\ufffd/g) || []).length;
  const controlCount = (text.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g) || []).length;
  const chineseHeaderHits = (text.match(/关键词|搜索词|搜索量|月搜索量/g) || []).length;
  const delimiterHits = (text.match(/,|\t|\r?\n/g) || []).length;
  return chineseHeaderHits * 30 + delimiterHits - replacementCount * 20 - controlCount * 10;
}

function filteredKeywords() {
  const query = normalizeTerm(els.searchInput.value);
  const category = els.categoryFilter.value;
  const action = els.actionFilter.value;
  const status = els.statusFilter.value;
  return keywords.filter((item) => {
    const haystack = `${item.term} ${item.searchVolume || ""} ${item.meaning} ${item.note}`.toLowerCase();
    return (!query || haystack.includes(query))
      && (!category || item.category === category)
      && (!action || item.action === action)
      && (!status || item.status === status);
  });
}

function renderOptions() {
  fillSelect(els.categoryFilter, categories, "全部分类");
  fillSelect(els.actionFilter, actions, "全部动作");
  fillSelect(els.statusFilter, statuses, "全部状态");
  renderCategoryChips();
}

function fillSelect(select, options, placeholder) {
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>` + options
    .map((option) => `<option value="${escapeAttr(option)}">${escapeHtml(option)}</option>`)
    .join("");
  select.value = options.includes(current) ? current : "";
}

function renderCategoryChips() {
  els.categoryChips.innerHTML = categories
    .map((category) => `<span class="category-chip">${escapeHtml(category)}</span>`)
    .join("");
}

function normalizeCategoryName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function addCategory(value, options = {}) {
  const name = normalizeCategoryName(value);
  if (!name) {
    showToast("请输入分类名称");
    return false;
  }
  const exists = categories.some((category) => category.toLowerCase() === name.toLowerCase());
  if (exists) {
    if (options.selectFilter) els.categoryFilter.value = categories.find((category) => category.toLowerCase() === name.toLowerCase()) || "";
    showToast("这个分类已经存在");
    return false;
  }
  categories = [...categories, name];
  renderOptions();
  if (options.selectFilter) els.categoryFilter.value = name;
  renderTable();
  saveLocal("已添加自定义分类");
  return true;
}

function syncCategoriesFromKeywords() {
  keywords.forEach((item) => {
    const category = normalizeCategoryName(item.category);
    if (category && !categories.some((existing) => existing.toLowerCase() === category.toLowerCase())) {
      categories.push(category);
    }
    if (item.searchVolume == null) item.searchVolume = "";
    item.action = normalizeActionValue(item.action);
    item.status = normalizeStatusValue(item.status);
  });
}

function render() {
  renderMetrics();
  renderTable();
  renderDetail();
}

function renderMetrics() {
  els.totalCount.textContent = keywords.length;
  els.readyCount.textContent = keywords.filter((item) => item.status === "可处理").length;
  els.listingCount.textContent = keywords.filter((item) => item.action === "Listing 埋词" || item.status === "已放入 Listing").length;
  els.negativeCount.textContent = keywords.filter((item) => item.action === "否词" || item.status === "否词候选").length;
}

function renderTable() {
  const rows = filteredKeywords();
  const totalPages = getTotalPages(rows.length);
  if (currentPage > totalPages) currentPage = totalPages;
  const visibleRows = getVisibleRows(rows);
  const start = rows.length ? (currentPage - 1) * getPageSizeNumber(rows.length) + 1 : 0;
  const end = rows.length ? start + visibleRows.length - 1 : 0;
  els.resultHint.textContent = keywords.length ? `显示 ${start}-${end} / ${rows.length} 个关键词` : "还没有导入关键词";
  els.emptyState.style.display = rows.length ? "none" : "grid";
  els.keywordTable.innerHTML = visibleRows.map((item) => `
    <tr data-id="${item.id}" class="${item.id === selectedId ? "selected" : ""}">
      <td class="term-cell">${escapeHtml(item.term)}</td>
      <td><input class="volume-input" data-field="searchVolume" inputmode="numeric" value="${escapeAttr(item.searchVolume || "")}" placeholder="例如 12000"></td>
      <td><input class="meaning-input" data-field="meaning" value="${escapeAttr(item.meaning)}"></td>
      <td>${selectHtml("category", item.category, categories)}</td>
      <td>${selectHtml("action", item.action, actions)}</td>
      <td>${selectHtml("status", item.status, statuses)}</td>
      <td><input class="note-input" data-field="note" value="${escapeAttr(item.note)}" placeholder="添加备注"></td>
    </tr>
  `).join("");
  renderPageControls(rows.length);
}

function getPageSizeNumber(totalRows) {
  return pageSize === "all" ? Math.max(totalRows, 1) : Number(pageSize);
}

function getTotalPages(totalRows) {
  return Math.max(1, Math.ceil(totalRows / getPageSizeNumber(totalRows)));
}

function getVisibleRows(rows) {
  if (pageSize === "all") return rows;
  const size = Number(pageSize);
  const start = (currentPage - 1) * size;
  return rows.slice(start, start + size);
}

function renderPageControls(totalRows) {
  const totalPages = getTotalPages(totalRows);
  els.pageInfo.textContent = `第 ${currentPage} / ${totalPages} 页`;
  els.prevPageBtn.disabled = currentPage <= 1;
  els.nextPageBtn.disabled = currentPage >= totalPages;
}

function resetPageAndRenderTable() {
  currentPage = 1;
  renderTable();
}

function selectHtml(field, value, options) {
  const optionHtml = options
    .map((option) => `<option value="${escapeAttr(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`)
    .join("");
  return `<select data-field="${field}">${optionHtml}</select>`;
}

function renderDetail() {
  const item = keywords.find((keyword) => keyword.id === selectedId);
  if (!item) {
    els.detailKeyword.textContent = "未选择关键词";
    els.detailMeaning.textContent = "点击表格中的关键词查看说明。";
    els.detailVolume.textContent = "暂无";
    els.detailReason.textContent = "暂无";
    els.detailUsage.textContent = "暂无";
    els.detailPlacement.textContent = "暂无";
    return;
  }
  els.detailKeyword.textContent = item.term;
  els.detailMeaning.textContent = item.meaning;
  els.detailVolume.textContent = item.searchVolume || "暂无";
  els.detailReason.textContent = item.reason;
  els.detailUsage.textContent = `${item.category}，处理动作：${item.action}，当前状态：${item.status}。`;
  els.detailPlacement.textContent = item.placement;
}

function updateItem(id, field, value) {
  keywords = keywords.map((item) => {
    if (item.id !== id) return item;
    return { ...item, [field]: value };
  });
  renderMetrics();
  renderDetail();
}

function saveLocal(message = "已保存到本机浏览器") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ keywords, selectedId, categories }));
  showToast(message);
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved.categories)) {
      categories = [...defaultCategories];
      saved.categories.forEach((category) => {
        const name = normalizeCategoryName(category);
        if (name && !categories.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
          categories.push(name);
        }
      });
    }
    if (Array.isArray(saved.keywords)) {
      keywords = saved.keywords;
      selectedId = saved.selectedId || keywords[0]?.id || null;
      syncCategoriesFromKeywords();
    }
  } catch {
    keywords = [];
    selectedId = null;
  }
}

function exportCsv(filename, rows) {
  if (!rows.length) {
    showToast("没有可导出的关键词");
    return;
  }
  const headers = ["keyword", "search_volume", "chinese_meaning", "category", "recommended_action", "status", "placement", "note"];
  const body = rows.map((item) => [
    item.term,
    item.searchVolume || "",
    item.meaning,
    item.category,
    item.action,
    item.status,
    item.placement,
    item.note
  ]);
  const csv = [headers, ...body]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`已导出 ${filename}`);
}

function csvCell(value) {
  return `"${String(value || "").replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function showToast(message) {
  const toast = document.querySelector(".toast") || document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

els.parsePasteBtn.addEventListener("click", () => {
  mergeKeywords(parseDelimited(els.pasteInput.value), "粘贴导入");
});

els.loadSampleBtn.addEventListener("click", () => {
  mergeKeywords(sampleKeywords, "示例");
});

els.fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await readUploadedText(file);
    mergeKeywords(parseDelimited(text), file.name);
  } catch (error) {
    showToast(error.message || "文件读取失败，请检查文件格式");
  } finally {
    event.target.value = "";
  }
});

els.clearBtn.addEventListener("click", () => {
  keywords = [];
  selectedId = null;
  saveLocal("已清空关键词，分类保留");
  render();
});

els.saveBtn.addEventListener("click", saveLocal);

els.addCategoryBtn.addEventListener("click", () => {
  if (addCategory(els.customCategoryInput.value, { selectFilter: true })) {
    els.customCategoryInput.value = "";
  }
});

els.customCategoryInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    els.addCategoryBtn.click();
  }
});

els.exportPlanBtn.addEventListener("click", () => {
  exportCsv("关键词处理表.csv", keywords.filter((item) => item.action !== "否词"));
});

els.exportAllBtn.addEventListener("click", () => {
  exportCsv("关键词工作台全部数据.csv", keywords);
});

els.exportNegativeBtn.addEventListener("click", () => {
  exportCsv("否定关键词候选.csv", keywords.filter((item) => item.action === "否词" || item.status === "否词候选"));
});

els.exportListingBtn.addEventListener("click", () => {
  exportCsv("Listing埋词建议.csv", keywords.filter((item) => item.action === "Listing 埋词" || item.status === "已放入 Listing"));
});

els.resetFiltersBtn.addEventListener("click", () => {
  els.searchInput.value = "";
  els.categoryFilter.value = "";
  els.actionFilter.value = "";
  els.statusFilter.value = "";
  resetPageAndRenderTable();
});

els.searchInput.addEventListener("input", debounce(resetPageAndRenderTable, 120));

[els.categoryFilter, els.actionFilter, els.statusFilter].forEach((control) => {
  control.addEventListener("input", resetPageAndRenderTable);
});

els.prevPageBtn.addEventListener("click", () => {
  currentPage = Math.max(1, currentPage - 1);
  renderTable();
});

els.nextPageBtn.addEventListener("click", () => {
  currentPage += 1;
  renderTable();
});

els.pageSizeSelect.addEventListener("input", () => {
  pageSize = els.pageSizeSelect.value === "all" ? "all" : Number(els.pageSizeSelect.value);
  resetPageAndRenderTable();
});

els.keywordTable.addEventListener("click", (event) => {
  const row = event.target.closest("tr");
  if (!row) return;
  selectedId = row.dataset.id;
  render();
});

els.keywordTable.addEventListener("change", (event) => {
  const field = event.target.dataset.field;
  const row = event.target.closest("tr");
  if (!field || !row) return;
  updateItem(row.dataset.id, field, event.target.value);
});

els.keywordTable.addEventListener("input", (event) => {
  const field = event.target.dataset.field;
  const row = event.target.closest("tr");
  if (!field || !row || event.target.tagName === "SELECT") return;
  updateItem(row.dataset.id, field, event.target.value);
});

els.copyTermBtn.addEventListener("click", async () => {
  const item = keywords.find((keyword) => keyword.id === selectedId);
  if (!item) return;
  await navigator.clipboard.writeText(item.term);
  showToast("已复制关键词");
});

renderOptions();
loadLocal();
syncCategoriesFromKeywords();
renderOptions();
render();

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}
