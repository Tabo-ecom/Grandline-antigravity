/**
 * Vega AI - Slack Command Parser
 * Uses Gemini to parse natural language commands into structured actions.
 */

export interface SlackCommand {
    action: 'increase_budget' | 'decrease_budget' | 'pause' | 'enable' | 'status' | 'unknown';
    entityName?: string;
    amount?: number;
    isPercentage?: boolean;
    confirmationNeeded: boolean;
    rawMessage: string;
}

const PARSE_PROMPT = `Eres un parser de comandos para control de campañas publicitarias de Facebook.
El usuario envía mensajes en español para controlar sus campañas.

Responde SOLO con JSON válido, sin markdown ni explicación. El formato es:
{
  "action": "increase_budget" | "decrease_budget" | "pause" | "enable" | "status" | "unknown",
  "entityName": "nombre exacto de la campaña mencionada o null",
  "amount": número o null,
  "isPercentage": true/false,
  "confirmationNeeded": true
}

Reglas:
- "sube", "aumenta", "incrementa" → increase_budget
- "baja", "reduce", "disminuye" → decrease_budget
- "pausa", "apaga", "detén", "para" → pause
- "activa", "enciende", "prende", "reanuda" → enable
- "estado", "cómo va", "reporte" → status
- Si mencionan porcentaje (%, "un 20%", "20 por ciento") → isPercentage: true
- Si mencionan monto fijo ($50000, 50k, "50 mil") → isPercentage: false, amount en unidades (50000)
- "50k" = 50000, "100k" = 100000
- confirmationNeeded siempre true para acciones que modifican (budget, pause, enable)
- confirmationNeeded false para status/unknown

Ejemplos:
- "sube presupuesto de Campaign X un 20%" → { "action": "increase_budget", "entityName": "Campaign X", "amount": 20, "isPercentage": true, "confirmationNeeded": true }
- "pausa Campaign Y" → { "action": "pause", "entityName": "Campaign Y", "amount": null, "isPercentage": false, "confirmationNeeded": true }
- "baja Campaign Z a $50000" → { "action": "decrease_budget", "entityName": "Campaign Z", "amount": 50000, "isPercentage": false, "confirmationNeeded": true }`;

export async function parseSlackCommand(
    message: string,
    userCampaigns: string[],
): Promise<SlackCommand> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return { action: 'unknown', confirmationNeeded: false, rawMessage: message };
    }

    const campaignContext = userCampaigns.length > 0
        ? `\n\nCampañas del usuario: ${userCampaigns.join(', ')}`
        : '';

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `${PARSE_PROMPT}${campaignContext}\n\nMensaje del usuario: "${message}"` }],
                    }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
                }),
            },
        );

        if (!response.ok) {
            return { action: 'unknown', confirmationNeeded: false, rawMessage: message };
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { action: 'unknown', confirmationNeeded: false, rawMessage: message };
        }

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            action: parsed.action || 'unknown',
            entityName: parsed.entityName || undefined,
            amount: parsed.amount || undefined,
            isPercentage: parsed.isPercentage || false,
            confirmationNeeded: parsed.confirmationNeeded !== false,
            rawMessage: message,
        };
    } catch {
        return { action: 'unknown', confirmationNeeded: false, rawMessage: message };
    }
}
