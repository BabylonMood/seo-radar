'use strict';

const Analyze = (function () {

  const S = Store;

  // ---- agregados ----
  function aggQueries(rows) {
    const m = new Map();
    for (const r of rows) {
      const q = r.query;
      if (!m.has(q)) m.set(q, { query: q, clicks: 0, impr: 0, posW: 0, ctrSum: 0, pages: new Set() });
      const a = m.get(q);
      a.clicks += r.clicks || 0;
      a.impr += r.impressions || 0;
      a.posW += (r.position || 0) * (r.impressions || 0);
      if (r.ctr != null) a.ctrSum += r.ctr * (r.clicks || 0);
      if (r.page) a.pages.add(r.page);
    }
    const out = [];
    for (const a of m.values()) {
      out.push({
        query: a.query,
        clicks: a.clicks,
        impr: a.impr,
        ctr: a.clicks ? a.ctrSum / a.clicks : (a.impr ? 0 : 0),
        position: a.impr ? a.posW / a.impr : null,
        pages: [...a.pages].slice(0, 4)
      });
    }
    return out.sort((a, b) => b.impr - a.impr);
  }

  function aggPages(rows) {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.page)) m.set(r.page, { page: r.page, clicks: 0, impr: 0, posW: 0, ctrSum: 0 });
      const a = m.get(r.page);
      a.clicks += r.clicks || 0;
      a.impr += r.impressions || 0;
      a.posW += (r.position || 0) * (r.impressions || 0);
      if (r.ctr != null) a.ctrSum += r.ctr * (r.clicks || 0);
    }
    const out = [];
    for (const a of m.values()) {
      out.push({
        page: a.page,
        clicks: a.clicks,
        impr: a.impr,
        ctr: a.clicks ? a.ctrSum / a.clicks : (a.impr ? 0 : 0),
        position: a.impr ? a.posW / a.impr : null
      });
    }
    return out.sort((a, b) => b.impr - a.impr);
  }

  // ---- tendencias (requiere columna fecha) ----
  function buildTrends(rows) {
    const dates = [...new Set(rows.map((r) => r.date).filter(Boolean))].sort();
    if (dates.length < 2) return null;
    const mid = dates[Math.floor((dates.length - 1) / 2)];
    const A = aggQueries(rows.filter((r) => r.date && r.date <= mid));
    const B = aggQueries(rows.filter((r) => r.date && r.date > mid));
    const byKey = new Map(A.map((a) => [a.query, a]));
    const cfg = S.getSettings();
    const winners = [], losers = [], emerging = [];
    for (const b of B) {
      const a = byKey.get(b.query);
      if (!a) {
        if (b.clicks >= cfg.trendMinClicks / 2 && b.impr >= tech.imprEmerging) emerging.push(b);
        continue;
      }
      if (a.clicks < cfg.trendMinClicks && b.clicks < cfg.trendMinClicks) continue;
      const dClicks = b.clicks - a.clicks;
      const pct = a.clicks ? (dClicks / a.clicks) * 100 : 0;
      if (dClicks >= cfg.trendMinClicks && pct >= cfg.trendPct) winners.push({ ...b, from: a });
      else if (dClicks <= -cfg.trendMinClicks && pct <= -cfg.trendPct) losers.push({ ...b, from: a });
    }
    const sortLoss = (arr) => arr.sort((x, y) => (y.clicks - (y.from ? y.from.clicks : 0)) - (x.clicks - (x.from ? x.from.clicks : 0)));
    sortLoss(winners); sortLoss(losers);
    return {
      mid,
      winners: winners.slice(0, 8),
      losers: losers.slice(0, 8),
      emerging: emerging.slice(0, 8)
    };
  }

  const tech = { imprEmerging: 200 };

  // ---- oportunidades por query ----
  function queryOpps(agg) {
    const cfg = S.getSettings();
    const out = [];
    for (const a of agg) {
      const pos = a.position == null ? null : a.position;
      const ctrPct = a.ctr * 100;
      let type = null, detail = '';
      if (pos != null && pos <= 5 && ctrPct < cfg.ctrLow && a.impr >= cfg.minImprCtr) {
        type = 'ctr';
        detail = `Estás en posición ${Math.round(pos)} con CTR ${ctrPct.toFixed(1)}% y ${fmtI(a.impr)} impresiones. Un buen title + meta para ${sh(a.query, 40)} puede multiplicar los clics sin tocar el ranking.`;
      } else if (pos != null && pos >= cfg.posRankMin && pos <= cfg.posRankMax && a.impr >= cfg.minImprRank) {
        type = 'rank';
        detail = `Posición ${Math.round(pos)} con ${fmtI(a.impr)} impresiones para "${sh(a.query, 40)}". Si te interesa ese volumen, hay margen para escalar con contenido + enlazado.`;
      } else if (a.impr >= cfg.minImprInvisible && a.clicks === 0) {
        type = 'invisible';
        detail = `Apareces ${pos != null ? 'en posición ' + Math.round(pos) : ''} para "${sh(a.query, 40)}" (${fmtI(a.impr)} impresiones) pero sin un solo clic. El snippet no compite: revisá title, descripción y data-entidad.`;
      }
      if (!type) continue;
      const gapCtr = Math.max(0, 0.05 - a.ctr);
      const estGain = Math.round(a.impr * (type === 'rank' ? Math.max(0, 0.06 - a.ctr) : gapCtr));
      out.push({
        query: a.query, type, position: pos, ctr: a.ctr, impr: a.impr, clicks: a.clicks,
        pages: a.pages, estimateGain: estGain, detail
      });
    }
    const order = { ctr: 0, rank: 1, invisible: 2 };
    out.sort((a, b) => order[a.type] - order[b.type] || b.estimateGain - a.estimateGain);
    return out.slice(0, 20);
  }

  // ---- páginas (merge GSC + GA4) ----
  function pagesAnalysis() {
    const gscDs = S.getDataset('gsc.page');
    const ga4Ds = S.getDataset('ga4.page');
    if (!gscDs) return [];
    const cfg = S.getSettings();
    const pages = aggPages(gscDs.rows);
    const ga4 = new Map();
    if (ga4Ds) for (const r of ga4Ds.rows) {
      const p = ga4.get(r.page) || { page: r.page, sessions: 0, engaged: 0, rate: null };
      p.sessions += r.sessions || 0;
      p.engaged += r.engaged || 0;
      p.rate = r.engagementRate ?? p.rate;
      ga4.set(r.page, p);
    }
    const out = pages.map((p) => {
      const g = ga4.get(p.page) || null;
      const signals = [];
      if (p.impr >= cfg.minImprCtr * 2.5 && p.ctr * 100 < 1.5) {
        signals.push({ type: 'silent', label: 'Snippet que no convierte', detail: 'Muchas impresiones, CTR menor a 1.5%. El title/description no capta: probá variantes con la keyword de mayor volumen.' });
      }
      if (p.position && p.position >= 8 && p.position <= 25 && p.impr >= cfg.minImprRank) {
        signals.push({ type: 'rank', label: 'Nichada en posiciones medias', detail: `Posición ${Math.round(p.position)}: profundizar contenido y enlazado puede empujar al top 8.` });
      }
      if (g && g.sessions > 400 && (g.rate != null ? g.rate < 0.35 : (g.sessions ? g.engaged / g.sessions < 0.35 : false))) {
        signals.push({ type: 'engagement', label: 'El tráfico no se queda', detail: `${fmtI(g.sessions)} sesiones con tasa de interacción baja. El contenido no cumple la promesa del snippet.` });
      }
      return {
        page: p.page, clicks: p.clicks, impr: p.impr, ctr: p.ctr, position: p.position,
        sessions: g ? g.sessions : null, engagement: g ? (g.rate != null ? g.rate : (g.sessions ? g.engaged / g.sessions : null)) : null,
        signals
      };
    });
    out.sort((a, b) => b.impr - a.impr);
    return out.slice(0, 30);
  }

  // ---- canibalización ----
  function cannibalization() {
    const ds = S.getDataset('gsc.query');
    if (!ds) return [];
    const cfg = S.getSettings();
    const m = new Map();
    for (const r of ds.rows) {
      if (!r.page) continue;
      if (!m.has(r.query)) m.set(r.query, { query: r.query, pages: new Map() });
      const pm = m.get(r.query).pages;
      const p = pm.get(r.page) || { page: r.page, clicks: 0, impr: 0 };
      p.clicks += r.clicks || 0;
      p.impr += r.impressions || 0;
      pm.set(r.page, p);
    }
    const out = [];
    for (const { query, pages } of m.values()) {
      if (pages.size < 2) continue;
      const list = [...pages.values()].sort((a, b) => b.impr - a.impr);
      const totalImpr = list.reduce((s, p) => s + p.impr, 0);
      const totalClicks = list.reduce((s, p) => s + p.clicks, 0);
      if (totalImpr < cfg.cannibalMinImpr) continue;
      const top = list[0];
      const wastedImpr = totalImpr - top.impr;
      const wastedClicks = totalClicks - top.clicks;
      out.push({ query, pages: list, totalImpr, totalClicks, wastedImpr, wastedClicks, top });
    }
    out.sort((a, b) => b.totalImpr - a.totalImpr);
    return out.slice(0, 8);
  }

  // ---- SEMrush ----
  function semrushAnalysis() {
    const ds = S.getDataset('semrush.keyword');
    if (!ds) return null;
    const cfg = S.getSettings();
    const normSet = new Set(S.getDataset('gsc.query') ? S.getDataset('gsc.query').rows.map((r) => S.normKeyword(r.query)) : []);
    const quickWins = [], nearTop = [], gaps = [], intent = {};
    for (const r of ds.rows) {
      const intentKey = r.intent ? r.intent.charAt(0).toUpperCase() + r.intent.slice(1, 4) : '—';
      intent[intentKey] = (intent[intentKey] || 0) + 1;
      const vol = r.volume || 0;
      const kd = r.kd == null;
      const lowKd = !kd && r.kd <= cfg.semrushMaxKD;
      if (r.position != null && r.position >= 11 && r.position <= 20 && lowKd && vol >= 300) {
        quickWins.push({ ...r, estGain: Math.round(vol * 0.03) });
      } else if (r.position != null && r.position >= 2 && r.position <= 4 && vol >= 1000) {
        nearTop.push({ ...r, estGain: Math.round(vol * 0.02) });
      }
      if (vol >= 800 && lowKd) {
        const tokens = S.normTokens(r.keyword);
        const headToken = tokens[0];
        const covered = headToken ? [...normSet].some((q) => q.includes(headToken)) : true;
        if (!covered && (r.position == null || r.position >= 11)) {
          gaps.push({ ...r, tokens: tokens.length });
        }
      }
    }
    quickWins.sort((a, b) => b.volume - a.volume);
    nearTop.sort((a, b) => b.volume - a.volume);
    gaps.sort((a, b) => b.volume - a.volume);
    return {
      intent, tracked: ds.rows.length,
      quickWins: quickWins.slice(0, 8),
      nearTop: nearTop.slice(0, 8),
      gaps: gaps.slice(0, 8)
    };
  }

  // ---- recomendaciones priorizadas ----
  function buildRecs(ctx) {
    const recs = [];
    const highEst = Math.max(200, ctx.totalEstMedian * 2);

    for (const o of ctx.queryOpps) {
      const effort = o.type === 'ctr' ? 1 : (o.type === 'rank' ? 3 : 1);
      const priority = o.estimateGain >= highEst ? 'high' : 'med';
      recs.push({
        id: 'q-' + ctx.queryOpps.indexOf(o),
        title: (o.type === 'ctr' ? 'Mejorar snippet: ' : o.type === 'rank' ? 'Escalar: ' : 'Snippet no clicable: ') + o.query,
        detail: o.detail, module: 'Queries', priority, effortHrs: effort, impactEst: o.estimateGain,
        tags: [o.type], urls: o.pages
      });
    }
    if (ctx.trends) {
      for (const l of ctx.trends.losers) {
        const lost = l.from.clicks - l.clicks;
        recs.push({
          id: 'l-' + ctx.trends.losers.indexOf(l),
          title: 'Recuperar tráfico: ' + l.query,
          detail: `Perdiste ${fmtI(lost)} clics (de ${fmtI(l.from.clicks)} a ${fmtI(l.clicks)}). Revisá la SERP: entró un competidor o el contenido quedó desactualizado.`,
          module: 'Tendencias', priority: lost >= 60 ? 'high' : 'med', effortHrs: 2, impactEst: lost,
          tags: ['caída'], urls: []
        });
      }
      for (const e of ctx.trends.emerging) {
        recs.push({
          id: 'e-' + ctx.trends.emerging.indexOf(e),
          title: 'Capturar query emergente: ' + e.query,
          detail: `Empieza a ganar impresiones sin contenido dedicado. Creá o actualizá la página y ganá autoridad antes que otros.`,
          module: 'Tendencias', priority: 'med', effortHrs: 4, impactEst: Math.round(e.impr * 0.05),
          tags: ['nuevo'], urls: []
        });
      }
    }
    for (const p of ctx.pages) {
      if (!p.signals.length) continue;
      for (const s of p.signals) {
        const effort = s.type === 'silent' ? 1 : (s.type === 'rank' ? 4 : 3);
        recs.push({
          id: 'p-' + ctx.pages.indexOf(p) + '-' + s.type,
          title: `${s.label}: ${p.page}`,
          detail: s.detail, module: 'Páginas', priority: p.impr >= 6000 ? 'high' : 'med', effortHrs: effort,
          impactEst: Math.round(p.impr * 0.03), tags: [s.type], urls: [p.page]
        });
      }
    }
    for (const c of ctx.canni) {
      const est = c.wastedClicks || Math.round(c.wastedImpr * 0.02);
      recs.push({
        id: 'c-' + ctx.canni.indexOf(c),
        title: 'Canibalización: ' + c.query,
        detail: `${c.pages.length} páginas compiten por "${c.query}" (${fmtI(c.totalImpr)} impresiones). consolidá en una sola URL y redirigí / canónico al resto para no dividir autoridad.`,
        module: 'Canibalización', priority: est >= 40 ? 'high' : 'med', effortHrs: 2, impactEst: est,
        tags: ['arquitectura'], urls: c.pages.map((p) => p.page)
      });
    }
    if (ctx.semrush) {
      for (const q of ctx.semrush.quickWins) {
        recs.push({
          id: 's-' + ctx.semrush.quickWins.indexOf(q),
          title: 'Quick win SEMrush: ' + q.keyword,
          detail: `Pos ${q.position} · volumen ${fmtI(q.volume)} · KD ${q.kd}. Con contenido enfocado es probable que suba al top 10.`,
          module: 'SEMrush', priority: 'med', effortHrs: 6, impactEst: q.estGain,
          tags: ['contenido nuevo'], urls: q.url ? [q.url] : []
        });
      }
      for (const g of ctx.semrush.gaps) {
        recs.push({
          id: 'g-' + ctx.semrush.gaps.indexOf(g),
          title: 'Keyword gap: ' + g.keyword,
          detail: `Volumen ${fmtI(g.volume)} con KD ${g.kd} y no la ves posicionar en GSC. Oportunidad de contenido que hoy nadie te paga.`,
          module: 'SEMrush', priority: g.volume >= 3000 ? 'high' : 'med', effortHrs: 5, impactEst: Math.round(g.volume * 0.02),
          tags: ['gap', 'contenido nuevo'], urls: []
        });
      }
    }

    const rankOrder = { high: 0, med: 1, low: 2 };
    recs.sort((a, b) => rankOrder[a.priority] - rankOrder[b.priority] || b.impactEst - a.impactEst);
    return recs.slice(0, 40);
  }

  // ---- entrada principal ----
  function runAll() {
    const cfg = S.getSettings();
    const qRows = S.getDataset('gsc.query') ? S.getDataset('gsc.query').rows : [];
    const agg = qRows.length ? aggQueries(qRows) : [];
    const trends = qRows.length && qRows.some((r) => r.date) ? buildTrends(qRows) : null;
    const oppsList = queryOpps(agg);
    const pages = pagesAnalysis();
    const canni = cannibalization();
    const semrush = semrushAnalysis();

    const kpis = [];
    let totalClicks = 0, totalImpr = 0, ctrSum = 0, clicksCtr = 0, posSum = 0, posImpr = 0;
    const pageAgg = aggPages(S.getDataset('gsc.page') ? S.getDataset('gsc.page').rows : []);
    if (pageAgg.length) {
      totalClicks = pageAgg.reduce((s, p) => s + p.clicks, 0);
      totalImpr = pageAgg.reduce((s, p) => s + p.impr, 0);
      for (const p of pageAgg) { ctrSum += p.ctr * p.clicks; clicksCtr += p.clicks; if (p.position) { posSum += p.position * p.impr; posImpr += p.impr; } }
    } else if (agg.length) {
      totalClicks = agg.reduce((s, a) => s + a.clicks, 0);
      totalImpr = agg.reduce((s, a) => s + a.impr, 0);
      for (const a of agg) { ctrSum += a.ctr * a.clicks; clicksCtr += a.clicks; if (a.position) { posSum += a.position * a.impr; posImpr += a.impr; } }
    }
    kpis.push({ label: 'Clics totales', value: fmtI(totalClicks), hint: 'búsqueda orgánica' });
    kpis.push({ label: 'Impresiones', value: fmtI(totalImpr), hint: 'búsqueda orgánica' });
    kpis.push({ label: 'CTR promedio', value: (clicksCtr ? (ctrSum / clicksCtr) * 100 : 0).toFixed(1) + '%', hint: 'de clave a clic' });
    kpis.push({ label: 'Posición media', value: posImpr ? Math.round((posSum / posImpr) * 10) / 10 : '—', hint: 'ponderada por impresiones' });
    kpis.push({ label: 'Oportunidades', value: oppsList.length, hint: 'queries con margen' });
    kpis.push({ label: 'Canibalizaciones', value: canni.length, hint: 'grupos detectados' });

    const totalEstMedian = oppsList.length ? oppsList.map((o) => o.estimateGain).sort((a, b) => a - b)[Math.floor(oppsList.length / 2)] : 80;

    const recs = buildRecs({ queryOpps: oppsList, trends, pages, canni, semrush, totalEstMedian });

    return {
      kpis, agg: agg.slice(0, 12), trends, queryOpps: oppsList, pages,
      canni, semrush, recs,
      totalEstGain: recs.reduce((s, r) => s + (r.impactEst || 0), 0)
    };
  }

  function fmtI(n) {
    if (n == null || !isFinite(n)) return '—';
    return n >= 1000000 ? (n / 1000000).toFixed(1) + 'M'
      : n >= 10000 ? (n / 1000).toFixed(1) + 'k'
      : String(Math.round(n));
  }

  function fmtN(n) {
    if (n == null || !isFinite(n)) return '—';
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function sh(s, len) { return s.length > len ? s.slice(0, len - 1) + '…' : s; }

  return { runAll, aggQueries, aggPages, buildTrends, queryOpps, pagesAnalysis, cannibalization, semrushAnalysis, fmtI, fmtN, sh };
})();

if (typeof window !== 'undefined') window.Analyze = Analyze;