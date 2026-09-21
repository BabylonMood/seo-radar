'use strict';

const ContentReview = (function () {

  const S = Store;

  function stripTags(html) {
    return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function wordCount(text) {
    const t = stripTags(text);
    return t ? t.split(/\s+/).filter(Boolean).length : 0;
  }

  function kwTokens(keyword) {
    return S.normTokens(keyword);
  }

  function containsKeyword(text, keyword) {
    return kwCovered(text, keyword);
  }

  // siguimiento de la intención: frase exacta O todos los términos significativos presentes
  function kwCovered(text, keyword) {
    const n = S.normKeyword(text);
    if (!n) return false;
    if (n.includes(S.normKeyword(keyword))) return true;
    const tokens = kwTokens(keyword);
    if (!tokens.length) return false;
    return tokens.every((t) => n.includes(t));
  }

  function countPattern(text, pattern) {
    return (String(text).match(pattern) || []).length;
  }

  // checks: [{id, label, weight, status, detail}]
  function runChecks(o) {
    const checks = [];
    const w = o.content ? S.getSetting('contentMinWords') : 1200;
    const words = w;
    const content = o.content || '';
    const text = stripTags(content);

    const titleLen = (o.title || '').length;
    checks.push({
      id: 'title', label: 'Title (longitud)',
      status: titleLen >= 30 && titleLen <= 69 ? (titleLen >= 50 && titleLen <= 60 ? 'pass' : 'warn') : 'fail',
      weight: 10,
      detail: `${titleLen} caracteres (ideal 50-60).`
    });
    checks.push({
      id: 'titleKw', label: 'Keyword en el title',
      status: containsKeyword(o.title || '', o.keyword) ? 'pass' : 'fail',
      weight: 8, detail: 'Google usa el title para el snippet; incluir la keyword exacta ayuda al relevancia.'
    });
    const meta = o.meta || '';
    const metaLen = meta.length;
    checks.push({
      id: 'meta', label: 'Meta description (longitud)',
      status: metaLen >= 80 && metaLen <= 190 ? (metaLen >= 120 && metaLen <= 158 ? 'pass' : 'warn') : 'fail',
      weight: 8, detail: `${metaLen} caracteres (ideal 120-158).`
    });
    checks.push({
      id: 'metaKw', label: 'Keyword en la meta description',
      status: containsKeyword(meta, o.keyword) ? 'pass' : 'fail',
      weight: 5, detail: 'Aunque no es ranking directo, mejora CTR al resaltarse en el snippet.'
    });
    const h1Count = countPattern(content || '', /<h1[\s>]/gi);
    checks.push({
      id: 'h1', label: 'Un único H1',
      status: h1Count === 1 || (!content && (o.h1 || '').trim()) ? 'pass' : (h1Count === 0 ? 'fail' : 'warn'),
      weight: 8, detail: h1Count === 0 ? 'No se detectó H1.' : (h1Count > 1 ? h1Count + ' H1 detectados (debería haber 1).' : 'H1 detectado.')
    });
    checks.push({
      id: 'h1Kw', label: 'Keyword en el H1',
      status: containsKeyword(o.h1 || extractFirstHeading(content), o.keyword) ? 'pass' : 'fail',
      weight: 5, detail: 'La keyword principal debería estar en el H1, es la señal más fuerte de tema.'
    });
    const h2Count = countPattern(content || '', /<h2[\s>]/gi);
    const needH2 = text.split(/\s+/).filter(Boolean).length >= w ? 4 : 2;
    checks.push({
      id: 'hn', label: 'Estructura de H2/H3',
      status: h2Count > 0 ? (h2Count >= needH2 ? 'pass' : 'warn') : 'fail',
      weight: 6, detail: `${h2Count} H2 detectados (sugerido ≥ ${needH2} para este largo).`
    });
    const wc = wordCount(content || '');
    checks.push({
      id: 'words', label: 'Largura del contenido',
      status: wc >= w ? 'pass' : (wc >= w * 0.6 ? 'warn' : 'fail'),
      weight: 10, detail: `${wc} palabras (mínimo recomendado ${w}).`
    });
    const first120 = text.slice(0, 180);
    checks.push({
      id: 'first', label: 'Keyword en las primeras palabras',
      status: containsKeyword(first120, o.keyword) ? 'pass' : 'fail',
      weight: 6, detail: 'Reforzá la keyword en la introducción si tus datos muestran que es una query principal.'
    });
    if (wc > 100) {
      const density = (countPattern(' ' + text.toLowerCase() + ' ', new RegExp('\\b' + escapeRe(S.normKeyword(o.keyword).split(' ')[0]) + '\\b', 'g')) / wc) * 100;
      checks.push({
        id: 'density', label: 'Densidad de keyword',
        status: density >= 0.3 && density <= 3.5 ? 'pass' : (density < 0.3 ? 'warn' : 'warn'),
        weight: 4, detail: `${density.toFixed(2)}% (sana 0.5-2.5%).`
      });
    }
    const imgs = countPattern(content || '', /<img[\s>]/gi);
    const imgsAlt = countPattern(content || '', /<img[^>]+alt\s*=\s*["']?[^"'>\s]+/gi);
    checks.push({
      id: 'imgs', label: 'Imágenes con alt',
      status: imgs === 0 ? 'warn' : (imgsAlt >= imgs ? 'pass' : (imgsAlt >= 1 ? 'warn' : 'fail')),
      weight: 4, detail: `${imgs} imágenes, ${imgsAlt} con alt. El alt mejora el CTR en búsqueda de imágenes y accesibilidad.`
    });
    const internal = countPattern(content || '', /href\s*=\s*["']\/(?!\/)/gi);
    const external = countPattern(content || '', /href\s*=\s*["']https?:\/\/(?!.*(example|tu-dominio))/gi);
    checks.push({
      id: 'linksIn', label: 'Enlaces internos',
      status: internal >= 2 ? 'pass' : (internal === 1 ? 'warn' : 'fail'),
      weight: 4, detail: `${internal} internos. El enlazado interno distribuye autoridad y guía a la SERP objetivo.`
    });
    checks.push({
      id: 'linksOut', label: 'Enlaces externos / fuentes',
      status: external >= 1 ? 'pass' : 'warn',
      weight: 2, detail: `${external} externos. Citar fuentes agrega verificación y autoridad.`
    });

    return checks;
  }

  function extractFirstHeading(html) {
    const m = String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    return m ? stripTags(m[1]) : '';
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // temas relacionados a partir de GSC (semántica real de tus datos)
  function relatedQueries(keyword) {
    const ds = S.getDataset('gsc.query');
    if (!ds) return [];
    const tokens = kwTokens(keyword);
    if (!tokens.length) return [];
    const m = new Map();
    for (const r of ds.rows) {
      const q = S.normKeyword(r.query);
      if (!q.includes(S.normKeyword(keyword)) && !tokens.some((t) => q.includes(t))) continue;
      const prev = m.get(r.query) || { query: r.query, impr: 0, clicks: 0 };
      prev.impr += r.impressions || 0;
      prev.clicks += r.clicks || 0;
      m.set(r.query, prev);
    }
    return [...m.values()].sort((a, b) => b.impr - a.impr).slice(0, 8);
  }

  function schemaHint(keyword) {
    const k = S.normKeyword(keyword);
    const map = [
      { re: /precio|precios|cost|cuota|prestamo|cuota|sueldo|salario/, type: 'Article + FAQPage', note: 'contenido transaccional/comparativo' },
      { re: /compra|vender|promocion|descuento|oferta|shop|tienda/, type: 'Product + Review', note: 'intención transaccional' },
      { re: /como |por que |test |diferen /, type: 'Article + HowTo', note: 'intención informativa' },
      { re: /contenta|tabla|calendario|resultado|cotizacion/, type: 'Article + Dataset', note: 'datos estructurados por tabla' }
    ];
    for (const x of map) if (x.re.test(k)) return x;
    return { type: 'Article', note: 'schema base de artículo' };
  }

  function score(opts) {
    const checks = runChecks(opts || {});
    const total = checks.reduce((s, c) => s + c.weight, 0);
    const passed = checks.reduce((s, c) => s + (c.status === 'pass' ? c.weight : 0), 0);
    const score = Math.round((passed / Math.max(1, total)) * 100);
    const suggestions = [];
    for (const c of checks) {
      if (c.status === 'fail') suggestions.push('🔴 ' + c.label + ' — ' + c.detail);
      else if (c.status === 'warn') suggestions.push('🟡 ' + c.label + ' — ' + c.detail);
    }
    return { score, checks, suggestions, related: relatedQueries(opts.keyword), schema: schemaHint(opts.keyword) };
  }

  return { score, relatedQueries, schemaHint, wordCount, runChecks };
})();

if (typeof window !== 'undefined') window.ContentReview = ContentReview;