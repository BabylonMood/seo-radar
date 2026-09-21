'use strict';

const Store = (function () {

  const DATASETS_KEY = 'seoradar.datasets.v1';
  const SETTINGS_KEY = 'seoradar.settings.v1';

  const DATASET_INFO = {
    'gsc.query':  { label: 'GSC · Queries',  hint: 'Export de Search Console (Rendimiento → Queries)' },
    'gsc.page':   { label: 'GSC · Páginas',  hint: 'Export de Search Console (Rendimiento → Páginas)' },
    'ga4.page':   { label: 'GA4 · Páginas',  hint: 'Export de GA4 (Informe Páginas o Exploración)' },
    'semrush.keyword': { label: 'SEMrush · Keywords', hint: 'Export de Organic Research o Position Tracking' }
  };

  const DEFAULT_SETTINGS = {
    ctrLow: 2.5,          // % CTR por debajo del cual se marca oportunidad de título/meta
    posRankMin: 6,        // posición desde la que se marca oportunidad de rank
    posRankMax: 20,       // posición hasta la que se marca oportunidad de rank
    minImprCtr: 400,      // impresiones mínimas para oport. CTR
    minImprRank: 300,     // impresiones mínimas para oport. rank
    minImprInvisible: 150,// impresiones mínimas para "aparece sin clic"
    cannibalMinImpr: 1500,// impresiones mínimas del grupo para canibalización
    contentMinWords: 1200,// palabras mínimas del content reviewer
    trendMinClicks: 10,   // clics mínimos para marcar ganador/perdedor
    trendPct: 15,         // % de cambio mínimo para marcar ganador/perdedor
    semrushMaxKD: 35,     // KD máxima para quick win de SEMrush
    aiEndpoint: 'https://api.openai.com/v1/chat/completions',
    aiModel: 'gpt-4o-mini',
    aiKey: ''
  };

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('No se pudo guardar localmente', e);
    }
  }

  // ---- helpers de normalización numérica ----
  function parseNum(v) {
    if (v == null || v === '') return null;
    let s = String(v).trim();
    if (!s) return null;
    s = s.replace(/[%\s]/g, '');
    s = s.replace(/\$/g, '');
    if (s.includes(',')) {
      const lastComma = s.lastIndexOf(',');
      const firstDot = s.indexOf('.');
      if (firstDot === -1) {
        s = s.replace(/,/g, '.');
      } else if (firstDot < lastComma) {
        s = s.replace(/,/g, '');
      } else {
        s = s.replace(/,/g, '');
      }
    }
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  // CTR consolidado a fracción (0..1). "0.075", "7.5 %" o "7.5" → 0.075
  function parseCtr(v) {
    let s = String(v == null ? '' : v).trim();
    if (!s) return null;
    const isPct = s.includes('%');
    s = s.replace(/%/g, '').trim();
    let n = parseNum(s);
    if (n == null) return null;
    if (isPct) n = n / 100;
    else if (n > 1) n = n / 100;
    return n;
  }

  function parseDate(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (m) {
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      return y + '-' + (m[2].padStart(2, '0')) + '-' + (m[1].padStart(2, '0'));
    }
    return null;
  }

  // URL → ruta normalizada: quita protocolo, dominio, # y query. Trailing slash común.
  function normURL(v) {
    if (!v) return null;
    let s = String(v).trim();
    try {
      s = new URL(s).pathname;
    } catch (e) {
      if (!s.startsWith('/')) s = '/' + s;
    }
    s = s.split('#')[0].split('?')[0];
    if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
    if (s === '') s = '/';
    return s;
  }

  function normKeyword(v) {
    return String(v == null ? '' : v)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9ñ ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // stopwords para no tratar palabras funcionales como tema significativo
  const STOPWORDS = new Set([
    'como', 'cuando', 'donde', 'dónde', 'quien', 'quienes', 'cual', 'cuales', 'cuales',
    'para', 'porque', 'porque', 'esto', 'este', 'esta', 'estos', 'estas', 'este',
    'esa', 'eso', 'esos', 'esas', 'aquel', 'aquella', 'esté', 'está',
    'cada', 'todo', 'toda', 'todos', 'todas', 'ser', 'estar', 'estan', 'pero',
    'muy', 'mas', 'menos', 'tambien', 'entre', 'sobre', 'hacia', 'desde',
    'tiene', 'tienen', 'puede', 'pueden', 'hacer', 'poner', 'deber', 'saber',
    'también', 'puedes', 'hace',
    'que', 'para', 'con', 'sin', 'por', 'del', 'con', 'que', 'solo', 'bien',
    'todavia', 'igual', 'asi', 'así', 'otra', 'otro', 'otros', 'otras'
  ]);

  // tokens significativos de una keyword (sin acentos, sin stopwords cortas)
  function normTokens(v) {
    return normKeyword(v).split(' ').filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  }

  // ---- datasets ----
  let datasets = loadJSON(DATASETS_KEY, {});
  try {
    if (!datasets || typeof datasets !== 'object') datasets = {};
  } catch (e) { datasets = {}; }

  function setDataset(kind, ds) {
    datasets[kind] = {
      rows: ds.rows,
      meta: {
        name: ds.name || (kind + ' importado'),
        date: ds.date || new Date().toISOString(),
        source: ds.source || 'manual'
      }
    };
    saveJSON(DATASETS_KEY, datasets);
  }

  function getDataset(kind) {
    return datasets[kind] || null;
  }

  function removeDataset(kind) {
    delete datasets[kind];
    saveJSON(DATASETS_KEY, datasets);
  }

  function listDatasets() {
    return Object.keys(datasets).map((k) => ({ kind: k, ...datasets[k] }));
  }

  function resetAll() {
    datasets = {};
    saveJSON(DATASETS_KEY, datasets);
  }

  // ---- settings ----
  let settings = Object.assign({}, DEFAULT_SETTINGS, loadJSON(SETTINGS_KEY, {}));

  function getSettings() { return settings; }
  function getSetting(k) { return settings[k]; }
  function updateSettings(patch) {
    settings = Object.assign({}, settings, patch);
    saveJSON(SETTINGS_KEY, settings);
  }
  function defaultSettings() { return Object.assign({}, DEFAULT_SETTINGS); }

  return {
    DATASET_INFO, DEFAULT_SETTINGS,
    parseNum, parseCtr, parseDate, normURL, normKeyword, normTokens,
    setDataset, getDataset, removeDataset, listDatasets, resetAll,
    getSettings, getSetting, updateSettings, defaultSettings
  };
})();

if (typeof window !== 'undefined') window.Store = Store;