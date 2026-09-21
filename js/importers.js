'use strict';

const Importers = (function () {

  // ---- CSV crudo: maneja comillas, saltos de línea internos y auto-delimitador ----
  function parseCSV(text) {
    const src = String(text).replace(/^\uFEFF/, '');
    const firstLine = src.split(/\r?\n/, 1)[0] || '';
    const c = (firstLine.split(';').length - 1);
    const t = (firstLine.split('\t').length - 1);
    const m = (firstLine.match(/,/g) || []).length;
    let delim = ',';
    if (c > m && c > t) delim = ';';
    else if (t > m && t > c) delim = '\t';

    const rows = [];
    let cur = [];
    let field = '';
    let inQ = false;
    const chars = src.replace(/\r\n/g, '\n');
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (inQ) {
        if (ch === '"') {
          if (chars[i + 1] === '"') { field += '"'; i++; }
          else inQ = false;
        } else field += ch;
      } else if (ch === '"') {
        inQ = true;
      } else if (ch === delim) {
        cur.push(field); field = '';
      } else if (ch === '\n') {
        cur.push(field); field = '';
        rows.push(cur); cur = [];
      } else {
        field += ch;
      }
    }
    if (field !== '' || cur.length) { cur.push(field); rows.push(cur); }
    return rows.filter((r) => r.some((f) => String(f).trim() !== ''));
  }

  function normHeader(h) {
    return String(h)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^\d+[.)\s]+/, '')
      .replace(/[^a-z0-9% ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function hasAny(cell, keys) {
    const h = normHeader(cell);
    return keys.some((k) => h === k || h.endsWith(' ' + k));
  }

  // ---- detección de columnas por tipo ----
  const KEYS = {
    keyword: ['keyword', 'palabra clave', 'keyword phrase', 'phrase', 'search term'],
    query: ['query', 'queries', 'top queries', 'top query', 'consulta', 'busqueda'],
    page: ['page', 'pages', 'url', 'urls', 'land page', 'landing page', 'pagina', 'paginación', 'link', 'route', 'full page url'],
    clicks: ['clicks', 'clic', 'clics', 'total clicks'],
    impressions: ['impressions', 'impresiones', 'impr', 'impr '],
    ctr: ['ctr', 'click through rate', 'tasa de clics', 'ctr %'],
    position: ['position', 'posicion', 'pos', 'rank', 'avg position', 'avg. position'],
    date: ['date', 'fecha', 'day', 'dia'],
    sessions: ['sessions', 'sesiones', 'session', 'sesion'],
    engagedSessions: ['engaged sessions', 'sesiones comprometidas', 'engaged sessions per user'],
    engagementRate: ['engagement rate', 'tasa de interaccion', 'engagement'],
    users: ['users', 'usuarios', 'total users', 'active users', 'total user'],
    volume: ['volume', 'volumen', 'search volume', 'volumen de busqueda'],
    kd: ['kd', 'keyword difficulty', 'difficulty', 'dificultad', 'competition'],
    cpc: ['cpc', 'cost per click', 'costo por clic'],
    intent: ['intent', 'intencion', 'keyword intent', 'intent type'],
    traffic: ['traffic', 'trafico', 'organic traffic', 'et traffic', 'visits']
  };

  function mapColumns(headers) {
    const map = {};
    headers.forEach((h, i) => {
      const hn = normHeader(h);
      if (!hn) return;
      for (const key of Object.keys(KEYS)) {
        if (map[key] != null) continue;
        const hits = KEYS[key].map((k) => k.trim());
        if (hits.some((k) => hn === k)) { map[key] = i; break; }
        // "2. Clicks" style: starts with number handled above; also "Impressions (CTR%)" ignore
      }
    });
    return map;
  }

  function detectKind(map) {
    if (map.keyword != null && (map.volume != null || map.position != null)) return 'semrush.keyword';
    if (map.query != null && (map.clicks != null || map.impressions != null)) return 'gsc.query';
    if (map.page != null && (map.clicks != null || map.impressions != null || map.position != null)) return 'gsc.page';
    if ((map.sessions != null || map.engagementRate != null || map.users != null) && map.page != null) return 'ga4.page';
    return null;
  }

  function findUnusedIndex(text) {
    // columnas duplicadas no mapeadas (ej. GA4 repite métrica): se ignora la 1ra
    return null;
  }

  // ---- normalización por plataforma ----
  function importText(text, name) {
    const rows = parseCSV(text);
    const result = { kind: null, rows: [], included: 0, skipped: 0, headers: [], note: null };

    // saltar líneas de metadata hasta encontrar una fila que parezca header
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      const hdrProbe = row.filter((f) => String(f).trim() !== '').length;
      if (hdrProbe >= 2) {
        const tryMap = mapColumns(row);
        const kind = detectKind(tryMap);
        if (kind) { headerIdx = i; break; }
      }
    }
    if (headerIdx === -1) {
      result.note = 'No se pudo detectar el formato. Revisá que el CSV venga de Search Console, GA4 o SEMrush.';
      return result;
    }

    const headers = rows[headerIdx];
    const map = mapColumns(headers);
    result.kind = detectKind(map);
    result.headers = headers.map(normHeader);

    const dataRows = rows.slice(headerIdx + 1).filter((r) =>
      r.some((f) => String(f).trim() !== '')
    );

    const seen = new Set();
    for (const row of dataRows) {
      const nr = normalizeRow(result.kind, map, row);
      if (!nr) continue;
      const key = JSON.stringify(nr);
      if (seen.has(key)) continue;
      seen.add(key);
      result.rows.push(nr);
      result.included++;
    }
    result.skipped = dataRows.length - result.included;

    if (!result.rows.length) {
      result.note = 'Se detectó el formato pero no quedó ninguna fila útil (posible problema de columnas).';
    }
    return result;
  }

  function cell(row, idx, parser) {
    if (idx == null) return null;
    const v = row[idx];
    if (v == null) return null;
    return parser ? parser(v) : String(v).trim();
  }

  function normalizeRow(kind, map, row) {
    const S = Store;
    switch (kind) {
      case 'gsc.query': {
        const q = cell(row, map.query);
        if (!q) return null;
        const clicks = cell(row, map.clicks, S.parseNum) || 0;
        const impressions = cell(row, map.impressions, S.parseNum) || 0;
        return {
          query: String(q).trim(),
          page: cell(row, map.page, S.normURL) || null,
          clicks, impressions,
          ctr: impressions ? ((cell(row, map.ctr, S.parseCtr)) ?? (clicks / impressions)) : 0,
          position: cell(row, map.position, S.parseNum) || null,
          date: cell(row, map.date, S.parseDate) || null
        };
      }
      case 'gsc.page': {
        const page = cell(row, map.page, S.normURL);
        if (!page) return null;
        const clicks = cell(row, map.clicks, S.parseNum) || 0;
        const impressions = cell(row, map.impressions, S.parseNum) || 0;
        return {
          page,
          clicks, impressions,
          ctr: impressions ? ((cell(row, map.ctr, S.parseCtr)) ?? (clicks / impressions)) : 0,
          position: cell(row, map.position, S.parseNum) || null,
          date: cell(row, map.date, S.parseDate) || null
        };
      }
      case 'ga4.page': {
        const page = cell(row, map.page, S.normURL);
        if (!page) return null;
        return {
          page,
          sessions: cell(row, map.sessions, S.parseNum) || 0,
          engaged: cell(row, map.engagedSessions, S.parseNum) || 0,
          engagementRate: (cell(row, map.engagementRate, (v) => {
            let n = S.parseNum(v);
            if (n == null) return null;
            if (String(v).includes('%') || n > 1) n = n / 100;
            return n;
          })) || null,
          users: cell(row, map.users, S.parseNum) || 0
        };
      }
      case 'semrush.keyword': {
        const kw = cell(row, map.keyword);
        if (!kw) return null;
        return {
          keyword: String(kw).trim(),
          intent: cell(row, map.intent) || null,
          position: cell(row, map.position, S.parseNum) || null,
          volume: cell(row, map.volume, S.parseNum) || 0,
          kd: cell(row, map.kd, S.parseNum) || null,
          cpc: cell(row, map.cpc, S.parseNum) || 0,
          traffic: cell(row, map.traffic, S.parseNum) || 0,
          url: cell(row, map.url, S.normURL) || null
        };
      }
      default:
        return null;
    }
  }

  return { parseCSV, importText, detectKind, mapColumns, normHeader };
})();

if (typeof window !== 'undefined') window.Importers = Importers;