// ============================================================================
// FMHY Vault — Pure Vanilla JS Engine (v3: Base64 Decoder Modal + Inline Chips)
// ============================================================================

const DB_NAME = 'fmhy_vault_db';
const DB_VERSION = 2;
const STORE_NAME = 'resources_cache_v2';
const PINS_STORAGE_KEY = 'fmhy_pinned_essentials_v1';
const META_STORAGE_KEY = 'fmhy_last_sync_meta_v2';

// Official fmhy/edit GitHub raw endpoints (with automatic fallback slugs)
const FMHY_SOURCES = [
  {
    id: 'privacy',
    label: '🛡️ Adblock & Privacy',
    urls: [
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/privacy.md',
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/adblockvpnguide.md'
    ]
  },
  {
    id: 'mobile',
    label: '📱 Android / Mobile',
    urls: [
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/mobile.md',
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/android-iosguide.md'
    ]
  },
  {
    id: 'video',
    label: '📺 Video & Streams',
    urls: [
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/video.md',
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/videopiracyguide.md'
    ]
  },
  {
    id: 'gaming',
    label: '🎮 Gaming & Emulation',
    urls: [
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/gaming.md',
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/gamingpiracyguide.md'
    ]
  },
  {
    id: 'audio',
    label: '🎵 Audio & Music',
    urls: [
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/audio.md',
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/audiopiracyguide.md'
    ]
  },
  {
    id: 'reading',
    label: '📗 Reading & Books',
    urls: [
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/reading.md',
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/readingpiracyguide.md'
    ]
  },
  {
    id: 'downloading',
    label: '💾 Downloading',
    urls: [
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/downloading.md',
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/downloadpiracyguide.md'
    ]
  },
  {
    id: 'torrenting',
    label: '🌀 Torrenting',
    urls: [
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/torrenting.md',
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/torrentpiracyguide.md'
    ]
  },
  {
    id: 'ai',
    label: '🤖 AI & Tools',
    urls: [
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/ai.md',
      'https://raw.githubusercontent.com/fmhy/edit/main/docs/system-tools.md'
    ]
  }
];

// Application State
const state = {
  allItems: [],
  filteredItems: [],
  pinnedMap: {},
  activeCategory: 'all',
  activeSubcategory: 'all',
  starredOnly: true,
  searchQuery: '',
  renderLimit: 60,
  isSyncing: false
};

// DOM Elements
const els = {
  syncBtn: document.getElementById('sync-btn'),
  syncIcon: document.getElementById('sync-icon'),
  syncStatus: document.getElementById('sync-status'),
  b64OpenBtn: document.getElementById('b64-open-btn'),
  b64Modal: document.getElementById('b64-modal'),
  b64CloseBtn: document.getElementById('b64-close-btn'),
  b64Input: document.getElementById('b64-input'),
  b64Output: document.getElementById('b64-output'),
  b64PasteBtn: document.getElementById('b64-paste-btn'),
  b64ClearBtn: document.getElementById('b64-clear-btn'),
  b64DecodeBtn: document.getElementById('b64-decode-btn'),
  b64EncodeBtn: document.getElementById('b64-encode-btn'),
  b64CopyBtn: document.getElementById('b64-copy-btn'),
  b64LinksWrap: document.getElementById('b64-links-wrap'),
  b64LinksList: document.getElementById('b64-links-list'),
  essentialsList: document.getElementById('essentials-list'),
  pinnedCount: document.getElementById('pinned-count'),
  exportPinsBtn: document.getElementById('export-pins-btn'),
  importPinsBtn: document.getElementById('import-pins-btn'),
  importFileInput: document.getElementById('import-file-input'),
  resourcesList: document.getElementById('resources-list'),
  resultsTitle: document.getElementById('results-title'),
  clearSubcatBtn: document.getElementById('clear-subcat-btn'),
  activeSubcatLabel: document.getElementById('active-subcat-label'),
  resultsCount: document.getElementById('results-count'),
  loadingBox: document.getElementById('loading-box'),
  loadingText: document.getElementById('loading-text'),
  loadMoreWrap: document.getElementById('load-more-wrap'),
  loadMoreBtn: document.getElementById('load-more-btn'),
  subcategoryPills: document.getElementById('subcategory-pills'),
  categoryPills: document.getElementById('category-pills'),
  searchInput: document.getElementById('search-input'),
  clearSearchBtn: document.getElementById('clear-search-btn'),
  starredToggle: document.getElementById('starred-toggle'),
  toast: document.getElementById('toast')
};

// ============================================================================
// 1. IndexedDB Storage Wrapper
// ============================================================================

function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDatasetToCache(items) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(items, 'all_resources');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB fallback to localStorage:', err);
    localStorage.setItem('fmhy_fallback_cache_v2', JSON.stringify(items.slice(0, 1500)));
  }
}

async function loadDatasetFromCache() {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('all_resources');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    const raw = localStorage.getItem('fmhy_fallback_cache_v2');
    return raw ? JSON.parse(raw) : null;
  }
}

// ============================================================================
// 2. Base64 Decoder / Encoder Engine & Auto-Detection
// ============================================================================

function decodeSingleB64Token(token) {
  let clean = token.trim().replace(/-/g, '+').replace(/_/g, '/');
  while (clean.length % 4 !== 0) {
    clean += '=';
  }
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function decodeBase64Input(rawInput) {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return '';

  // Support multi-line or space-separated Base64 strings
  const lines = trimmed.split(/\r?\n/);
  const decodedLines = lines.map((line) => {
    const part = line.trim();
    if (!part) return '';
    try {
      return decodeSingleB64Token(part);
    } catch (e) {
      return `[Invalid Base64]: ${part}`;
    }
  });
  return decodedLines.join('\n');
}

function encodeBase64Input(rawInput) {
  const text = rawInput || '';
  if (!text) return '';
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

// Detect potential Base64 strings inside a card description (e.g. aHR0cHM6Ly9...)
function findBase64InText(text) {
  if (!text) return null;
  const tokens = text.split(/[\s,;|()[\]"'`]+/);
  for (const tok of tokens) {
    if (
      tok.length >= 16 &&
      /^[A-Za-z0-9+/_-]+={0,2}$/.test(tok) &&
      !/^https?:\/\//i.test(tok)
    ) {
      try {
        const decoded = decodeSingleB64Token(tok);
        // Verify it decodes to printable ASCII / UTF-8 text (especially URLs)
        if (decoded && /^[\x20-\x7E\r\n\t]+$/.test(decoded) && (decoded.includes('http') || decoded.includes('.') || decoded.includes('/'))) {
          return tok;
        }
      } catch (e) {
        // Ignore non-Base64 words
      }
    }
  }
  return null;
}

function updateB64ModalOutput(mode = 'decode') {
  const raw = els.b64Input.value;
  if (!raw.trim()) {
    els.b64Output.value = '';
    els.b64LinksWrap.classList.add('hidden');
    els.b64LinksList.innerHTML = '';
    return;
  }

  const result = mode === 'encode' ? encodeBase64Input(raw) : decodeBase64Input(raw);
  els.b64Output.value = result;

  // Extract any http/https links from the decoded output so the user can tap them directly
  const urlMatches = result.match(/https?:\/\/[^\s"'<>)+]+/gi) || [];
  if (urlMatches.length > 0 && mode === 'decode') {
    els.b64LinksWrap.classList.remove('hidden');
    els.b64LinksList.innerHTML = '';
    const uniqueUrls = [...new Set(urlMatches)];
    uniqueUrls.forEach((u) => {
      const a = document.createElement('a');
      a.className = 'b64-detected-link';
      a.href = u;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.innerHTML = `<span>${escapeHtml(u)}</span> <span>↗</span>`;
      els.b64LinksList.appendChild(a);
    });
  } else {
    els.b64LinksWrap.classList.add('hidden');
    els.b64LinksList.innerHTML = '';
  }
}

function openB64Modal(prefillString = '') {
  els.b64Modal.classList.remove('hidden');
  if (prefillString) {
    els.b64Input.value = prefillString;
    updateB64ModalOutput('decode');
  }
}

function closeB64Modal() {
  els.b64Modal.classList.add('hidden');
}

// ============================================================================
// 3. Live FMHY Markdown Parser
// ============================================================================

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch (e) {
    return '';
  }
}

function formatMirrorLabel(rawLabel, url, index) {
  const cleaned = (rawLabel || '').replace(/[*_~`]/g, '').trim();
  const domain = extractDomain(url);

  if (!cleaned || /^\d+$/.test(cleaned)) {
    const num = cleaned || index + 2;
    return domain ? `Mirror ${num} (${domain})` : `Mirror ${num}`;
  }
  return cleaned;
}

function cleanDescriptionText(rawLine) {
  let desc = rawLine
    .replace(/^[-*+▷]\s+/, '')
    .replace(/⭐|🌟|:star:|\{\.star\}/g, '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '')
    .replace(/[*_`~]/g, '')
    .replace(/\([\s,;/|:-]*\)/g, '')
    .replace(/\[[\s,;/|:-]*\]/g, '')
    .replace(/(\s*[,/|•–—-]\s*){2,}/g, ' - ')
    .replace(/^[\s,;/|•–—:-]+/, '')
    .replace(/[\s,;/|•–—:-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return desc;
}

function parseFMHYMarkdown(markdownText, categoryId, categoryLabel) {
  const lines = markdownText.split(/\r?\n/);
  const items = [];
  let currentSubcategory = 'General';

  const headingRegex = /^(#{1,4})\s+(.+)$/;
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const headingMatch = rawLine.match(headingRegex);
    if (headingMatch) {
      const cleanHeading = headingMatch[2]
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*_`~]/g, '')
        .replace(/\{#[^}]+\}/g, '')
        .replace(/^[►▶▷]\s*/, '')
        .trim();
      if (cleanHeading) {
        currentSubcategory = cleanHeading;
      }
      continue;
    }

    if (!/^[-*+]\s+/.test(rawLine) && !/^▷\s+/.test(rawLine)) continue;
    if (!rawLine.includes('http')) continue;

    const matches = [...rawLine.matchAll(linkRegex)];
    if (matches.length === 0) continue;

    const externalLinks = matches
      .map((m) => ({
        rawLabel: m[1].trim(),
        url: m[2].trim()
      }))
      .filter((l) => /^https?:\/\//i.test(l.url));

    if (externalLinks.length === 0) continue;

    const isStarred =
      rawLine.includes('⭐') ||
      rawLine.includes('🌟') ||
      rawLine.includes(':star:') ||
      rawLine.includes('{.star}') ||
      /^[-*+]\s+(?:⭐\s*)?\*\*\[/.test(rawLine);

    const primary = externalLinks[0];
    const primaryTitle = primary.rawLabel.replace(/[*_~`]/g, '').trim() || extractDomain(primary.url);

    const mirrors = externalLinks.slice(1).map((m, idx) => ({
      label: formatMirrorLabel(m.rawLabel, m.url, idx),
      url: m.url
    }));

    let desc = cleanDescriptionText(rawLine);
    if (!desc) {
      desc = `${currentSubcategory} resource`;
    }

    items.push({
      id: `${categoryId}_${primary.url}`,
      title: primaryTitle,
      url: primary.url,
      mirrors: mirrors,
      desc: desc,
      starred: isStarred,
      categoryId: categoryId,
      categoryLabel: categoryLabel,
      subcategory: currentSubcategory
    });
  }

  return items;
}

// ============================================================================
// 4. GitHub Fetcher
// ============================================================================

async function fetchCategorySource(source) {
  for (const url of source.urls) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        const md = await response.text();
        return parseFMHYMarkdown(md, source.id, source.label);
      }
    } catch (err) {
      console.warn(`Failed fetching ${url}:`, err);
    }
  }
  return [];
}

async function syncAllFromGitHub() {
  if (state.isSyncing) return;
  state.isSyncing = true;
  els.syncIcon.classList.add('spinning');
  els.loadingBox.classList.remove('hidden');

  const collected = [];
  let completed = 0;

  try {
    for (const source of FMHY_SOURCES) {
      els.loadingText.textContent = `Syncing ${source.label} (${completed + 1}/${FMHY_SOURCES.length})...`;
      const parsed = await fetchCategorySource(source);
      collected.push(...parsed);
      completed++;
    }

    if (collected.length > 0) {
      const seen = new Set();
      const deduped = collected.filter((item) => {
        const key = `${item.categoryId}::${item.url}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      state.allItems = deduped;
      await saveDatasetToCache(deduped);

      const nowStr = new Date().toLocaleString([], {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
      localStorage.setItem(META_STORAGE_KEY, nowStr);
      els.syncStatus.textContent = `Synced: ${nowStr} (${deduped.length.toLocaleString()} links)`;
      showToast(`Synced ${deduped.length.toLocaleString()} resources!`);
    } else {
      showToast('Sync failed. Check connection.');
    }
  } catch (err) {
    console.error('Sync error:', err);
    showToast('Error syncing from GitHub');
  } finally {
    state.isSyncing = false;
    els.syncIcon.classList.remove('spinning');
    els.loadingBox.classList.add('hidden');
    renderSubcategoryPills();
    applyFiltersAndRender(true);
  }
}

// ============================================================================
// 5. Clipboard Copy Helper & Pinned Essentials Management
// ============================================================================

async function copyUrlToClipboard(url, labelText, btnEl) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    if (btnEl) {
      const prev = btnEl.textContent;
      btnEl.textContent = '✓';
      btnEl.classList.add('copied');
      setTimeout(() => {
        btnEl.textContent = prev;
        btnEl.classList.remove('copied');
      }, 1200);
    }
    showToast(`Copied "${labelText}"`);
  } catch (err) {
    showToast('Failed to copy to clipboard');
  }
}

function loadPins() {
  try {
    const raw = localStorage.getItem(PINS_STORAGE_KEY);
    state.pinnedMap = raw ? JSON.parse(raw) : {};
  } catch (e) {
    state.pinnedMap = {};
  }
}

function savePins() {
  localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(state.pinnedMap));
}

function togglePinItem(item) {
  if (state.pinnedMap[item.url]) {
    delete state.pinnedMap[item.url];
    showToast(`Unpinned "${item.title}"`);
  } else {
    state.pinnedMap[item.url] = {
      title: item.title,
      url: item.url,
      mirrors: item.mirrors || [],
      desc: item.desc,
      starred: item.starred,
      categoryId: item.categoryId,
      categoryLabel: item.categoryLabel,
      subcategory: item.subcategory,
      pinnedAt: Date.now()
    };
    showToast(`Pinned "${item.title}" to Essentials`);
  }
  savePins();
  renderPinnedEssentials();
  applyFiltersAndRender(false);
}

function exportPinsBackup() {
  const pinsArray = Object.values(state.pinnedMap);
  if (pinsArray.length === 0) {
    showToast('No pinned items to export yet');
    return;
  }
  const dataStr = JSON.stringify(state.pinnedMap, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fmhy-essentials-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Exported Essentials backup JSON');
}

function importPinsBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (typeof imported === 'object' && imported !== null) {
        state.pinnedMap = { ...state.pinnedMap, ...imported };
        savePins();
        renderPinnedEssentials();
        applyFiltersAndRender(false);
        showToast(`Imported ${Object.keys(imported).length} pinned items!`);
      }
    } catch (err) {
      showToast('Invalid backup JSON file');
    }
  };
  reader.readAsText(file);
}

// ============================================================================
// 6. Card Rendering (Compact Horizontal Essentials + Full Feed Cards)
// ============================================================================

function selectSubcategoryFilter(categoryId, subcategoryName) {
  if (state.activeCategory === 'all' && categoryId) {
    state.activeCategory = categoryId;
  }
  state.activeSubcategory =
    state.activeSubcategory === subcategoryName ? 'all' : subcategoryName;

  renderCategoryPills();
  renderSubcategoryPills();
  applyFiltersAndRender(true);
}

function createCompactEssentialCard(item) {
  const card = document.createElement('article');
  card.className = 'essential-compact-card';

  const topRow = document.createElement('div');
  topRow.className = 'card-top';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'card-title-group';

  const primaryLink = document.createElement('a');
  primaryLink.className = 'card-primary-link';
  primaryLink.href = item.url;
  primaryLink.target = '_blank';
  primaryLink.rel = 'noopener noreferrer';
  primaryLink.innerHTML = `${item.starred ? '⭐ ' : ''}${escapeHtml(item.title)} <span class="external-arrow">↗</span>`;
  titleGroup.appendChild(primaryLink);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'card-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'action-icon-btn';
  copyBtn.title = 'Copy URL';
  copyBtn.textContent = '📋';
  copyBtn.addEventListener('click', () => copyUrlToClipboard(item.url, item.title, copyBtn));

  const pinBtn = document.createElement('button');
  pinBtn.className = 'action-icon-btn pinned';
  pinBtn.title = 'Unpin from Essentials';
  pinBtn.textContent = '📌';
  pinBtn.addEventListener('click', () => togglePinItem(item));

  actionsDiv.appendChild(copyBtn);
  actionsDiv.appendChild(pinBtn);

  topRow.appendChild(titleGroup);
  topRow.appendChild(actionsDiv);
  card.appendChild(topRow);

  if (item.desc) {
    const descP = document.createElement('p');
    descP.className = 'essential-compact-desc';
    descP.textContent = item.desc;
    card.appendChild(descP);
  }

  const metaRow = document.createElement('div');
  metaRow.className = 'card-meta-tags';

  const subcatBtn = document.createElement('button');
  subcatBtn.className = 'tag-subcat';
  subcatBtn.textContent = `▶ ${item.subcategory || 'General'}`;
  subcatBtn.addEventListener('click', () =>
    selectSubcategoryFilter(item.categoryId, item.subcategory)
  );

  metaRow.appendChild(subcatBtn);
  card.appendChild(metaRow);

  return card;
}

function createResourceCard(item) {
  const isPinned = Boolean(state.pinnedMap[item.url]);
  const card = document.createElement('article');
  card.className = `resource-card${item.starred ? ' is-starred' : ''}${isPinned ? ' is-pinned' : ''}`;

  const topRow = document.createElement('div');
  topRow.className = 'card-top';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'card-title-group';

  if (item.starred) {
    const starSpan = document.createElement('span');
    starSpan.className = 'star-badge';
    starSpan.textContent = '⭐';
    titleGroup.appendChild(starSpan);
  }

  const primaryLink = document.createElement('a');
  primaryLink.className = 'card-primary-link';
  primaryLink.href = item.url;
  primaryLink.target = '_blank';
  primaryLink.rel = 'noopener noreferrer';
  primaryLink.innerHTML = `${escapeHtml(item.title)} <span class="external-arrow">↗</span>`;
  titleGroup.appendChild(primaryLink);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'card-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'action-icon-btn';
  copyBtn.title = 'Copy link URL';
  copyBtn.textContent = '📋';
  copyBtn.addEventListener('click', () => copyUrlToClipboard(item.url, item.title, copyBtn));

  const pinBtn = document.createElement('button');
  pinBtn.className = `action-icon-btn${isPinned ? ' pinned' : ''}`;
  pinBtn.title = isPinned ? 'Unpin from Essentials' : 'Pin to Essentials';
  pinBtn.textContent = '📌';
  pinBtn.addEventListener('click', () => togglePinItem(item));

  actionsDiv.appendChild(copyBtn);
  actionsDiv.appendChild(pinBtn);

  topRow.appendChild(titleGroup);
  topRow.appendChild(actionsDiv);
  card.appendChild(topRow);

  // Category, Tappable Subcategory & Auto-Detected Base64 Chip
  const metaRow = document.createElement('div');
  metaRow.className = 'card-meta-tags';

  const catSpan = document.createElement('span');
  catSpan.className = 'tag-cat';
  catSpan.textContent = item.categoryLabel;

  const subcatBtn = document.createElement('button');
  const isSubcatActive = state.activeSubcategory === item.subcategory;
  subcatBtn.className = `tag-subcat${isSubcatActive ? ' active' : ''}`;
  subcatBtn.title = `Filter by ${item.subcategory}`;
  subcatBtn.textContent = `▶ ${item.subcategory}`;
  subcatBtn.addEventListener('click', () =>
    selectSubcategoryFilter(item.categoryId, item.subcategory)
  );

  metaRow.appendChild(catSpan);
  metaRow.appendChild(subcatBtn);

  const detectedB64 = findBase64InText(item.desc);
  if (detectedB64) {
    const b64Chip = document.createElement('button');
    b64Chip.className = 'tag-b64-chip';
    b64Chip.textContent = '🔓 Decode Base64';
    b64Chip.addEventListener('click', () => openB64Modal(detectedB64));
    metaRow.appendChild(b64Chip);
  }

  card.appendChild(metaRow);

  if (item.desc) {
    const descP = document.createElement('p');
    descP.className = 'card-desc';
    descP.textContent = item.desc;
    card.appendChild(descP);
  }

  if (item.mirrors && item.mirrors.length > 0) {
    const mirrorsWrap = document.createElement('div');
    mirrorsWrap.className = 'mirrors-wrap';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'mirrors-toggle-btn';
    toggleBtn.textContent = `+ ${item.mirrors.length} Mirror${item.mirrors.length > 1 ? 's' : ''} / Links ▾`;

    const mirrorsList = document.createElement('div');
    mirrorsList.className = 'mirrors-list hidden';

    item.mirrors.forEach((m, idx) => {
      const mLink = document.createElement('a');
      mLink.className = 'mirror-pill';
      mLink.href = m.url;
      mLink.target = '_blank';
      mLink.rel = 'noopener noreferrer';
      const displayLabel = m.label || formatMirrorLabel('', m.url, idx);
      mLink.textContent = `${displayLabel} ↗`;
      mirrorsList.appendChild(mLink);
    });

    toggleBtn.addEventListener('click', () => {
      const isHidden = mirrorsList.classList.toggle('hidden');
      toggleBtn.textContent = isHidden
        ? `+ ${item.mirrors.length} Mirror${item.mirrors.length > 1 ? 's' : ''} / Links ▾`
        : `Hide Links ▴`;
    });

    mirrorsWrap.appendChild(toggleBtn);
    mirrorsWrap.appendChild(mirrorsList);
    card.appendChild(mirrorsWrap);
  }

  return card;
}

function renderPinnedEssentials() {
  const pins = Object.values(state.pinnedMap).sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0));
  els.pinnedCount.textContent = pins.length;
  els.essentialsList.innerHTML = '';

  if (pins.length === 0) {
    els.essentialsList.innerHTML = `
      <div class="empty-pins">
        Tap <strong>📌</strong> on any resource below to pin your go-to links into this horizontal bar.
      </div>
    `;
    return;
  }

  const frag = document.createDocumentFragment();
  pins.forEach((item) => {
    frag.appendChild(createCompactEssentialCard(item));
  });
  els.essentialsList.appendChild(frag);
}

// ============================================================================
// 7. Category Pills, Subcategory Pills & Filtering
// ============================================================================

function renderCategoryPills() {
  els.categoryPills.innerHTML = '';

  const allPill = document.createElement('button');
  allPill.className = `cat-pill${state.activeCategory === 'all' ? ' active' : ''}`;
  allPill.textContent = '⚡ All';
  allPill.addEventListener('click', () => {
    state.activeCategory = 'all';
    state.activeSubcategory = 'all';
    renderCategoryPills();
    renderSubcategoryPills();
    applyFiltersAndRender(true);
  });
  els.categoryPills.appendChild(allPill);

  FMHY_SOURCES.forEach((src) => {
    const pill = document.createElement('button');
    pill.className = `cat-pill${state.activeCategory === src.id ? ' active' : ''}`;
    pill.textContent = src.label;
    pill.addEventListener('click', () => {
      if (state.activeCategory !== src.id) {
        state.activeCategory = src.id;
        state.activeSubcategory = 'all';
      }
      renderCategoryPills();
      renderSubcategoryPills();
      applyFiltersAndRender(true);
    });
    els.categoryPills.appendChild(pill);
  });
}

function renderSubcategoryPills() {
  if (state.activeCategory === 'all' && state.activeSubcategory === 'all') {
    els.subcategoryPills.classList.add('hidden');
    els.subcategoryPills.innerHTML = '';
    return;
  }

  const subcatSet = new Set();
  state.allItems.forEach((item) => {
    if (state.activeCategory === 'all' || item.categoryId === state.activeCategory) {
      if (item.subcategory) subcatSet.add(item.subcategory);
    }
  });

  const subcats = Array.from(subcatSet);
  if (subcats.length <= 1) {
    els.subcategoryPills.classList.add('hidden');
    return;
  }

  els.subcategoryPills.classList.remove('hidden');
  els.subcategoryPills.innerHTML = '';

  const allSubBtn = document.createElement('button');
  allSubBtn.className = `subcat-pill${state.activeSubcategory === 'all' ? ' active' : ''}`;
  allSubBtn.textContent = 'All Sections';
  allSubBtn.addEventListener('click', () => {
    state.activeSubcategory = 'all';
    renderSubcategoryPills();
    applyFiltersAndRender(true);
  });
  els.subcategoryPills.appendChild(allSubBtn);

  subcats.forEach((subName) => {
    const btn = document.createElement('button');
    btn.className = `subcat-pill${state.activeSubcategory === subName ? ' active' : ''}`;
    btn.textContent = `▶ ${subName}`;
    btn.addEventListener('click', () => {
      state.activeSubcategory = state.activeSubcategory === subName ? 'all' : subName;
      renderSubcategoryPills();
      applyFiltersAndRender(true);
    });
    els.subcategoryPills.appendChild(btn);
  });
}

function applyFiltersAndRender(resetLimit = true) {
  if (resetLimit) {
    state.renderLimit = 60;
  }

  const q = state.searchQuery.trim().toLowerCase();

  if (state.activeSubcategory !== 'all') {
    els.clearSubcatBtn.classList.remove('hidden');
    els.activeSubcatLabel.textContent = `▶ ${state.activeSubcategory}`;
  } else {
    els.clearSubcatBtn.classList.add('hidden');
  }

  state.filteredItems = state.allItems.filter((item) => {
    if (state.activeCategory !== 'all' && item.categoryId !== state.activeCategory) {
      return false;
    }
    if (state.activeSubcategory !== 'all' && item.subcategory !== state.activeSubcategory) {
      return false;
    }
    if (state.starredOnly && !item.starred) {
      return false;
    }
    if (q) {
      const hay = `${item.title} ${item.desc} ${item.subcategory} ${item.url}`.toLowerCase();
      return hay.includes(q);
    }
    return true;
  });

  els.resultsCount.textContent = `${state.filteredItems.length.toLocaleString()} items`;
  renderFeedList();
}

function renderFeedList() {
  els.resourcesList.innerHTML = '';

  if (state.filteredItems.length === 0) {
    if (!state.isSyncing) {
      els.resourcesList.innerHTML = `
        <div class="empty-pins">
          No matching resources found. Try toggling off <strong>⭐ Starred</strong> or clearing your subcategory/search filter.
        </div>
      `;
    }
    els.loadMoreWrap.classList.add('hidden');
    return;
  }

  const slice = state.filteredItems.slice(0, state.renderLimit);
  const frag = document.createDocumentFragment();
  slice.forEach((item) => {
    frag.appendChild(createResourceCard(item));
  });
  els.resourcesList.appendChild(frag);

  if (state.filteredItems.length > state.renderLimit) {
    els.loadMoreWrap.classList.remove('hidden');
    const remaining = state.filteredItems.length - state.renderLimit;
    els.loadMoreBtn.textContent = `Show More (${remaining.toLocaleString()} remaining)`;
  } else {
    els.loadMoreWrap.classList.add('hidden');
  }
}

// ============================================================================
// 8. Utilities & Initialization
// ============================================================================

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer = null;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 2400);
}

async function initApp() {
  loadPins();
  renderCategoryPills();
  renderPinnedEssentials();

  els.syncBtn.addEventListener('click', () => syncAllFromGitHub());

  // Base64 Modal Events
  els.b64OpenBtn.addEventListener('click', () => openB64Modal());
  els.b64CloseBtn.addEventListener('click', closeB64Modal);
  els.b64Modal.addEventListener('click', (e) => {
    if (e.target === els.b64Modal) closeB64Modal();
  });

  els.b64Input.addEventListener('input', () => updateB64ModalOutput('decode'));
  els.b64DecodeBtn.addEventListener('click', () => updateB64ModalOutput('decode'));
  els.b64EncodeBtn.addEventListener('click', () => updateB64ModalOutput('encode'));

  els.b64PasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        els.b64Input.value = text;
        updateB64ModalOutput('decode');
        showToast('Pasted from clipboard');
      }
    } catch (err) {
      els.b64Input.focus();
      showToast('Long-press inside the box to paste');
    }
  });

  els.b64ClearBtn.addEventListener('click', () => {
    els.b64Input.value = '';
    updateB64ModalOutput('decode');
    els.b64Input.focus();
  });

  els.b64CopyBtn.addEventListener('click', () => {
    const out = els.b64Output.value;
    if (!out) {
      showToast('Nothing to copy yet');
      return;
    }
    copyUrlToClipboard(out, 'decoded text', els.b64CopyBtn);
  });

  els.clearSubcatBtn.addEventListener('click', () => {
    state.activeSubcategory = 'all';
    renderSubcategoryPills();
    applyFiltersAndRender(true);
  });

  els.starredToggle.addEventListener('click', () => {
    state.starredOnly = !state.starredOnly;
    els.starredToggle.classList.toggle('active', state.starredOnly);
    els.starredToggle.setAttribute('aria-pressed', String(state.starredOnly));
    applyFiltersAndRender(true);
  });

  let searchTimeout = null;
  els.searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    els.clearSearchBtn.classList.toggle('hidden', !val);
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = val;
      applyFiltersAndRender(true);
    }, 80);
  });

  els.clearSearchBtn.addEventListener('click', () => {
    els.searchInput.value = '';
    els.clearSearchBtn.classList.add('hidden');
    state.searchQuery = '';
    applyFiltersAndRender(true);
  });

  els.loadMoreBtn.addEventListener('click', () => {
    state.renderLimit += 60;
    renderFeedList();
  });

  els.exportPinsBtn.addEventListener('click', exportPinsBackup);
  els.importPinsBtn.addEventListener('click', () => els.importFileInput.click());
  els.importFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      importPinsBackup(e.target.files[0]);
      e.target.value = '';
    }
  });

  const cachedItems = await loadDatasetFromCache();
  const lastSync = localStorage.getItem(META_STORAGE_KEY);

  if (cachedItems && cachedItems.length > 0) {
    state.allItems = cachedItems;
    els.syncStatus.textContent = `Cached: ${lastSync || 'Offline Ready'} (${cachedItems.length.toLocaleString()} links)`;
    renderSubcategoryPills();
    applyFiltersAndRender(true);
  } else {
    els.syncStatus.textContent = 'Syncing FMHY repo...';
    await syncAllFromGitHub();
  }
}

document.addEventListener('DOMContentLoaded', initApp);