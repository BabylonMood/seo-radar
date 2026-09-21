'use strict';

const App = (function () {

  const S = Store, A = Analyze, Imp = Importers;

  const TABS = [
    { id: 'dash', label: 'Inicio' },
    { id: 'data', label: 'Datos' },
    { id: 'analysis', label: 'Análisis' },
    { id: 'recs', label: 'Recomendaciones' },
    { id: 'content', label: 'Contenido' },
    { id: 'report', label: 'Reporte' },
    { id: 'settings', label: 'Ajustes' }
  ];

  let current = 'dash';
  let findingsCache = null;
  let contentLast = null;

  const $ = (id) => document.getElementById(id);

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function pct(f) { return (f * 100).toFixed(1) + '%'; }

  function findings() {
    if (!findingsCache) findingsCache = A.runAll();
    return findingsCache;
  }

  function invalidate() { findingsCache = null; }

  // ------------------------------------------------------------------
  //  helpers de render
  // ------------------------------------------------------------------
  function tableHtml(cols, rows, emptyText) {
    const ths = cols.map((c) => `<th>${c.h}</th>`).join('');
    let body;
    if (!rows.length) {
      body = `<tr><td colspan="${cols.length}"><span class="muted">${emptyText || 'Sin datos'}</span></td></tr>`;
    } else {
      body = rows.map((r) =>
        `<tr>${cols.map((c) => `<td class="${c.cls || ''}">${c.f(r)}</td>`).join('')}</tr>`
      ).join('');
    }
    return `<div class="table-wrap"><table><thead><tr>${ths}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function pill(prio) {
    const label = prio === 'high' ? 'Alta' : prio === 'med' ? 'Media' : 'Baja';
    return `<span class="pill ${prio}">${label}</span>`;
  }

  function tag(t) { return `<span class="tag">${esc(t)}</span>`; }

  function card(title, sub, inner, extra) {
    return `<div class="card">${title ? `<h2>${esc(title)}</h2>` : ''}${sub ? `<div class="sub">${esc(sub)}</div>` : ''}${inner}${extra || ''}</div>`;
  }

  function datasetChip(kind) {
    const ds = S.getDataset(kind);
    if (!ds) return null;
    const info = S.DATASET_INFO[kind];
    return `<span class="chip">${esc(info.label)}: <b>${ds.rows.length}</b> filas</span>`;
  }

  function renderStatus() {
    let html = '';
    for (const kind of Object.keys(S.DATASET_INFO)) {
      const chip = datasetChip(kind);
      if (chip) html += chip;
    }
    if (!S.listDatasets().length) {
      html = '<span class="chip muted">Sin datos cargados — empezá por la pestaña <b>Datos</b> o cargá los ejemplos.</span>';
    }
    $('statusstrip').innerHTML = html;
  }

  function renderTabs() {
    $('tabs').innerHTML = TABS.map((t) =>
      `<button class="tab ${t.id === current ? 'active' : ''}" data-act="tab" data-tab="${t.id}">${t.label}</button>`
    ).join('');
  }

  function renderView() {
    const v = $('view');
    switch (current) {
      case 'dash': v.innerHTML = viewDash(); break;
      case 'data': v.innerHTML = viewData(); break;
      case 'analysis': v.innerHTML = viewAnalysis(); break;
      case 'recs': v.innerHTML = viewRecs(); break;
      case 'content': v.innerHTML = viewContent(); break;
      case 'report': v.innerHTML = viewReport(); break;
      case 'settings': v.innerHTML = viewSettings(); break;
    }
  }

  function show(tab) {
    current = tab;
    renderTabs();
    renderView();
    renderStatus();
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------
  //  VISTAS
  // ------------------------------------------------------------------
  function viewDash() {
    const f = findings();
    const hasData = S.listDatasets().length > 0;
    if (!hasData) {
      return `<div class="empty">
        <p style="font-size:15px;" class="muted">Todavía no hay datos.</p>
        <p>Subí tus CSVs de Search Console, GA4 o SEMrush (pestaña <b>Datos</b>),<br>o cargá los datos de ejemplo para ver el radar en acción.</p>
        <div class="spacer"></div>
        <button class="btn-primary" data-act="samples-all">Cargar datos de ejemplo</button>
      </div>`;
    }
    const kpiHtml = f.kpis.map((k) =>
      `<div class="kpi"><div class="v">${esc(k.value)}</div><div class="l">${esc(k.label)}</div><div class="h">${esc(k.hint)}</div></div>`
    ).join('');

    const topRecs = f.recs.slice(0, 5).map((r) => recCard(r)).join('');
    return `
      <div class="kpis">${kpiHtml}</div>
      <div class="card" style="border-color:${f.totalEstGain > 0 ? 'var(--signal)' : 'var(--border)'};">
        <div class="rowline">
          <div><b style="font-family:'Space Grotesk';font-size:15px;">Clics recuperables / ganables estimados</b>
            <div class="muted small">Suma de impacto de las recomendaciones priorizadas.</div>
          </div>
          <div style="margin-left:auto;font-family:'Space Grotesk';font-size:20px;font-weight:700;color:var(--signal);">+${esc(A.fmtI(f.totalEstGain))}</div>
        </div>
      </div>
      <div class="rowline" style="margin-bottom:14px;">
        <button class="btn-primary" data-act="nav" data-tab="recs">Ver recomendaciones (${f.recs.length})</button>
        <button data-act="nav" data-tab="analysis">Ir al análisis</button>
        <button data-act="nav" data-tab="report">Generar reporte</button>
      </div>
      ${card('Prioridades para hoy', 'Lo más accionable ordenado por impacto y esfuerzo.', topRecs || '<span class="muted">No detectamos recomendaciones todavía. Revisá si los CSVs tienen las columnas esperadas.</span>')}`;
  }

  function viewData() {
    const kinds = Object.keys(S.DATASET_INFO);
    const cards = kinds.map((k) => {
      const info = S.DATASET_INFO[k];
      const ds = S.getDataset(k);
      const state = ds
        ? `<div class="rowline" style="margin-top:8px;">${tag('Activo')}<span class="muted small">${ds.rows.length} filas · ${new Date(ds.meta.date).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>`
        : '<div class="muted small" style="margin-top:8px;">No cargado aún</div>';
      return card(info.label, info.hint, `
        <div class="dropzone">
          <label>⬆ Importar CSV de ${esc(info.label.split('·')[1] || info.label)}
            <input type="file" accept=".csv,text/csv" data-file="${k}">
          </label>
        </div>
        <div id="fb-${k}"></div>
        ${state}
        <div class="rowline" style="margin-top:10px;">
          <button data-act="sample" data-kind="${k}">Cargar ejemplo</button>
          ${ds ? `<button class="btn-danger" data-act="rm" data-kind="${k}">Quitar</button>` : ''}
        </div>
      `);
    }).join('');

    return `
      <div class="rowline" style="margin-bottom:14px;">
        <button class="btn-primary" data-act="samples-all">Cargar todos los ejemplos</button>
        <button class="btn-danger" data-act="reset-all">Borrar todos los datos</button>
      </div>
      <div class="field"><label>Importación automática</label>
        <div class="dropzone"><label>⬆ Soltar una exportación cualquiera (GSC / GA4 / SEMrush) — detecta la plataforma sola
          <input type="file" accept=".csv,text/csv" data-file="auto">
        </label></div>
        <div id="fb-auto" style="margin-top:6px;"></div>
        <div class="help">Columnas mapeadas automáticamente (soporta inglés/español, export de Search Console nuevo y legacy, GA4 y SEMrush).</div>
      </div>
      <div class="grid2">${cards}</div>`;
  }

  function viewAnalysis() {
    const f = findings();
    const out = [];

    if (f.trends) {
      let html = '';
      if (f.trends.winners.length) {
        html += card('Queries ganando tráfico', 'Comparación entre la primera y la segunda mitad del periodo importado.',
          tableHtml([
            { h: 'Query', f: (r) => '<b>' + esc(r.query) + '</b>' },
            { h: 'Clics ahora', cls: 'num', f: (r) => A.fmtI(r.clicks) },
            { h: 'Δ', cls: 'num', f: (r) => '<span class="posdelta down">+' + A.fmtI(r.clicks - r.from.clicks) + '</span>' },
            { h: 'Pos', cls: 'num', f: (r) => (r.position != null ? Math.round(r.position) : '—') }
          ], f.trends.winners));
      }
      if (f.trends.losers.length) {
        html += card('Queries perdiendo tráfico', '',
          tableHtml([
            { h: 'Query', f: (r) => '<b>' + esc(r.query) + '</b>' },
            { h: 'Clics antes', cls: 'num', f: (r) => A.fmtI(r.from.clicks) },
            { h: 'Ahora', cls: 'num', f: (r) => A.fmtI(r.clicks) },
            { h: 'Δ', cls: 'num', f: (r) => '<span class="posdelta up">-' + A.fmtI(r.from.clicks - r.clicks) + '</span>' },
            { h: 'Pos', cls: 'num', f: (r) => (r.from.position != null ? Math.round(r.from.position) : '—') + ' → ' + (r.position != null ? Math.round(r.position) : '—') }
          ], f.trends.losers));
      }
      if (f.trends.emerging.length) {
        html += card('Queries emergentes', 'Ganan impresiones sin contenido que las capture.',
          tableHtml([
            { h: 'Query', f: (r) => '<b>' + esc(r.query) + '</b>' },
            { h: 'Impr.', cls: 'num', f: (r) => A.fmtI(r.impr) },
            { h: 'Clics', cls: 'num', f: (r) => A.fmtI(r.clicks) }
          ], f.trends.emerging));
      }
      out.push(html || '<span class="muted">Con fechas alcanzó para comparar periodos.</span>');
    } else {
      out.push(card('Tendencias', 'No se detectaron fechas en los CSVs. Exportá con la dimensión de fecha (o un rango comparado) para ver ganadores/perdedores.',
        '<span class="muted">Comparación entre periodos no disponible con los datos actuales.</span>'));
    }

    out.push(card('Oportunidades por query',
      'Solicita clics sin tocarte el ranking, posiciones medias con volumen, o aparecés sin convertir.',
      tableHtml([
        { h: 'Tipo', f: (r) => { const t = { ctr: ['Snippet', 'kind'], rank: ['Rank', 'kind'], invisible: ['Invisible', 'kind'] }[r.type]; return `<span class="pill kind">${t[0]}</span>`; } },
        { h: 'Query', f: (r) => '<b>' + esc(r.query) + '</b>' + (r.pages.length ? '<br><span class="muted small">' + r.pages.map((p) => esc(p)).join('<br>') + '</span>' : '') },
        { h: 'Impr.', cls: 'num', f: (r) => A.fmtI(r.impr) },
        { h: 'Pos', cls: 'num', f: (r) => (r.position != null ? Math.round(r.position) : '—') },
        { h: 'CTR', cls: 'num', f: (r) => pct(r.ctr) },
        { h: 'Est. +clics', cls: 'num', f: (r) => '<span class="posdelta down">+' + A.fmtI(r.estimateGain) + '</span>' }
      ], f.queryOpps, 'No hay oportunidades con los umbrales actuales.')));

    out.push(card('Páginas con señales',
      'Silenciosas (impresiones sin clic), nichadas en posiciones medias o con caída de interacción.',
      tableHtml([
        { h: 'URL', f: (r) => '<b>' + esc(r.page) + '</b>' },
        { h: 'Impr.', cls: 'num', f: (r) => A.fmtI(r.impr) },
        { h: 'CTR', cls: 'num', f: (r) => pct(r.ctr) },
        { h: 'Pos', cls: 'num', f: (r) => (r.position != null ? Math.round(r.position) : '—') },
        { h: 'Sesiones', cls: 'num', f: (r) => (r.sessions != null ? A.fmtI(r.sessions) : '—') },
        { h: 'Señal', f: (r) => (r.signals || []).map((s) => tag(s.label)).join(' ') }
      ], f.pages.filter((p) => p.signals.length), 'No hay señales con estos datos.')));

    out.push(card('Canibalización',
      'Varias páginas compiten por la misma query y se reparten impresiones. Detalle debajo.',
      tableHtml([
        { h: 'Query', f: (r) => '<b>' + esc(r.query) + '</b>' },
        { h: 'Páginas', cls: 'num', f: (r) => r.pages.length },
        { h: 'Impr. total', cls: 'num', f: (r) => A.fmtI(r.totalImpr) },
        { h: 'Impr. desperdiciadas', cls: 'num', f: (r) => '<span class="posdelta up">' + A.fmtI(r.wastedImpr) + '</span>' },
        { h: 'Detalle', f: (r) => `<details><summary class="small">ver URLs</summary>
          ${r.pages.map((p) => `<div class="small">${esc(p.page)} · ${A.fmtI(p.impr)} impr · ${A.fmtI(p.clicks)} clics</div>`).join('')}
        </details>` }
      ], f.canni, 'Sin canibalización. O exportá con dimensión de página por query para detectarla.')));

    if (f.semrush) {
      let html = card('SEMrush · Quick wins', 'Keywords en posiciones 11-20 con dificultad baja (o sin dato) y volumen. Empujalas al top 10.',
        tableHtml([
          { h: 'Keyword', f: (r) => '<b>' + esc(r.keyword) + '</b>' + (r.url ? '<br><span class="muted small">' + esc(r.url) + '</span>' : '') },
          { h: 'Pos', cls: 'num', f: (r) => r.position },
          { h: 'Vol', cls: 'num', f: (r) => A.fmtI(r.volume) },
          { h: 'KD', cls: 'num', f: (r) => r.kd != null ? r.kd : '—' },
          { h: 'Est.', cls: 'num', f: (r) => (r.intent != null ? tag(r.intent) : '') }
        ], f.semrush.quickWins, 'No hay quick wins con los umbrales actuales.'));
      if (f.semrush.nearTop.length) {
        html += card('SEMrush · A un paso del top 1', '',
          tableHtml([
            { h: 'Keyword', f: (r) => '<b>' + esc(r.keyword) + '</b>' },
            { h: 'Pos', cls: 'num', f: (r) => r.position },
            { h: 'Vol', cls: 'num', f: (r) => A.fmtI(r.volume) },
            { h: 'KD', cls: 'num', f: (r) => r.kd != null ? r.kd : '—' }
          ], f.semrush.nearTop));
      }
      if (f.semrush.gaps.length) {
        html += card('SEMrush · Keyword gaps', 'Volumen alto, dificultad baja y no las ves posicionando en GSC. Contenido que nadie te está pagando.',
          tableHtml([
            { h: 'Keyword', f: (r) => '<b>' + esc(r.keyword) + '</b>' },
            { h: 'Vol', cls: 'num', f: (r) => A.fmtI(r.volume) },
            { h: 'KD', cls: 'num', f: (r) => r.kd != null ? r.kd : '—' }
          ], f.semrush.gaps));
      }
      out.push(html);
    }

    return out.join('');
  }

  function recCard(r) {
    return `<div class="card rec ${r.priority}">
      <div class="rec-top">
        <h4>${esc(r.title)}</h4>
        <div class="rowline">${pill(r.priority)}</div>
      </div>
      <div class="detail">${esc(r.detail)}</div>
      <div class="meta">
        <span>${tag('+' + A.fmtI(r.impactEst) + ' clics')}</span>
        <span>${tag(r.effortHrs + 'h esfuerzo')}</span>
        ${r.tags.map((t) => tag(t)).join('')}
        <span class="muted">${esc(r.module)}</span>
      </div>
      ${r.urls && r.urls.length ? '<div class="urls" style="margin-top:6px;">' + r.urls.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`).join('') + '</div>' : ''}
    </div>`;
  }

  function viewRecs() {
    const f = findings();
    const hasKey = !!S.getSetting('aiKey');
    const recTitle = 'Recomendaciones priorizadas (' + f.recs.length + ')';
    return `
      ${card('Motor de decisiones', 'Todas las detecciones pasan por un scoring de impacto vs esfuerzo. La IA de Ajustes puede redactar las explicaciones en lenguaje natural.', '')}
      <div class="card">
        <div class="rowline">
          <button class="btn-primary" data-act="ai-recs"${hasKey ? '' : ' disabled'}>✨ Generar insights con IA</button>
          <span class="muted small">${hasKey ? 'IA configurada' : 'IA no configurada (activá en Ajustes)'}</span>
        </div>
        <div id="ai-recs-out"></div>
      </div>
      ${card(recTitle, '', f.recs.map(recCard).join('') || '<span class="muted">No hay recomendaciones con estos datos.</span>')}`;
  }

  function viewContent() {
    return `
      ${card('Revisión de contenido', 'Pegá la keyword principal y tu contenido (puede ser HTML). Recibirás un score on-page, checklist accionable y temas relacionados detectados en tus propios datos de GSC.', '')}
      <div class="card">
        <div class="field-row">
          <div class="field"><label>Keyword principal</label><input id="c-kw" placeholder="ej: calculadora sueldo neto" value=""></div>
          <div class="field"><label>URL / slug (opcional)</label><input id="c-url" placeholder="https://ejemplo.ar/calculadora/sueldo-neto"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Title</label><input id="c-title" placeholder="Calculadora de sueldo neto 2026"> <div class="help" id="c-title-ct">0 caracteres</div></div>
          <div class="field"><label>Meta description</label><input id="c-meta" placeholder="Calculá tu salario neto..."> <div class="help" id="c-meta-ct">0 caracteres</div></div>
        </div>
        <div class="field"><label>H1</label><input id="c-h1" placeholder="Calculadora de sueldo neto"></div>
        <div class="field"><label>Contenido (HTML o texto plano)</label>
          <textarea id="c-content" style="min-height:150px;" placeholder="Pegá acá el artículo o página..."></textarea>
          <div class="help" id="c-words">0 palabras</div>
        </div>
        <button class="btn-primary" data-act="content-run">Analizar contenido</button>
      </div>
      <div id="content-out"></div>`;
  }

  function viewReport() {
    const f = findings();
    const md = Report.buildMarkdown(f, contentLast);
    const hasKey = !!S.getSetting('aiKey');
    return `
      <div class="card">
        <div class="rowline">
          <button class="btn-primary" data-act="export-report">⬇ Descargar .md</button>
          <button data-act="copy-report">Copiar</button>
          <button data-act="ai-report"${hasKey ? '' : ' disabled'}>✨ Redacción con IA</button>
          <span id="copy-msg" class="muted small"></span>
        </div>
        <div class="muted small" style="margin-top:8px;">El reporte incluye KPIs, tendencias, oportunidades, canibalización, SEMrush, plan de acción y la revisión de contenido si la corriste.</div>
      </div>
      <div class="card"><h3>Vista previa</h3><pre class="ajax-out" id="report-preview">${esc(md)}</pre></div>`;
  }

  function viewSettings() {
    const s = S.getSettings();
    const numInput = (key, label, help) => `
      <div class="field"><label>${label}</label>
        <input type="number" step="any" id="set-${key}" value="${esc(s[key])}">
        <div class="help">${help}</div></div>`;
    return `
      <div class="grid2">
        <div>
          ${card('Umbrales de análisis', 'Ajustá cuándo se considera una oportunidad. Así el radar refleja tu realidad (volumen, industria, objetivo).',
            `<div class="field-row">${numInput('ctrLow', 'CTR mínimo para “snippet”', '% por debajo del cual un top 5 es oportunidad de title/meta.')}</div>
            <div class="field-row">${numInput('posRankMin', 'Posición mín. para escalar', 'Desde qué posición se marca un rank para subir.')}${numInput('posRankMax', 'Posición máx. para escalar', 'Hasta qué posición sigue siendo escalable.')}</div>
            <div class="field-row">${numInput('minImprCtr', 'Impr. mín. (CTR)', 'Impresiones mínimas para considerar oport. de snippet.')}${numInput('minImprRank', 'Impr. mín. (rank)', 'Impresiones mínimas para considerar oport. de rank.')}</div>
            <div class="field-row">${numInput('minImprInvisible', 'Impr. mín. invisible', 'Impresiones mínimas para marcar “aparece sin clic”.')}<div class="field"></div></div>
            <div class="field-row">${numInput('cannibalMinImpr', 'Impr. mín. canibalización', 'Impresiones del grupo para detectar canibalización.')}${numInput('contentMinWords', 'Palabras mín. de contenido', 'Referencia para el content reviewer.')}</div>
            <div class="field-row">${numInput('trendMinClicks', 'Clics mín. tendencia', 'Cambio mínimo en clics para marcar ganador/perdedor.')}${numInput('trendPct', '% de cambio tendencia', 'Cambio porcentual mínimo para marcar ganador/perdedor.')}</div>
            <div class="field-row">${numInput('semrushMaxKD', 'KD máx. quick win', 'Dificultad máxima para considerar quick win SEMrush.')}</div>`)}
          ${card('Datos', '', `
            <div class="rowline">
              <button data-act="samples-all">Cargar todos los ejemplos</button>
              <button class="btn-danger" data-act="reset-all">Borrar todos los datos</button>
            </div>`)}
        </div>
        <div>
          ${card('IA híbrida (opcional)', 'Se manda un resumen compacto de tus hallazgos a un endpoint compatible con OpenAI. Los datos crudos nunca salen de tu navegador.',
            `<div class="field"><label>Endpoint (compatible con /chat/completions)</label><input id="set-aiEndpoint" value="${esc(s.aiEndpoint)}"></div>
            <div class="field-row">
              <div class="field"><label>Modelo</label><input id="set-aiModel" value="${esc(s.aiModel)}"></div>
              <div class="field"><label>API key</label><input id="set-aiKey" type="password" value="${esc(s.aiKey)}" placeholder="sk-..."></div>
            </div>
            <div class="help small muted" style="margin-bottom:12px;">Guardada en localStorage de este navegador. Usala con cuidado (es una llave de pago).</div>
            <div class="rowline"><button class="btn-primary" data-act="settings-save">Guardar ajustes</button> <span id="settings-msg" class="muted small"></span></div>`)}
        </div>
      </div>`;
  }

  // ------------------------------------------------------------------
  //  acciones
  // ------------------------------------------------------------------
  function loadSamples() {
    for (const kind of Object.keys(SAMPLES)) {
      const res = Imp.importText(SAMPLES[kind], 'ejemplo');
      if (res.kind) S.setDataset(kind, { rows: res.rows, name: 'Datos de ejemplo', source: 'sample' });
    }
    invalidate();
    show(current);
  }

  function handleFile(file, expectedKind, fbId) {
    const fb = $(fbId);
    if (!fb) return;
    fb.innerHTML = '<span class="muted small">Leyendo ' + esc(file.name) + '…</span>';
    const reader = new FileReader();
    reader.onload = () => {
      const res = Imp.importText(reader.result, file.name);
      if (!res.kind) {
        fb.innerHTML = '<span style="color:var(--danger);font-size:11.5px;">❌ ' + esc(res.note || 'Formato no reconocido') + '</span>';
        return;
      }
      if (expectedKind && expectedKind !== 'auto' && res.kind !== expectedKind) {
        const info = S.DATASET_INFO[res.kind];
        window.__pendingImport = window.__pendingImport || {};
        window.__pendingImport[fbId] = { kind: res.kind, ds: { rows: res.rows, name: file.name, source: 'import' } };
        fb.innerHTML = `<span style="color:var(--amber);font-size:11.5px;display:inline-flex;gap:8px;align-items:center;">
          Detectado como <b>${esc(info.label)}</b> (no ${esc(S.DATASET_INFO[expectedKind].label)}).
          <button class="link-inline" data-act="save-as" data-id="${fbId}">Importar de todos modos</button></span>`;
        return;
      }
      S.setDataset(res.kind, { rows: res.rows, name: file.name, source: 'import' });
      fb.innerHTML = `<span style="color:var(--signal);font-size:11.5px;">✓ Importadas ${res.rows.length} filas (${res.skipped} descartadas duplicadas/vacías) → ${esc(S.DATASET_INFO[res.kind].label)}</span>`;
      invalidate();
      show(current);
    };
    reader.onerror = () => { fb.innerHTML = '<span style="color:var(--danger);font-size:11.5px;">❌ No se pudo leer el archivo.</span>'; };
    reader.readAsText(file);
  }

  function saveAs(id) {
    const pending = window.__pendingImport && window.__pendingImport[id];
    if (!pending) return;
    S.setDataset(pending.kind, pending.ds);
    delete window.__pendingImport[id];
    invalidate();
    show(current);
  }

  // ------------------------------------------------------------------
  //  eventos (delegación)
  // ------------------------------------------------------------------
  function onDocClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;

    if (act === 'tab') show(el.dataset.tab);
    else if (act === 'nav') show(el.dataset.tab);
    else if (act === 'samples-all') loadSamples();
    else if (act === 'sample') {
      const kind = el.dataset.kind;
      if (SAMPLES[kind]) {
        const res = Imp.importText(SAMPLES[kind], 'ejemplo');
        if (res.kind) { S.setDataset(kind, { rows: res.rows, name: 'Datos de ejemplo', source: 'sample' }); invalidate(); show(current); }
      }
    }
    else if (act === 'rm') { S.removeDataset(el.dataset.kind); invalidate(); show(current); }
    else if (act === 'reset-all') {
      if (confirm('¿Borrar todos los datos y ajustes? Esta acción no se puede deshacer.')) {
        S.resetAll(); window.__pendingImport = null; invalidate(); contentLast = null; show('dash');
      }
    }
    else if (act === 'save-as') { saveAs(el.dataset.id); }
    else if (act === 'content-run') runContent();
    else if (act === 'settings-save') saveSettings();
    else if (act === 'ai-recs') runAI('ai-recs-out');
    else if (act === 'ai-report') runAI('report-preview', true);
    else if (act === 'export-report') {
      Report.download(Report.buildMarkdown(findings(), contentLast), generarFile('reporte-seo.md'));
    }
    else if (act === 'copy-report') {
      Report.copyText(Report.buildMarkdown(findings(), contentLast)).then((ok) => {
        const msg = $('copy-msg');
        if (msg) msg.textContent = ok ? 'Copiado ✓' : 'No se pudo copiar: usá el .md';
      });
    }
  }

  function generarFile(prefix) {
    const d = new Date();
    return prefix.replace('.md', '-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.md');
  }

  function onDocChange(e) {
    const input = e.target.closest('input[data-file]');
    if (!input) return;
    const file = input.files && input.files[0];
    if (!file) return;
    handleFile(file, input.dataset.file, 'fb-' + input.dataset.file);
    input.value = '';
  }

  // ------------------------------------------------------------------
  //  contenido
  // ------------------------------------------------------------------
  function runContent() {
    const kw = $('c-kw').value.trim();
    if (!kw) { $('content-out').innerHTML = '<div class="muted small">Poné al menos la keyword principal.</div>'; return; }
    const res = ContentReview.score({
      keyword: kw,
      url: $('c-url').value.trim(),
      title: $('c-title').value.trim(),
      meta: $('c-meta').value.trim(),
      h1: $('c-h1').value.trim(),
      content: $('c-content').value
    });
    contentLast = { score: res.score, checks: res.checks, suggestions: res.suggestions };

    const ringClass = res.score >= 70 ? 'good' : res.score >= 45 ? 'mid' : 'ghost';
    const checks = res.checks.map((c) => {
      const ic = c.status === 'pass' ? '<span class="ok">✓</span>' : c.status === 'warn' ? '<span class="wa">!</span>' : '<span class="ko">✕</span>';
      const st = c.status === 'pass' ? 'ok' : c.status === 'warn' ? 'wa' : 'ko';
      return `<li><span class="ic">${ic}</span><span class="ck-info">${esc(c.label)}<br><span class="muted small">${esc(c.detail)}</span></span><span class="ck-status ${st}">${c.status}</span></li>`;
    }).join('');

    const related = res.related.length
      ? res.related.map((r) => `<span class="tag">${esc(r.query)} · ${A.fmtI(r.impr)} impr</span>`).join(' ')
      : '<span class="muted small">No hay datos de GSC cargados: cargalos y reaparecen los temas que conviene cubrir.</span>';

    const snippet = res.url || '';
    $('content-out').innerHTML = `
      <div class="card">
        <div class="scorebox">
          <div class="score-ring ${ringClass}">${res.score}</div>
          <div class="score-side">
            <b>Score on-page</b><br>
            ${res.score >= 70 ? 'Buen estado general. Priorizá corregir los warns.' : res.score >= 45 ? 'Hay margen claro de mejora: atacá los fallos primero.' : 'Necesita reescritura o ajustes importantes.'}<br>
            <span class="small">Schema sugerido: <b>${esc(res.schema.type)}</b> — ${esc(res.schema.note)}.</span>
          </div>
        </div>
        <h3>Checklist</h3>
        <ul class="checklist">${checks}</ul>
        ${res.suggestions.length ? '<h3>Sugerencias</h3><ul class="checklist">' + res.suggestions.map((s) => `<li>${s}</li>`).join('') + '</ul>' : ''}
        <h3>Temas relacionados a cubrir (de tus datos GSC)</h3>
        <div class="rowline">${related}</div>
        <h3>Vista previa del snippet</h3>
        <div class="snippet-preview">
          <div class="u">${esc(snippet)}</div>
          <div class="t">${esc($('c-title').value.trim() || '(title vacío)')}</div>
          <div class="d">${esc($('c-meta').value.trim() || '(meta vacía)')}</div>
        </div>
      </div>`;
  }

  // ------------------------------------------------------------------
  //  config
  // ------------------------------------------------------------------
  function saveSettings() {
    const s = S.getSettings();
    const numeric = ['ctrLow', 'posRankMin', 'posRankMax', 'minImprCtr', 'minImprRank', 'minImprInvisible', 'cannibalMinImpr', 'contentMinWords', 'trendMinClicks', 'trendPct', 'semrushMaxKD'];
    const patch = {};
    for (const k of numeric) {
      const el = $('set-' + k);
      if (el) patch[k] = parseFloat(el.value);
    }
    for (const k of ['aiEndpoint', 'aiModel', 'aiKey']) {
      const el = $('set-' + k);
      if (el) patch[k] = el.value.trim();
    }
    S.updateSettings(patch);
    invalidate();
    const msg = $('settings-msg');
    if (msg) { msg.textContent = 'Guardado ✓'; setTimeout(() => { msg.textContent = ''; }, 2000); }
  }

  // ------------------------------------------------------------------
  //  IA
  // ------------------------------------------------------------------
  async function runAI(outId, isReport) {
    const out = $(outId);
    if (!out) return;
    const f = findings();
    try {
      out.innerHTML = '<span class="muted small">Analizando con IA… (puede tardar)</span>';
      const text = await AI.generateInsights(f);
      out.innerHTML = '<div class="ajax-out">' + esc(text) + '</div>';
    } catch (err) {
      out.innerHTML = '<div style="color:var(--danger);font-size:12px;">❌ ' + esc(err.message || String(err)) + '</div>';
    }
  }

  // ------------------------------------------------------------------
  //  contadores en vivo del content viewer
  // ------------------------------------------------------------------
  function bindLiveCounters() {
    document.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'c-title') $('c-title-ct').textContent = e.target.value.length + ' caracteres';
      else if (e.target && e.target.id === 'c-meta') $('c-meta-ct').textContent = e.target.value.length + ' caracteres';
      else if (e.target && e.target.id === 'c-content') {
        const wc = ContentReview.wordCount(e.target.value);
        $('c-words').textContent = wc + ' palabras' + (wc > 0 && wc < S.getSetting('contentMinWords') ? ' (ideal ≥ ' + S.getSetting('contentMinWords') + ')' : '');
      }
    });
  }

  // ------------------------------------------------------------------
  //  bootstrap
  // ------------------------------------------------------------------
  function init() {
    renderTabs();
    renderStatus();
    renderView();
    const fromFile = location.protocol === 'file:';
    const wantDemo = new URLSearchParams(location.search).has('demo');
    if (!S.listDatasets().length && (fromFile || wantDemo)) loadSamples();
    document.addEventListener('click', onDocClick);
    document.addEventListener('change', onDocChange);
    bindLiveCounters();
  }

  return { init };
})();

if (typeof window !== 'undefined') window.App = App;

document.addEventListener('DOMContentLoaded', App.init);