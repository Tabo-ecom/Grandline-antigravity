/**
 * Vega AI - Multi-Provider AI Service
 * Supports Gemini and OpenAI, auto-selects based on available API keys
 */

import type { KPITarget } from '@/lib/types/kpi-targets';
import { DEFAULT_KPI_TARGETS } from '@/lib/types/kpi-targets';

type AIProvider = 'gemini' | 'openai';
type AITemperature = 'precise' | 'balanced';

// --- Prompt cache ---
let cachedPrompt: string | null = null;
let cachedTargetsHash: string | null = null;

function targetsHash(targets?: KPITarget[]): string {
    if (!targets) return 'default';
    return targets.map(t => `${t.key}:${t.good}:${t.warning}`).join('|');
}

function getCachedSystemPrompt(targets?: KPITarget[]): string {
    const hash = targetsHash(targets);
    if (cachedPrompt && cachedTargetsHash === hash) return cachedPrompt;
    cachedPrompt = buildVegaSystemPrompt(targets);
    cachedTargetsHash = hash;
    return cachedPrompt;
}

// --- Retry logic ---
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            const isRetryable = err?.status && RETRYABLE_STATUSES.has(err.status) ||
                err?.message?.includes('429') || err?.message?.includes('503') ||
                err?.name === 'AbortError';
            if (!isRetryable || attempt === retries) throw err;
            const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw new Error('Max retries exceeded');
}

function buildFinancialRules(targets?: KPITarget[]): string {
    const t = targets || DEFAULT_KPI_TARGETS;
    const find = (key: string) => t.find(x => x.key === key);

    const roas = find('roas_real');
    const cpa = find('cpa');
    const margen = find('margen_neto');
    const entrega = find('tasa_ent');
    const cancel = find('tasa_can');
    const adsRev = find('perc_ads_revenue');
    const dev = find('tasa_dev');

    return `## REGLAS FINANCIERAS (UMBRALES DEL CAPITÁN)
Estos son los umbrales calibrados por el Capitán para evaluar la salud del negocio:
- **COGS (Costo de Producto)**: Máximo 30% del precio de venta. Si supera → alerta.
- **CPA**: Saludable ≤$${(cpa?.good || 25000).toLocaleString('es-CO')} COP. Alerta si CPA ≥$${(cpa?.warning || 30000).toLocaleString('es-CO')}.
- **Margen neto mínimo**: ${margen?.good || 15}% después de todos los costos. Alerta si <${margen?.warning || 5}%.
- **Tasa de entrega objetivo**: ≥${entrega?.good || 65}% es saludable, <${entrega?.warning || 50}% es crítico.
- **Tasa de cancelación**: <${cancel?.good || 30}% es aceptable, ≥${cancel?.warning || 40}% requiere acción inmediata.
- **ROAS Real mínimo**: ${roas?.good || 2}x para ser rentable. <${roas?.warning || 1.5}x = pérdida operativa.
- **% Ads vs Revenue**: Idealmente <${adsRev?.good || 25}%. Si ≥${adsRev?.warning || 35}% → el gasto publicitario está devorando el margen.
- **Tasa de devolución**: <${dev?.good || 10}% es aceptable, ≥${dev?.warning || 20}% requiere revisión de producto/logística.`;
}

function buildVegaSystemPrompt(targets?: KPITarget[]): string {
    return `Eres VEGA — el "Primer Oficial" financiero de Grand Line, una operación e-commerce COD (Cash on Delivery) en Latinoamérica. Te diriges al usuario como "Capitán" y usas metáforas náuticas sutiles cuando es natural.

## TU IDENTIDAD
- Rol: CFO virtual / Primer Oficial financiero
- Nombre: VEGA (Vigilancia Estratégica y Gestión Analítica)
- Tono: Profesional pero cercano, como un CFO de confianza. Directo con los números, honesto con los problemas.
- Idioma: Español siempre. Natural y conversacional.

## COMPORTAMIENTO CONVERSACIONAL
- Si el Capitán saluda → saluda de vuelta con calidez y pregunta en qué puedes ayudar. NO lances datos ni análisis sin que los pidan.
- Si pregunta algo general → responde conversacionalmente y ofrece opciones.
- Si pide datos específicos → responde con cifras concretas de los datos proporcionados.
- Si pregunta por "ayer"/"hoy"/fecha específica → busca esa fecha en "DATOS DIARIOS POR PRODUCTO" para desglose por producto, y en "DATOS DIARIOS" para totales agregados. SIEMPRE responde con datos específicos de productos cuando pregunten por una fecha.
- Si pregunta por un rango → filtra y suma los datos diarios correspondientes.

${buildFinancialRules(targets)}

## REGLA CRÍTICA: TRÁNSITO EN MODELO COD
En el modelo COD, las órdenes pasan por tránsito antes de ser entregadas o canceladas. Esto significa:
- Si el % de tránsito es alto (>30-40% de órdenes en tránsito), la tasa de entrega y la utilidad real AÚN NO son concluyentes.
- **NO alarmes por tasa de entrega baja ni utilidad real negativa cuando hay muchas órdenes en tránsito** — esas órdenes están en camino y se convertirán en entregas.
- Cuando el tránsito es alto, usa la **Utilidad Proyectada** como referencia principal en vez de la Utilidad Real.
- Indica al Capitán: "Hay X órdenes en tránsito (X%), los números finales cambiarán cuando se entreguen."
- Solo alarma por tasa de entrega si el % de tránsito es bajo (<15%) y la tasa de entrega sigue siendo mala.

## FÓRMULAS QUE CONOCES
- **Utilidad Real** = Ingreso Entregados − Costo Producto − Fletes (ent + dev + tránsito) − Gasto Ads
- **Utilidad Proyectada** = Para cada producto: (Órdenes no canceladas × %Entrega estimada × Ingreso promedio) − (Órdenes no canceladas × %Entrega × Costo promedio) − (Órdenes no canceladas × %Entrega × Flete promedio) − (Órdenes no entregadas × Flete devolución × Buffer) − Gasto Ads del producto. Se suman todos los productos.
- **IMPORTANTE sobre Utilidad Proyectada**: Esta métrica proyecta qué pasará cuando las órdenes en tránsito se resuelvan. Siempre incluye gasto de ads de los productos CON órdenes. Si la proyectada es positiva pero menor que la real, significa que los márgenes por producto son justos. Si es similar o mayor, la operación es saludable.
- **ROAS Real** = Ingreso Entregados / Gasto Ads
- **ROAS Bruto** = Facturación Neta / Gasto Ads
- **CPA** = Gasto Ads / Total Órdenes
- **CPE** = Gasto Ads / Órdenes Entregadas
- **Tasa de Entrega** = Entregados / No Cancelados × 100
- **Tasa de Cancelación** = Cancelados / Total Órdenes × 100
- **Break-Even**: Punto donde Ingresos = Todos los costos (producto + fletes + ads + gastos operativos Berry)
- **Punto de Quiebre** = (Gastos Fijos Berry + Gasto Ads) / (1 − COGS%)

## DATOS BERRY (GASTOS OPERATIVOS)
Cuando recibas datos de gastos Berry, inclúyelos en tu análisis de P&L completo:
- Categorías: Aplicaciones, Fulfillment, Envíos, Nómina, Servicios, Gastos Bancarios, Otros, Inversiones, Impuestos, Marketing
- Estos gastos son FIJOS mensuales que se suman a los costos variables (producto, fletes, ads)
- Para break-even: los gastos Berry deben cubrirse con la utilidad operativa

## COMPARACIÓN CON PERÍODO ANTERIOR
Cuando tengas datos de período anterior (prevKpis), SIEMPRE:
- Calcula el cambio porcentual de cada métrica clave
- Usa ↑ para mejoras y ↓ para deterioro
- Resalta cambios >10% como significativos
- Si hay deterioro en métricas críticas (ROAS, CPA, tasa entrega), haz recomendaciones

## FORMATO DE RESPUESTAS
- Sé natural y conversacional. No todo tiene que ser un reporte formal.
- Usa viñetas y negritas cuando compartas datos.
- Incluye números específicos cuando estén disponibles.
- Cuando detectes problemas, propón soluciones accionables y concretas.
- Si un producto o país está en rojo, dilo directamente: "Capitán, [producto] en [país] está operando a pérdida."

## TU CONOCIMIENTO ESPECIALIZADO
- Modelo COD: dropshipping/fulfillment con pago contra entrega
- Métricas: ROAS, CPA, CPE, tasa de entrega, cancelación, devolución
- Plataformas ads: Facebook/Meta, TikTok (datos de archivo XLS), Google
- Logística: Colombia, Ecuador, Panamá, Guatemala
- P&L completo: facturación, costos producto, fletes, ads, gastos operativos

La fecha de hoy es: ${new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
}

function detectProvider(): { provider: AIProvider; apiKey: string } {
    // Try Gemini keys (server-only)
    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
        return { provider: 'gemini', apiKey: geminiKey };
    }

    // Try OpenAI keys (server-only)
    const openaiKey = process.env.OPENAI_API_KEY;

    if (openaiKey) {
        return { provider: 'openai', apiKey: openaiKey };
    }

    throw new Error('No hay API key configurada. Agrega GEMINI_API_KEY o OPENAI_API_KEY en tu .env.local');
}

async function callGemini(apiKey: string, prompt: string, systemContext?: string, kpiTargets?: KPITarget[], temp: AITemperature = 'balanced'): Promise<string> {
    const systemPrompt = getCachedSystemPrompt(kpiTargets);
    const fullPrompt = systemContext
        ? `${systemPrompt}\n\n--- CONTEXTO DE DATOS ---\n${systemContext}\n\n--- SOLICITUD ---\n${prompt}`
        : `${systemPrompt}\n\n${prompt}`;

    const temperature = temp === 'precise' ? 0.2 : 0.4;

    return withRetry(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120_000);

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: fullPrompt }] }],
                        generationConfig: {
                            temperature,
                            maxOutputTokens: 4096,
                        },
                    }),
                    signal: controller.signal,
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                const err: any = new Error(`Gemini API error (${response.status}): ${errorText.substring(0, 200)}`);
                err.status = response.status;
                throw err;
            }

            const data = await response.json();
            if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                const blockReason = data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || 'unknown';
                throw new Error(`Respuesta inválida de Gemini (reason: ${blockReason})`);
            }

            return data.candidates[0].content.parts[0].text;
        } catch (err: any) {
            if (err.name === 'AbortError') {
                throw new Error('La solicitud a Gemini tardó demasiado (timeout 2 min). Intenta con un rango de fechas más corto.');
            }
            throw err;
        } finally {
            clearTimeout(timeout);
        }
    });
}

async function callOpenAI(apiKey: string, prompt: string, systemContext?: string, kpiTargets?: KPITarget[], temp: AITemperature = 'balanced'): Promise<string> {
    const systemPrompt = getCachedSystemPrompt(kpiTargets);
    const systemMessage = systemContext
        ? `${systemPrompt}\n\n--- CONTEXTO DE DATOS ---\n${systemContext}`
        : systemPrompt;

    const temperature = temp === 'precise' ? 0.2 : 0.4;

    return withRetry(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120_000);

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemMessage },
                        { role: 'user', content: prompt },
                    ],
                    temperature,
                    max_tokens: 4096,
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                const err: any = new Error(`OpenAI API error (${response.status}): ${errorText.substring(0, 200)}`);
                err.status = response.status;
                throw err;
            }

            const data = await response.json();
            if (!data.choices?.[0]?.message?.content) {
                throw new Error('Respuesta inválida de OpenAI');
            }

            return data.choices[0].message.content;
        } catch (err: any) {
            if (err.name === 'AbortError') {
                throw new Error('La solicitud a OpenAI tardó demasiado (timeout 2 min). Intenta con un rango de fechas más corto.');
            }
            throw err;
        } finally {
            clearTimeout(timeout);
        }
    });
}

export async function callAI(prompt: string, systemContext?: string, kpiTargets?: KPITarget[], temp: AITemperature = 'balanced'): Promise<string> {
    const { provider, apiKey } = detectProvider();

    if (provider === 'gemini') {
        return callGemini(apiKey, prompt, systemContext, kpiTargets, temp);
    } else {
        return callOpenAI(apiKey, prompt, systemContext, kpiTargets, temp);
    }
}

/** Call AI WITHOUT the VEGA system prompt — for standalone tasks like research */
export async function callAIRaw(prompt: string, temp: AITemperature = 'balanced'): Promise<string> {
    const { provider, apiKey } = detectProvider();
    const temperature = temp === 'precise' ? 0.2 : 0.4;

    if (provider === 'gemini') {
        return withRetry(async () => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 120_000);
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { temperature, maxOutputTokens: 8192, responseMimeType: 'application/json' },
                        }),
                        signal: controller.signal,
                    }
                );
                if (!response.ok) {
                    const errorText = await response.text();
                    const err: any = new Error(`Gemini API error (${response.status}): ${errorText.substring(0, 200)}`);
                    err.status = response.status;
                    throw err;
                }
                const data = await response.json();
                if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    throw new Error(`Respuesta invalida de Gemini: ${data.candidates?.[0]?.finishReason || 'unknown'}`);
                }
                return data.candidates[0].content.parts[0].text;
            } catch (err: any) {
                if (err.name === 'AbortError') throw new Error('Timeout de 2 min en Gemini.');
                throw err;
            } finally {
                clearTimeout(timeout);
            }
        });
    } else {
        return withRetry(async () => {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature,
                    max_tokens: 8192,
                    response_format: { type: 'json_object' },
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI error (${response.status}): ${errorText.substring(0, 200)}`);
            }
            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        });
    }
}

export async function vegaChat(
    message: string,
    dataContext: string,
    chatHistory: { role: string; content: string }[],
    kpiTargets?: KPITarget[]
): Promise<string> {
    const historyText = chatHistory.length > 0
        ? `\n--- HISTORIAL DE CHAT ---\n${chatHistory.slice(-6).map(m => `${m.role === 'user' ? 'Usuario' : 'Vega'}: ${m.content}`).join('\n')}\n`
        : '';

    return callAI(`${historyText}\nUsuario: ${message}`, dataContext, kpiTargets);
}

export async function vegaAnalyze(type: string, dataContext: string, kpiTargets?: KPITarget[]): Promise<string> {
    const structuredFormat = `
INSTRUCCIONES DE FORMATO OBLIGATORIAS:
1. Empieza con <!-- EXECUTIVE_SUMMARY --> conteniendo 2-3 frases simples del hallazgo principal de este análisis.
2. Incluye <!-- ALERTS --> con alertas clasificadas:
<!-- ALERTS -->
[CRITICA] Alerta crítica si aplica
[ATENCION] Alerta de atención si aplica
[INFO] Dato informativo
<!-- /ALERTS -->
3. Usa secciones ## para organizar el análisis narrativo.
4. NO inventes datos. Usa SOLO los datos proporcionados.
5. NO generes tablas de KPIs — el sistema las genera automáticamente.
6. En las recomendaciones usa tags de acción:
   [ESCALAR] para escalar lo rentable
   [PAUSAR] para detener lo que genera pérdida
   [OPTIMIZAR] para ajustar métricas
   [MONITOREAR] para vigilar situaciones`;

    const prompts: Record<string, string> = {
        audit: `Realiza una auditoría completa de la operación.
${structuredFormat}

Genera estas secciones:
## Diagnóstico General
Evaluación integral de cada métrica clave. Qué está bien, qué está mal, y por qué.

## Problemas Identificados
Lista de problemas encontrados con severidad y impacto estimado.

## Oportunidades
Áreas donde se puede crecer o mejorar.

## Plan de Acción
5-7 acciones priorizadas con tags: [ESCALAR], [PAUSAR], [OPTIMIZAR], [MONITOREAR]`,

        forecast: `Genera un pronóstico para los próximos 30 días.
${structuredFormat}

Genera estas secciones:
## Proyección de Ventas
Estimación basada en tendencia actual.

## Presupuesto Publicitario Óptimo
Recomendación de gasto por plataforma.

## Utilidad Esperada
Escenario optimista, esperado y pesimista.

## Recomendaciones
3-5 acciones con tags de acción.`,

        efficiency: `Analiza la eficiencia operativa.
${structuredFormat}

Genera estas secciones:
## Análisis Logístico
Tasas de entrega, cancelación y devolución por país. Compara con benchmarks del negocio.

## Cuellos de Botella
Países o productos con peor rendimiento logístico y por qué.

## Plan de Mejora
5 acciones concretas con tags: [OPTIMIZAR], [MONITOREAR], [PAUSAR]`,

        ads: `Analiza el rendimiento publicitario.
${structuredFormat}

Genera estas secciones:
## Rendimiento por Plataforma
ROAS, CPA y gasto de cada plataforma (Facebook, TikTok). Cuál es más eficiente.

## Campañas Destacadas
Top campañas por eficiencia y las que necesitan atención urgente.

## Optimización de Presupuesto
Redistribución recomendada del gasto con tags: [ESCALAR], [PAUSAR], [OPTIMIZAR]`,

        profitability: `Analiza la rentabilidad del negocio.
${structuredFormat}

Genera estas secciones:
## Estado de Resultados
Desglose: Ingresos → Costos Variables → Costos Fijos → Resultado. Márgenes reales.

## Rentabilidad por Producto
Top productos rentables vs productos en pérdida. Impacto de cada uno.

## Rentabilidad por País
Evaluación de cada mercado. Cuáles son sostenibles.

## Acciones de Rentabilidad
5 acciones con tags: [ESCALAR] productos rentables, [PAUSAR] los que generan pérdida, [OPTIMIZAR] costos`,
    };

    const prompt = prompts[type] || `Realiza el siguiente análisis: ${type}\n${structuredFormat}`;
    return callAI(prompt, dataContext, kpiTargets);
}

export async function vegaGenerateReport(type: string, dataContext: string, period: string, kpiTargets?: KPITarget[]): Promise<string> {
    const prompt = getReportPrompt(type, period);
    return callAI(prompt, dataContext, kpiTargets, 'precise');
}

function getReportPrompt(type: string, period: string): string {
    const structuredInstructions = `
INSTRUCCIONES DE FORMATO OBLIGATORIAS:
1. SIEMPRE empieza con un bloque <!-- EXECUTIVE_SUMMARY --> que contenga 2-3 frases en lenguaje MUY simple explicando cómo va el negocio. Menciona la utilidad proyectada y si el negocio fue rentable. Una persona sin conocimiento financiero debe entender esto. Ejemplo: "El negocio vendió 450 pedidos y la utilidad proyectada es de $2.3M. La publicidad está siendo rentable con ROAS de 2.8x."
2. SIEMPRE incluye un bloque <!-- ALERTS --> con alertas clasificadas por severidad:
<!-- ALERTS -->
[CRITICA] Descripción corta de la alerta crítica
[ATENCION] Descripción corta de la alerta de atención
[INFO] Dato informativo importante
<!-- /ALERTS -->
Si no hay alertas de algún nivel, no pongas esa línea. Si todo está bien, pon: [INFO] Todas las métricas dentro de los rangos saludables.
Incluye alertas sobre productos con días consecutivos en pérdida si los datos lo muestran.
3. Después de estos bloques estructurados, continúa con el reporte narrativo normal usando markdown.
4. NO inventes datos. Usa SOLO los datos proporcionados.
5. NO generes tablas de comparación de KPIs ni bloques de HERO_KPIS — el sistema los genera automáticamente desde los datos.
6. En las recomendaciones, usa SIEMPRE tags de acción al inicio de cada línea:
   [ESCALAR] para productos/campañas rentables que deben crecer
   [PAUSAR] para productos/campañas en pérdida que deben detenerse
   [OPTIMIZAR] para métricas que necesitan ajustes
   [MONITOREAR] para situaciones que requieren vigilancia`;

    const prompts: Record<string, string> = {
        daily: `Genera el reporte diario "El Latido del Negocio" para ${period}.
${structuredInstructions}

IMPORTANTE para reportes DIARIOS: Las órdenes de hoy llevan apenas 1 día, la mayoría está en tránsito. NO analices tasa de entrega como problema — es normal que sea baja. Enfócate en la UTILIDAD PROYECTADA que es lo que realmente importa para evaluar el día.

Después de los bloques estructurados, genera SOLO estas secciones narrativas:

## Resumen del Dia
Un párrafo de análisis narrativo del día: qué pasó, cómo se compara con ayer, qué destaca. Menciona productos clave. NO uses tabla — el sistema la genera automáticamente.

## Recomendaciones del Primer Oficial
3-5 acciones concretas con tags de acción. Ejemplo:
- [ESCALAR] Aumentar presupuesto de "Producto X" en Facebook — ROAS 3.5x y utilidad proyectada positiva
- [PAUSAR] Detener campañas de "Producto Y" — lleva 3 días consecutivos en pérdida proyectada
- [OPTIMIZAR] Revisar segmentación de TikTok — CPA subió a $28K vs $22K ayer
- [MONITOREAR] "Producto Z" entró en zona de alerta con CPA cercano al umbral`,

        weekly: `Genera el reporte semanal "La Brujula Tactica" para ${period}.
${structuredInstructions}

Después de los bloques estructurados, genera SOLO estas secciones narrativas:

## Análisis Semanal
2-3 párrafos de análisis narrativo: tendencias de la semana, comparación con semana anterior (si hay datos prevKpis), productos destacados y problemáticos, evolución de la rentabilidad. Menciona utilidad proyectada Y utilidad real.

## Análisis Publicitario
Análisis de eficiencia publicitaria por plataforma y campañas destacadas. Menciona top 3 campañas por eficiencia y las que necesitan atención.

## Plan Táctico Siguiente Semana
3-5 acciones concretas con tags de acción:
- [ESCALAR] ...
- [PAUSAR] ...
- [OPTIMIZAR] ...

Si hay datos de período anterior (prevKpis), úsalos para las comparaciones narrativas.`,

        monthly: `Genera el reporte mensual "La Vision del Almirante" para ${period}.
${structuredInstructions}

Después de los bloques estructurados, genera SOLO estas secciones narrativas:

## Análisis Ejecutivo
Análisis profundo del mes: evolución de rentabilidad, tendencias, comparación con mes anterior. Honesto con los problemas.

## Análisis por País
Para cada país activo: evaluación con productos destacados, oportunidades y riesgos.

## Análisis Publicitario
Eficiencia por plataforma, campañas top, distribución del gasto. Qué escalar, qué pausar.

## Proyecciones y Tendencias
Tendencias de órdenes, proyección si se mantiene la trayectoria, productos con momentum positivo vs negativo.

## Roadmap del Próximo Mes
3-5 prioridades con tags de acción:
- [ESCALAR] Prioridad alta — acción específica
- [OPTIMIZAR] Prioridad media — acción específica
- [MONITOREAR] Vigilar — aspecto específico

Compara con período anterior cuando esté disponible. Sé honesto con los problemas.`,

        slack_daily: `Genera un reporte diario COMPLETO para Slack. Período: ${period}.

REGLAS ESTRICTAS:
- NO uses <!-- -->, HERO_KPIS, ALERTS. Solo texto Slack con *bold* y emojis.
- NO escribas introducción ni saludo. Empieza DIRECTO con el título 🧭.
- USA SOLO datos proporcionados. No inventes números.
- Formatea montos: $1,234,567 (con separadores de miles)
- "Util. Proy" = Utilidad Proyectada de los datos
- "CPA Desp" = usa "CPA Despachado (Ads/No cancelados)" de los datos, NO el CPA general

DEBES incluir las 5 secciones de abajo. Si falta alguna sección, el reporte está INCOMPLETO y es inválido.

=== SECCIÓN 1 (OBLIGATORIA) ===
🧭 *VEGA — Reporte Diario* (${period})

📊 *Resumen*
Órdenes: X | Entregadas: X (X%) | Tránsito: X
Ads: $X | ROAS: Xx | CPA Desp: $X
Util. Real: $X | Util. Proy: $X

=== SECCIÓN 2 (OBLIGATORIA) ===
🟢 *Top 5 Productos (mejor proyección)*
Lista los 5 productos con Utilidad Proyectada MÁS ALTA. Ordénalos de mayor a menor.
• [Nombre]: X órd | CPA: $X | U.Proy: $X ✅
(repite para cada uno de los 5)

=== SECCIÓN 3 (OBLIGATORIA) ===
🔴 *Bottom 5 Productos (peor proyección)*
Lista los 5 productos con Utilidad Proyectada MÁS BAJA o negativa. Ordénalos del peor al menos peor.
• [Nombre]: X órd | CPA: $X | U.Proy: -$X 🔴
(repite para cada uno de los 5)

=== SECCIÓN 4 (OBLIGATORIA) ===
🌎 *Países*
• [País]: X órd | Ent X% | Ads $X | U.Proy: $X

=== SECCIÓN 5 (OBLIGATORIA) ===
💡 *Recomendaciones* (3 acciones)
1. [Acción concreta en 1 línea]
2. [Acción concreta en 1 línea]
3. [Acción concreta en 1 línea]

NO agregues nada antes del 🧭. NO agregues secciones extra. Las 5 secciones son OBLIGATORIAS.`,

        slack_recommendations: `Analiza los datos operativos y genera EXACTAMENTE 3 recomendaciones accionables para el equipo.
Período: ${period}.

REGLAS:
- Solo 3 líneas numeradas. NADA MÁS. Sin título, sin intro, sin cierre.
- Cada recomendación debe ser una acción CONCRETA y ESPECÍFICA basada en los datos.
- Menciona productos o países específicos cuando sea relevante.
- Usa emojis: ⚠️ para alertas, 📈 para oportunidades, 💰 para costos.

FORMATO EXACTO (solo estas 3 líneas):
1. [Acción concreta]
2. [Acción concreta]
3. [Acción concreta]`,

        logistics: `Genera la "Bitácora Logística" para ${period}.
${structuredInstructions}

Enfócate en: tasas de entrega, motivos de cancelación (TAGS), análisis por transportadora, devoluciones y órdenes en tránsito.

Después de los bloques estructurados, genera SOLO estas secciones narrativas:

## Análisis Logístico
Tasas de entrega y cancelación por país y producto. Evolución vs período anterior si hay datos. Identifica patrones de entregas fallidas.

## Motivos de Cancelación
Desglose por TAGS de cancelación. Cuáles son los motivos más frecuentes, tendencias y qué productos/países concentran cada motivo.

## Análisis por Transportadora
Rendimiento de cada transportadora: tasa de entrega, tiempo promedio, devoluciones. Cuál es la más confiable y cuál necesita atención.

## Devoluciones y Tránsito
Análisis de devoluciones por producto y país. Órdenes en tránsito actuales y proyección de resolución.

## Recomendaciones Logísticas
3-5 acciones concretas con tags:
- [OPTIMIZAR] Mejorar rutas o transportadoras específicas
- [MONITOREAR] Productos o zonas con tasa de entrega en deterioro
- [PAUSAR] Zonas o productos con logística insostenible`,

        financial: `Genera el "Estado de Resultados" para ${period}.
${structuredInstructions}

Enfócate en la cascada P&L completa: Ingresos → Costos de Producto → Ganancia Bruta → Gastos Operativos → Gastos Administrativos → Utilidad Neta. Incluye gastos Berry por categoría y márgenes por país.

Después de los bloques estructurados, genera SOLO estas secciones narrativas:

## Estado de Resultados
Cascada P&L completa con montos y porcentajes sobre ingresos:
- Ingresos (facturación entregados)
- (-) Costo de Producto → Ganancia Bruta y margen bruto %
- (-) Fletes (entrega + devolución + tránsito)
- (-) Gasto Publicitario
- (-) Gastos Operativos Berry (desglosados por categoría)
- = Utilidad Neta y margen neto %

## Análisis de Gastos
Desglose de gastos Berry por categoría (Aplicaciones, Fulfillment, Envíos, Nómina, Servicios, Gastos Bancarios, Otros, Inversiones, Impuestos, Marketing). Cuáles crecieron, cuáles son controlables, y dónde hay oportunidad de ahorro.

## Márgenes por País
Para cada país activo: ingresos, costos, margen bruto y neto. Identificar qué países son rentables y cuáles operan a pérdida.

## Recomendaciones Financieras
3-5 acciones concretas con tags:
- [OPTIMIZAR] Reducir gastos específicos o mejorar márgenes
- [ESCALAR] Países o productos con mejores márgenes
- [PAUSAR] Operaciones que generan pérdida neta
- [MONITOREAR] Tendencias de gastos que requieren vigilancia`,

        supplier: `Genera el "Reporte Proveedor" para ${period}.
${structuredInstructions}

IMPORTANTE: Este reporte es desde la perspectiva del PROVEEDOR. El proveedor NO paga fletes — su P&L es: Ingreso por Producto - Costo de Producto = Margen Proveedor. NO incluyas fletes en los cálculos del proveedor.

Después de los bloques estructurados, genera SOLO estas secciones narrativas:

## P&L Proveedor
Estado de resultados del proveedor SIN fletes:
- Ingreso total por productos entregados
- (-) Costo de producto
- = Margen Proveedor (monto y %)
Desglose por producto mostrando ingreso, costo y margen unitario y total.

## Productos por Margen
Ranking de productos ordenados por margen (de mayor a menor). Identificar productos estrella y productos con margen insuficiente. Incluir volumen de ventas para contextualizar.

## Alertas de Inventario
Productos con alto volumen de ventas que podrían necesitar reabastecimiento. Productos con baja rotación que podrían estar acumulando inventario.

## Análisis por Tienda
Rendimiento de cada tienda/país desde la perspectiva del proveedor: volumen, ingreso, margen. Qué tiendas son más rentables para el proveedor.

## Recomendaciones
3-5 acciones concretas con tags:
- [ESCALAR] Productos con mejor margen y volumen
- [OPTIMIZAR] Productos con margen bajo pero alto volumen — negociar costos
- [MONITOREAR] Productos con ventas decrecientes
- [PAUSAR] Productos con margen negativo o insignificante`,

        month_close: `Genera el "Cierre de Mes" para ${period}.
${structuredInstructions}

Este es el reporte más completo del mes. Combina ventas, proveedor y gastos en un análisis integral. Usa datos del período anterior (prevKpis) para comparación mes a mes cuando estén disponibles.

Después de los bloques estructurados, genera SOLO estas secciones narrativas:

## Estado de Resultados del Mes
P&L completo del mes con cascada detallada:
- Ingresos totales (facturación entregados)
- (-) Costo de Producto → Ganancia Bruta
- (-) Fletes totales (entrega + devolución + tránsito)
- (-) Gasto Publicitario total
- = Utilidad Operativa
- (-) Gastos Berry (total y desglose por categoría)
- = Utilidad Neta
Incluye márgenes % en cada nivel.

## Comparativa vs Mes Anterior
Si hay datos de período anterior, compara métrica por métrica:
- Órdenes, facturación, tasa de entrega, tasa de cancelación
- ROAS, CPA, gasto ads
- Utilidad real y proyectada
- Usa ↑/↓ para indicar dirección y % de cambio

## Análisis de Gastos
Desglose completo de gastos Berry por categoría. Comparativa vs mes anterior. Identificar gastos que crecieron desproporcionadamente. Ratio gastos fijos / ingresos.

## Resumen Proveedor
P&L desde perspectiva del proveedor (SIN fletes): ingreso, costo, margen por producto. Top productos por margen y volumen.

## Proyecciones
Basado en la tendencia del mes que cierra, proyectar para el mes siguiente:
- Volumen de órdenes esperado
- Ingresos proyectados
- Utilidad esperada (escenario optimista, esperado, pesimista)
- Acciones recomendadas para el próximo mes

3-5 prioridades con tags:
- [ESCALAR] Lo que funcionó y debe crecer
- [OPTIMIZAR] Lo que necesita ajustes
- [PAUSAR] Lo que debe detenerse
- [MONITOREAR] Lo que hay que vigilar de cerca`,
    };

    return prompts[type] || `Genera un reporte tipo ${type} para ${period}. Incluye KPIs principales, análisis por país/producto, rendimiento publicitario y recomendaciones.
${structuredInstructions}`;
}

export async function vegaEvaluateAlerts(
    rules: { metric: string; condition: string; threshold: number; name: string }[],
    currentValues: Record<string, number>
): Promise<{ ruleIndex: number; triggered: boolean; message: string }[]> {
    const results: { ruleIndex: number; triggered: boolean; message: string }[] = [];

    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const value = currentValues[rule.metric];
        if (value === undefined) continue;

        let triggered = false;
        switch (rule.condition) {
            case 'greater_than':
                triggered = value > rule.threshold;
                break;
            case 'less_than':
                triggered = value < rule.threshold;
                break;
            case 'equals':
                triggered = Math.abs(value - rule.threshold) < 0.01;
                break;
            case 'change_percent_up':
                triggered = value > rule.threshold;
                break;
            case 'change_percent_down':
                triggered = value < -rule.threshold;
                break;
        }

        if (triggered) {
            results.push({
                ruleIndex: i,
                triggered: true,
                message: `${rule.name}: ${rule.metric} es ${value.toFixed(2)}, umbral: ${rule.threshold}`,
            });
        }
    }

    return results;
}
