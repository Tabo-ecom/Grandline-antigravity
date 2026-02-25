/**
 * Vega AI - Multi-Provider AI Service
 * Supports Gemini and OpenAI, auto-selects based on available API keys
 */

import type { KPITarget } from '@/lib/types/kpi-targets';
import { DEFAULT_KPI_TARGETS } from '@/lib/types/kpi-targets';

type AIProvider = 'gemini' | 'openai';

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
- Si pregunta por "ayer"/"hoy" → busca esa fecha en los datos diarios.
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

async function callGemini(apiKey: string, prompt: string, systemContext?: string, kpiTargets?: KPITarget[]): Promise<string> {
    const systemPrompt = buildVegaSystemPrompt(kpiTargets);
    const fullPrompt = systemContext
        ? `${systemPrompt}\n\n--- CONTEXTO DE DATOS ---\n${systemContext}\n\n--- SOLICITUD ---\n${prompt}`
        : `${systemPrompt}\n\n${prompt}`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 4096,
                },
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Respuesta inválida de Gemini');
    }

    return data.candidates[0].content.parts[0].text;
}

async function callOpenAI(apiKey: string, prompt: string, systemContext?: string, kpiTargets?: KPITarget[]): Promise<string> {
    const systemPrompt = buildVegaSystemPrompt(kpiTargets);
    const systemMessage = systemContext
        ? `${systemPrompt}\n\n--- CONTEXTO DE DATOS ---\n${systemContext}`
        : systemPrompt;

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
            temperature: 0.4,
            max_tokens: 4096,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
        throw new Error('Respuesta inválida de OpenAI');
    }

    return data.choices[0].message.content;
}

async function callAI(prompt: string, systemContext?: string, kpiTargets?: KPITarget[]): Promise<string> {
    const { provider, apiKey } = detectProvider();

    if (provider === 'gemini') {
        return callGemini(apiKey, prompt, systemContext, kpiTargets);
    } else {
        return callOpenAI(apiKey, prompt, systemContext, kpiTargets);
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
    const prompts: Record<string, string> = {
        audit: 'Realiza una auditoría completa de la operación. Evalúa cada métrica clave, identifica problemas y oportunidades, y proporciona un plan de acción priorizado.',
        forecast: 'Basándote en los datos actuales, genera un pronóstico para los próximos 30 días. Incluye proyecciones de ventas, gasto publicitario óptimo y utilidad esperada.',
        efficiency: 'Analiza la eficiencia operativa. Evalúa tasas de entrega, cancelación y devolución por país. Identifica cuellos de botella y propone mejoras.',
        ads: 'Analiza el rendimiento publicitario. Evalúa ROAS, CPA y distribución de gasto por plataforma. Recomienda optimizaciones de presupuesto.',
        profitability: 'Analiza la rentabilidad del negocio. Desglosa costos, márgenes por producto/país y evalúa la sostenibilidad del modelo actual.',
    };

    const prompt = prompts[type] || `Realiza el siguiente análisis: ${type}`;
    return callAI(prompt, dataContext, kpiTargets);
}

export async function vegaGenerateReport(type: string, dataContext: string, period: string, kpiTargets?: KPITarget[]): Promise<string> {
    const prompt = getReportPrompt(type, period);
    return callAI(prompt, dataContext, kpiTargets);
}

function getReportPrompt(type: string, period: string): string {
    const structuredInstructions = `
INSTRUCCIONES DE FORMATO OBLIGATORIAS:
1. SIEMPRE empieza con un bloque <!-- EXECUTIVE_SUMMARY --> que contenga 2-3 frases en lenguaje MUY simple explicando cómo va el negocio. Una persona sin conocimiento financiero debe entender esto. Ejemplo: "El negocio vendió 450 pedidos esta semana y ganó $2.3M. La publicidad está siendo rentable."
2. SIEMPRE incluye un bloque <!-- HERO_KPIS --> con EXACTAMENTE 4 KPIs principales en este formato:
<!-- HERO_KPIS -->
[LABEL_1]: [VALOR_1] | [LABEL_2]: [VALOR_2] | [LABEL_3]: [VALOR_3] | [LABEL_4]: [VALOR_4]
<!-- /HERO_KPIS -->
Ejemplo: Utilidad Real: $2,340,000 | ROAS Real: 2.45x | Tasa Entrega: 67.2% | CPA: $18,500
3. SIEMPRE incluye un bloque <!-- ALERTS --> con alertas clasificadas por severidad:
<!-- ALERTS -->
[CRITICA] Descripción corta de la alerta crítica
[ATENCION] Descripción corta de la alerta de atención
[INFO] Dato informativo importante
<!-- /ALERTS -->
Si no hay alertas de algún nivel, no pongas esa línea. Si todo está bien, pon: [INFO] Todas las métricas dentro de los rangos saludables.
4. Después de estos bloques estructurados, continúa con el reporte narrativo normal usando markdown.
5. NO inventes datos. Usa SOLO los datos proporcionados.`;

    const prompts: Record<string, string> = {
        daily: `Genera el reporte diario "El Latido del Negocio" para ${period}.
${structuredInstructions}

Después de los bloques estructurados, usa este formato para el contenido narrativo:

## Resumen del Dia
| Métrica | Hoy | Ayer | Cambio |
|---|---|---|---|
| Órdenes Totales | X | X | ↑/↓ X% |
| Facturación Neta | $X | $X | ↑/↓ X% |
| Tasa de Entrega | X% | X% | ↑/↓ |
| Tasa de Cancelación | X% | X% | ↑/↓ |
| ROAS Real | Xx | Xx | ↑/↓ |
| CPA | $X | $X | ↑/↓ X% |
| Gasto Ads | $X | $X | ↑/↓ X% |
| Utilidad Real | $X | $X | ↑/↓ X% |

## Top 3 Productos del Dia
1. [Producto]: X órdenes, ROAS Xx, Utilidad $X
2. ...
3. ...

## Recomendacion del Primer Oficial
[1-3 acciones concretas y accionables para mañana. Sé específico.]

Si no hay datos del día anterior en los datos diarios, indica "sin comparación".`,

        weekly: `Genera el reporte semanal "La Brujula Tactica" para ${period}.
${structuredInstructions}

Después de los bloques estructurados, usa este formato para el contenido narrativo:

## Resumen Semanal
| Métrica | Esta Semana | Semana Anterior | Cambio |
|---|---|---|---|
| Órdenes Totales | X | X | ↑/↓ X% |
| Facturación Neta | $X | $X | ↑/↓ X% |
| Ingreso Real (Entregados) | $X | $X | ↑/↓ X% |
| Tasa de Entrega | X% | X% | ↑/↓ |
| ROAS Real | Xx | Xx | ↑/↓ |
| CPA | $X | $X | ↑/↓ X% |
| Utilidad Real | $X | $X | ↑/↓ X% |
| Gasto Ads Total | $X | $X | ↑/↓ X% |

## Rendimiento por Pais
Para cada país activo:
- **[País]**: X órdenes, Entrega X%, ROAS Xx, Utilidad $X
  - Mejor producto: [nombre] (X órd, ROAS Xx)
  - Producto en riesgo: [nombre] (razón)

## Rendimiento Publicitario
- **Facebook**: $X gastado, ROAS Xx
- **TikTok**: $X gastado, ROAS Xx
- Campañas destacadas: [top 3 por ROAS o por gasto]

## P&L Semanal
- Facturación Neta: $X
- (-) Costo Producto: $X (X% del ingreso)
- (-) Fletes: $X
- (-) Gasto Ads: $X (X% del revenue)
- (-) Gastos Operativos Berry: $X (si disponible)
- = **Utilidad Real**: $X (margen: X%)

## Plan Tactico Siguiente Semana
1. [Acción concreta y específica]
2. [Acción concreta y específica]
3. [Acción concreta y específica]

Si hay datos de período anterior (prevKpis), úsalos para la comparación.`,

        monthly: `Genera el reporte mensual "La Vision del Almirante" para ${period}.
${structuredInstructions}

Después de los bloques estructurados, usa este formato para el contenido narrativo:

## Dashboard Ejecutivo
| Métrica | Este Mes | Mes Anterior | Cambio | Estado |
|---|---|---|---|---|
| Órdenes Totales | X | X | X% | BUENO/ATENCION/CRITICO |
| Facturación Neta | $X | $X | X% | BUENO/ATENCION/CRITICO |
| Ingreso Real | $X | $X | X% | BUENO/ATENCION/CRITICO |
| Tasa Entrega | X% | X% | X% | BUENO/ATENCION/CRITICO |
| Tasa Cancelación | X% | X% | X% | BUENO/ATENCION/CRITICO |
| ROAS Real | Xx | Xx | X% | BUENO/ATENCION/CRITICO |
| CPA | $X | $X | X% | BUENO/ATENCION/CRITICO |
| Utilidad Real | $X | $X | X% | BUENO/ATENCION/CRITICO |

Estados: BUENO = Dentro de objetivo, ATENCION = En riesgo, CRITICO = Fuera de rango

## P&L Completo del Mes
**INGRESOS:**
- Ingreso Real (Entregados): $X
- Facturación en Tránsito: $X

**COSTOS VARIABLES:**
- Costo de Producto: $X (X% del ingreso)
- Fletes Entrega: $X
- Fletes Devolución: $X
- Fletes Tránsito: $X
- Gasto Publicitario: $X (X% del revenue)

**COSTOS FIJOS (Berry):**
[Desglose por categoría si disponible]
- Total Gastos Operativos: $X

**RESULTADO:**
- **Utilidad Operativa**: $X
- **Margen Neto**: X%
- **Break-Even**: [Alcanzado/No alcanzado]

## Analisis por Pais
[Para cada país: resumen con productos, ROAS, oportunidades]

## Analisis Publicitario
- Distribución de gasto por plataforma
- Top 5 campañas por eficiencia
- Campañas a pausar/escalar

## Proyecciones y Tendencias
- Tendencia de órdenes (creciendo/estable/decreciendo)
- Proyección de utilidad si se mantiene la tendencia
- Productos con momentum positivo vs negativo

## Roadmap del Proximo Mes
1. [Prioridad alta — acción específica]
2. [Prioridad media — acción específica]
3. [Optimización — acción específica]

Compara con período anterior cuando esté disponible. Sé honesto con los problemas.`,
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
