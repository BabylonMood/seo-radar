# SEO Radar

Herramienta de trabajo SEO que conecta tus exportaciones de **Search Console,
GA4 y SEMrush**, detecta oportunidades y te dice **qué optimizar primero**.
Todo corre en tu navegador: los datos nunca salen de la máquina (salvo que
actives la IA opcional).

Se inspira en la filosofía del [Radar de empleo](../README.md): estático,
rápido, sin servidores y listo para GitHub Pages.

---

## Quickstart

**La forma más rápida (sin instalar nada):** abrí `seo-radar/index.html` con
doble clic. Al estar todo embebido, funciona hasta desde `file://` — y al
primero abrirlo carga automáticamente los datos de ejemplo para que veas el
radar andando.

Con servidor local (opcional, necesario si en algún momento agregamos carga de
archivos externos):
```bash
cd seo-radar
npx serve .        # Node
# o:  python3 -m http.server
```
Y si querés que los ejemplos se carguen solos por URL:
`http://localhost:8000/index.html?demo=1`

Publicación gratis: GitHub Pages (Deploy from branch → main → `/seo-radar`).

## Qué te devuelve

| Pestaña | Qué hace |
|---|---|
| **Inicio** | KPIs (clics, impresiones, CTR, posición), clics recuperables estimados y prioridades de hoy |
| **Datos** | Importar/recargar/quitar datasets; autodetección de plataforma |
| **Análisis** | Queries ganando/perdiendo, oportunidades por query (snippet / rank / invisibles), páginas con señales, canibalización, SEMrush quick wins + gaps |
| **Recomendaciones** | Motor de scoring impacto vs esfuerzo + insights redactados por IA (opt-in) |
| **Contenido** | Content reviewer: score on-page, checklist accionable, schema sugerido y temas relacionados extraídos de tu GSC |
| **Reporte** | Exporta un .md ejecutivo con todo el análisis y plan de acción |
| **Ajustes** | Umbrales de detección y configuración de IA |

## Cómo exportar los CSVs

**Google Search Console** (`Rendimiento`):
- Resultados de búsqueda → pestaña **Queries** o **Páginas** → slider de fechas
  (para tendencias conviene un rango tipo 28-90 días) → **Exportar → CSV**.
- El parser entiende el formato nuevo y el legacy (con columna `Date`).

**Google Analytics 4**:
- Informe de páginas (Acquisition → Traffic acquisition; o Exploración con
  dimensión `Landing page + query string`) → **Export → CSV**.
- Tolera las filas de metadata y los encabezados numerados (`1. Land Page, …`) de GA4.

**SEMrush**:
- `Organic Research` → `Organic Research Positions` (ver vistas), o
  `Position Tracking`, exportando **CSV**.

Los encabezados se mapean en inglés o español. Lo que no matchee se descarta;
el mensaje después de importar te dice cuántas filas entraron.

## Análisis que hace por reglas

- **Oportunidades de snippet**: top 5 con CTR bajo y muchas impresiones.
- **Escalar posiciones**: queries en el rango medio con volumen.
- **Invisibles**: aparecés pero con 0 clics.
- **Tendencias**: compara la primera vs segunda mitad de las fechas importadas.
- **Canibalización**: misma query en varias URLs.
- **SEMrush**: quick wins (pos 11-20, KD baja), near top (2-4) y keyword gaps
  (volumen sin posicionar, cruzado contra tu GSC).
- **Content reviewer**: length de title/meta, keyword, H1/H2, densidad, alt,
  enlaces y temas relacionados de tus propios datos.

## IA híbrida (opcional)

En **Ajustes** podés conectar un endpoint compatible con OpenAI
(`/chat/completions`, modelo, API key). El motor de reglas detecta los
hallazgos; la IA se encarga de **redactarlos** en lenguaje natural. Se envía
solo un resumen compacto, no las filas completas. La key queda en
`localStorage` de ese navegador.

## Límites conocidos

- No hay conexión OAuth en vivo todavía: se alimenta de exportaciones. Un
  próximo paso sería conectar las APIs de Google con credenciales propias.
- Las tendencias necesitan la columna de fecha en el CSV.
- Los umbrales de detección se ajustan en **Ajustes** para reflejar tu
  realidad (volumen, industria, objetivo).
- Los datos viven en `localStorage`: se mantienen por navegador/dispositivo.
  Usá **Borrar todos los datos** para empezar de cero.

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura de la app |
| `css/styles.css` | Estilos (misma identidad que Radar de empleo) |
| `js/store.js` | Estado, localStorage, normalización numérica/URL/keyword |
| `js/importers.js` | Parseo de CSV + autodetección de plataforma y columnas |
| `js/analyze.js` | Motor de análisis por reglas + scoring de recomendaciones |
| `js/content.js` | Content reviewer (checklist + score + temas relacionados) |
| `js/ai.js` | Conexión IA opt-in (OpenAI-compatible) |
| `js/report.js` | Reporte ejecutivo en Markdown |
| `js/samples.js` | Datos de ejemplo embebidos (demo sin servidor de datos) |
| `js/app.js` | Vistas, navegación y eventos |