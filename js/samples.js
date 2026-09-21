'use strict';

const SAMPLES = {};

SAMPLES['gsc.query'] = [
  'Date,Query,Pages,Clicks,Impressions,CTR,Position',
  '2026-08-10,feriados argentina 2026,https://ejemplo.ar/calendario/feriados,3100,12400,25.0,1',
  '2026-09-10,feriados argentina 2026,https://ejemplo.ar/calendario/feriados,3400,13000,26.2,1',
  '2026-08-10,calculadora sueldo neto,https://ejemplo.ar/calculadora/sueldo-neto,890,4100,21.7,2',
  '2026-09-10,calculadora sueldo neto,https://ejemplo.ar/calculadora/sueldo-neto,940,4300,21.9,2',
  '2026-08-10,calcular aguinaldo argentina 2026,https://ejemplo.ar/calculadora/aguinaldo,120,5100,2.4,7',
  '2026-09-10,calcular aguinaldo argentina 2026,https://ejemplo.ar/calculadora/aguinaldo,160,5600,2.9,6',
  '2026-08-10,salario minimo argentina septiembre 2026,https://ejemplo.ar/blog/salario-minimo,40,2100,1.9,14',
  '2026-09-10,salario minimo argentina septiembre 2026,https://ejemplo.ar/blog/salario-minimo,8,3400,0.2,18',
  '2026-08-10,como armar un cv,https://ejemplo.ar/guias/como-armar-un-cv,720,3800,18.9,3',
  '2026-09-10,como armar un cv,https://ejemplo.ar/guias/como-armar-un-cv,430,3700,11.6,8',
  '2026-08-10,modelo de carta renuncia,https://ejemplo.ar/cartas/renuncia,95,6800,1.4,4',
  '2026-09-10,modelo de carta renuncia,https://ejemplo.ar/cartas/renuncia,88,7200,1.2,4',
  '2026-08-10,carta renuncia modelo,https://ejemplo.ar/plantillas/carta-renuncia,60,3100,1.9,6',
  '2026-09-10,carta renuncia modelo,https://ejemplo.ar/plantillas/carta-renuncia,55,3300,1.7,6',
  '2026-08-10,requisitos monotributo 2026,https://ejemplo.ar/blog/requisitos-monotributo,240,2600,9.2,5',
  '2026-09-10,requisitos monotributo 2026,https://ejemplo.ar/blog/requisitos-monotributo,410,2900,14.1,3',
  '2026-08-10,requisitos monotributo 2026,https://ejemplo.ar/blog/monotributo-afip,95,1300,7.3,8',
  '2026-09-10,requisitos monotributo 2026,https://ejemplo.ar/blog/monotributo-afip,88,1250,7.0,9',
  '2026-08-10,simulador cuotas credito,https://ejemplo.ar/calculadora/cuotas,3,2240,0.1,6',
  '2026-09-10,simulador cuotas credito,https://ejemplo.ar/calculadora/cuotas,5,2340,0.2,6',
  '2026-08-10,cuanto gana un programador argentina 2026,https://ejemplo.ar/blog/sueldo-programador,310,1700,18.2,2',
  '2026-09-10,cuanto gana un programador argentina 2026,https://ejemplo.ar/blog/sueldo-programador,380,1800,21.1,1',
  '2026-08-10,tabla posiciones futbol argentino,https://ejemplo.ar/deportes/tabla-posiciones,45,7800,0.6,12',
  '2026-09-10,tabla posiciones futbol argentino,https://ejemplo.ar/deportes/tabla-posiciones,38,8200,0.5,13',
  '2026-08-10,rentabilidad plazos fijos 2026,https://ejemplo.ar/finanzas/plazo-fijo,15,940,1.6,11',
  '2026-09-10,rentabilidad plazos fijos 2026,https://ejemplo.ar/finanzas/plazo-fijo,28,1100,2.5,9',
  '2026-08-10,planilla excel gratis,https://ejemplo.ar/recursos/planillas-excel,66,1400,4.7,9',
  '2026-09-10,planilla excel gratis,https://ejemplo.ar/recursos/planillas-excel,150,2100,7.1,5',
  '2026-08-10,como calcular salario por hora,https://ejemplo.ar/calculadora/salario-hora,0,520,0.0,22',
  '2026-09-10,como calcular salario por hora,https://ejemplo.ar/calculadora/salario-hora,12,880,1.4,15',
  '2026-08-10,feriados puente 2026,https://ejemplo.ar/calendario/feriados,520,3600,14.4,1',
  '2026-09-10,feriados puente 2026,https://ejemplo.ar/calendario/feriados,98,910,10.8,3'
].join('\n');

SAMPLES['gsc.page'] = [
  'Page,Clicks,Impressions,CTR,Position',
  'https://ejemplo.ar/calculadora/sueldo-neto,1830,8400,21.8,2',
  'https://ejemplo.ar/calendario/feriados,6500,25400,25.6,1',
  'https://ejemplo.ar/blog/sueldo-programador,690,3500,19.7,2',
  'https://ejemplo.ar/cartas/renuncia,183,14000,1.3,4',
  'https://ejemplo.ar/plantillas/carta-renuncia,115,6500,1.8,6',
  'https://ejemplo.ar/blog/requisitos-monotributo,650,5500,11.8,4',
  'https://ejemplo.ar/calculadora/aguinaldo,280,11000,2.5,6',
  'https://ejemplo.ar/blog/salario-minimo,48,5500,0.9,16',
  'https://ejemplo.ar/calculadora/cuotas,8,4600,0.2,6',
  'https://ejemplo.ar/deportes/tabla-posiciones,83,16000,0.5,12',
  'https://ejemplo.ar/guias/como-armar-un-cv,1150,7500,15.3,6',
  'https://ejemplo.ar/finanzas/plazo-fijo,43,2040,2.1,10',
  'https://ejemplo.ar/recursos/planillas-excel,216,3500,6.2,7',
  'https://ejemplo.ar/calculadora/salario-hora,12,1400,0.9,18'
].join('\n');

SAMPLES['ga4.page'] = [
  'Report name,Exploración de páginas',
  'Date range,2026-08-01 - 2026-09-15',
  '1. Land Page,2. Sessions,3. Engaged sessions,4. Engagement rate,5. Total users',
  '1,https://ejemplo.ar/calculadora/sueldo-neto,4800,3650,76.0,4100',
  '2,https://ejemplo.ar/calendario/feriados,9200,8100,88.0,8600',
  '3,https://ejemplo.ar/guias/como-armar-un-cv,3400,1500,44.1,3300',
  '4,https://ejemplo.ar/blog/requisitos-monotributo,1900,1350,71.1,1880',
  '5,https://ejemplo.ar/blog/salario-minimo,2100,520,24.8,2090',
  '6,https://ejemplo.ar/calculadora/aguinaldo,730,455,62.3,720',
  '7,https://ejemplo.ar/deportes/tabla-posiciones,650,180,27.7,640',
  '8,https://ejemplo.ar/calculadora/cuotas,90,28,31.1,89',
  '9,https://ejemplo.ar/cartas/renuncia,1300,820,63.1,1270',
  '10,https://ejemplo.ar/plantillas/carta-renuncia,700,410,58.6,690',
  '11,https://ejemplo.ar/finanzas/plazo-fijo,380,290,76.3,375',
  '12,https://ejemplo.ar/recursos/planillas-excel,900,610,67.8,890',
  '13,https://ejemplo.ar/calculadora/salario-hora,40,22,55.0,39'
].join('\n');

SAMPLES['semrush.keyword'] = [
  'Keyword,Intent,Position,Volume,KD,CPC,Traffic,URL',
  'calculadora sueldo neto argentina,Commercial,1,7200,32,0.85,990,https://ejemplo.ar/calculadora/sueldo-neto',
  'salario minimo septiembre 2026,Informational,14,14000,38,0.12,180,https://ejemplo.ar/blog/salario-minimo',
  'requisitos monotributo 2026,Informational,2,8800,29,0.30,640,https://ejemplo.ar/blog/requisitos-monotributo',
  'como calcular aguinaldo,Informational,7,6100,34,0.20,210,https://ejemplo.ar/calculadora/aguinaldo',
  'modelo carta renuncia word,Commercial,6,5200,18,0.15,150,https://ejemplo.ar/plantillas/carta-renuncia',
  'cuanto gana un programador,Informational,1,4900,41,0.40,410,https://ejemplo.ar/blog/sueldo-programador',
  'planilla excel gastos mensuales,Transactional,11,3900,22,0.60,95,https://ejemplo.ar/recursos/planillas-excel',
  'simulador de prestamos personal,Transactional,16,8100,31,0.90,140,https://ejemplo.ar/calculadora/cuotas',
  'impuesto a las ganancias 2026,Informational,9,7300,44,0.25,320,https://ejemplo.ar/blog/impuesto-ganancias',
  'plazo fijo uva vs tradicional,Commercial,13,3600,19,0.30,70,https://ejemplo.ar/finanzas/plazo-fijo',
  'feriados 2027 argentina,Informational,22,5400,12,0.10,40,https://ejemplo.ar/calendario/feriados',
  'cotizacion dolar blue hoy,Informational,8,18000,27,0.35,1500,https://ejemplo.ar/finanzas/dolar-blue',
  'agenda dias no laborables 2026,Informational,18,2900,15,0.08,35,https://ejemplo.ar/calendario/feriados',
  'como hacer factura electronica afip,Informational,,6200,24,0.05,0,',
  'cuanto gana un analista de datos argentina,Informational,24,4200,28,0.30,30,https://ejemplo.ar/blog/sueldo-programador'
].join('\n');

if (typeof window !== 'undefined') window.SAMPLES = SAMPLES;