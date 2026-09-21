'use strict';

const Report = (function () {

  function escMd(s) {
    return String(s == null ? '' : s).replace(/[\n\r]/g, ' ').replace(/\|/g, '\\|');
  }

  function buildMarkdown(findings, contentResult) {
    const A = Analyze;
    const L = [];
    const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

    L.push('# Reporte de SEO orgánico', '');
    L.push('Fecha: ' + today + '  ');
    L.push('Generado por SEO Radar (análisis por reglas + datos importados).', '', '---', '');

    if (contentResult) {
      L.push('## Revisión de contenido', '', `Puntaje **${contentResult.score}/100**.`, '',
        '### Checklist', '');
      for (const c of contentResult.checks) {
        L.push(`- ${c.status === 'pass' ? '✅' : c.status === 'warn' ? '🟡' : '❌'} **${escMd(c.label)}** — ${escMd(c.detail)}`);
      }
      L.push('', '### Sugerencias', '');
      for (const s of contentResult.suggestions) L.push('- ' + escMd(s));
      L.push('', '---', '');
    }

    L.push('## KPIs del periodo', '', '| Métrica | Valor |', '|---|---|');
    for (const k of findings.kpis) L.push(`| ${escMd(k.label)} | ${escMd(k.value)} |`);
    L.push('', '---', '');

    if (findings.trends) {
      L.push('## Tendencias de queries', '');
      if (findings.trends.winners.length) {
        L.push('### Ganando tráfico', '', '| Query | Clics | Δ |', '|---|---|---|');
        for (const w of findings.trends.winners) L.push(`| ${escMd(w.query)} | ${A.fmtI(w.clicks)} | +${A.fmtI(w.clicks - w.from.clicks)} |`);
        L.push('');
      }
      if (findings.trends.losers.length) {
        L.push('### Perdiendo tráfico', '', '| Query | Clics | Δ |', '|---|---|---|');
        for (const l of findings.trends.losers) L.push(`| ${escMd(l.query)} | ${A.fmtI(l.clicks)} | -${A.fmtI(l.from.clicks - l.clicks)} |`);
        L.push('');
      }
      L.push('---', '');
    }

    if (findings.queryOpps.length) {
      L.push('## Oportunidades por query', '',
        '| Tipo | Query | Impr. | Pos | CTR | Est. clics extra |', '|---|---|---|---|---|---|');
      for (const o of findings.queryOpps) {
        L.push(`| ${o.type.toUpperCase()} | ${escMd(o.query)} | ${A.fmtI(o.impr)} | ${o.position != null ? Math.round(o.position) : '—'} | ${(o.ctr * 100).toFixed(1)}% | +${A.fmtI(o.estimateGain)} |`);
      }
      L.push('', '---', '');
    }

    if (findings.pages.filter((p) => p.signals.length).length) {
      L.push('## Páginas con señales', '', '| URL | Impr. | CTR | Pos | Señal |', '|---|---|---|---|---|');
      for (const p of findings.pages) {
        if (!p.signals.length) continue;
        for (const s of p.signals) {
          L.push(`| ${escMd(p.page)} | ${A.fmtI(p.impr)} | ${(p.ctr * 100).toFixed(1)}% | ${p.position != null ? Math.round(p.position) : '—'} | ${escMd(s.label)} |`);
        }
      }
      L.push('', '---', '');
    }

    if (findings.canni.length) {
      L.push('## Canibalizaciones', '', '| Query | Páginas | Impr. intactas | Impr. desperdiciadas |', '|---|---|---|---|');
      for (const c of findings.canni) {
        L.push(`| ${escMd(c.query)} | ${c.pages.length} | ${A.fmtI(c.totalImpr)} | ${A.fmtI(c.wastedImpr)} |`);
      }
      L.push('', '---', '');
    }

    if (findings.semrush) {
      L.push('## SEMrush', '');
      if (findings.semrush.quickWins.length) {
        L.push('### Quick wins', '', '| Keyword | Pos | Volumen | KD |', '|---|---|---|---|');
        for (const q of findings.semrush.quickWins) L.push(`| ${escMd(q.keyword)} | ${q.position} | ${A.fmtI(q.volume)} | ${q.kd} |`);
        L.push('');
      }
      if (findings.semrush.gaps.length) {
        L.push('### Keyword gaps (volumen sin posicionar)', '', '| Keyword | Volumen | KD |', '|---|---|---|');
        for (const g of findings.semrush.gaps) L.push(`| ${escMd(g.keyword)} | ${A.fmtI(g.volume)} | ${g.kd} |`);
        L.push('');
      }
      L.push('---', '');
    }

    L.push('## Plan de acción priorizado', '');
    const plan = { 'Acciones rápidas (≤ 2h)': [], 'Optimizaciones (1-4h)': [], 'Proyectos de contenido (≥ 5h)': [] };
    for (const r of findings.recs) {
      const bucket = r.effortHrs <= 2 ? 'Acciones rápidas (≤ 2h)' : r.effortHrs <= 4 ? 'Optimizaciones (1-4h)' : 'Proyectos de contenido (≥ 5h)';
      plan[bucket].push(r);
    }
    for (const bucket of Object.keys(plan)) {
      if (!plan[bucket].length) continue;
      L.push('### ' + bucket, '', '1. ' + plan[bucket].map((r, i) => `${i + 1}.**${escMd(r.title)}** (${r.effortHrs}h, impacto +${A.fmtI(r.impactEst)} clics) — ${escMd(r.detail)}`).join('\n1. '));
      L.push('');
    }
    L.push('---', '');

    L.push('_Herramienta definitiva de SEO en construcción_: los CSV exportados de Search Console, GA4 y SEMrush alimentan este análisis. Los datos viven solo en tu navegador.', '');
    return L.join('\n');
  }

  function download(text, filename) {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'reporte-seo.md';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  }

  return { buildMarkdown, download, copyText };
})();

if (typeof window !== 'undefined') window.Report = Report;