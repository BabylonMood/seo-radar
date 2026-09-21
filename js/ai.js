'use strict';

const AI = (function () {

  function buildContext(findings) {
    const s = Store.getSettings();
    const parts = [];
    parts.push('KPIs: ' + findings.kpis.map((k) => `${k.label} ${k.value}`).join(' · '));
    if (findings.trends) {
      parts.push('Ganadores: ' + findings.trends.winners.map((w) => `${w.query} +${w.clicks - w.from.clicks}`).join(', '));
      parts.push('Perdedores: ' + findings.trends.losers.map((l) => `${l.query} -${l.from.clicks - l.clicks}`).join(', '));
    }
    const fl = findings.queryOpps.filter((o) => o.type !== 'invisible').slice(0, 8);
    parts.push('Oportunidades: ' + fl.map((o) => `${o.type.toUpperCase()} ${o.query} (est. +${Analyze.fmtI(o.estimateGain)} clics)`).join(' | '));
    if (findings.canni.length) parts.push('Canibalizaciones: ' + findings.canni.map((c) => c.query).join(', '));
    if (findings.semrush) {
      parts.push('Quick wins SEMrush: ' + findings.semrush.quickWins.map((q) => `${q.keyword} (pos ${q.position}, KD ${q.kd})`).join(', '));
      if (findings.semrush.gaps.length) parts.push('Gaps: ' + findings.semrush.gaps.map((g) => g.keyword).join(', '));
    }
    const recs = findings.recs.slice(0, 12).map((r, i) =>
      `${i + 1}. [${r.priority}] ${r.title} — ${r.detail} (esfuerzo ${r.effortHrs}h)`
    );
    return { summary: parts.join('\n'), recs };
  }

  async function generateInsights(findings) {
    const s = Store.getSettings();
    if (!s.aiKey) throw new Error('Falta la API key: activá la IA en Ajustes.');
    const ctx = buildContext(findings);
    const system = 'Sos un director de SEO senior con 15 años de experiencia, metódico y directo. Analizás datos reales y devolvés recomendaciones accionables, priorizadas y sin humo. Respondés siempre en español rioplatense, en Markdown.';
    const user = [
      'Datos y hallazgos de un análisis orgánico:',
      ctx.summary,
      '',
      'Recomendaciones priorizadas del motor:',
      ctx.recs.join('\n'),
      '',
      'Responde con:',
      '## Resumen ejecutivo (3-4 líneas)',
      '## Top 5 acciones a tomar (con porqué y esfuerzo estimado)',
      '## Qué evitar hacer hoy',
      '## Indicadores a monitorear la próxima semana',
      '',
      'Fundamentá cada punto con los datos recibidos, no inventes métricas nuevas.'
    ].join('\n');

    const url = (s.aiEndpoint || '').trim();
    if (!url) throw new Error('Configurá el endpoint de IA en Ajustes.');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + s.aiKey
      },
      body: JSON.stringify({
        model: s.aiModel || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.4,
        max_tokens: 1800
      })
    });
    if (!res.ok) {
      let msg = 'Error HTTP ' + res.status;
      try { const e = await res.json(); msg = e.error && (e.error.message || e.error.type) ? (e.error.message || e.error.type) : msg; } catch (_) {}
      throw new Error(msg);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'Error del proveedor de IA');
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new Error('La IA no devolvió contenido.');
    return text;
  }

  return { generateInsights, buildContext };
})();

if (typeof window !== 'undefined') window.AI = AI;