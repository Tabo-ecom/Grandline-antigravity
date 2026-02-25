import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';

const COPY_SYSTEM_PROMPT = `Eres un copywriter experto en e-commerce COD (Cash on Delivery) para Latinoamérica. Tu tarea es generar contenido publicitario para Meta Ads.

## REGLAS
- Escribe SIEMPRE en español natural latinoamericano
- NO uses hashtags ni links — solo el texto persuasivo
- Usa emojis estratégicamente (1-2 máximo)
- Enfocado en conversión: el objetivo es que hagan click y compren

## LOS 5 ÁNGULOS PARA EL BODY COPY (uno por variante)
1. **DOLOR**: Identifica un problema que el producto resuelve. Pregunta o situación frustrante.
2. **DIRECTO**: Ve al grano. Beneficio principal + CTA claro.
3. **CURIOSIDAD**: Genera intriga. "¿Sabías que...?", "El secreto de...", "Lo que nadie te dice..."
4. **TESTIMONIO**: Experiencia real de usuario. "Llevaba meses buscando..." o "No lo creía hasta que..."
5. **BENEFICIOS**: 2-3 beneficios más fuertes del producto.

## FORMATO DE RESPUESTA
Responde en EXACTAMENTE este formato (sin desviarte):

TITULO: [título corto para el anuncio, máximo 40 caracteres, atrapante]
DESCRIPCION: [descripción corta para el anuncio, máximo 90 caracteres, complementa el título]
COPIES:
[copy 1, max 280 chars]|||[copy 2, max 280 chars]|||[copy 3, max 280 chars]|||[copy 4, max 280 chars]|||[copy 5, max 280 chars]`;

async function callGemini(prompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                systemInstruction: { parts: [{ text: COPY_SYSTEM_PROMPT }] },
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 2048,
                }
            })
        }
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAI(prompt: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: COPY_SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            temperature: 0.9,
            max_tokens: 2048,
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message?.message || data.error.message);
    return data.choices?.[0]?.message?.content || '';
}

function parseResponse(raw: string) {
    const titleMatch = raw.match(/TITULO:\s*(.+)/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const descMatch = raw.match(/DESCRIPCION:\s*(.+)/i);
    const description = descMatch ? descMatch[1].trim() : '';

    const copiesSection = raw.split(/COPIES:\s*\n?/i)[1] || raw;
    const copies = copiesSection
        .split('|||')
        .map(c => c.trim())
        .filter(c => c.length > 0 && !c.startsWith('TITULO') && !c.startsWith('DESCRIPCION'));

    return { title, description, copies };
}

export async function POST(request: NextRequest) {
    try {
        const auth = await verifyAuth(request);
        if (!auth) return unauthorizedResponse();

        const rl = checkRateLimit(`${auth.uid}:sunny-copy`, { max: 10 });
        if (!rl.success) return rateLimitResponse();

        const { product, country, destinationUrl } = await request.json();

        if (!product) {
            return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
        }

        const prompt = `Genera contenido publicitario para el siguiente producto:

PRODUCTO: ${product}
PAÍS DESTINO: ${country || 'Colombia'}
${destinationUrl ? `URL DE DESTINO: ${destinationUrl}` : ''}

Genera: 1 título corto, 1 descripción corta, y 5 body copies con ángulos diferentes (Dolor, Directo, Curiosidad, Testimonio, Beneficios).`;

        let rawResponse: string;

        try {
            rawResponse = await callGemini(prompt);
        } catch (geminiError) {
            console.warn('[Sunny AI] Gemini failed, falling back to OpenAI:', geminiError);
            rawResponse = await callOpenAI(prompt);
        }

        const { title, description, copies } = parseResponse(rawResponse);

        while (copies.length < 5) {
            copies.push(`Descubre ${product} — la mejor opción para ti. Disponible ahora.`);
        }

        return NextResponse.json({
            title: title || `${product} - Disponible Ahora`,
            description: description || `Envío a todo ${country || 'el país'}. Paga al recibir.`,
            copies: copies.slice(0, 5)
        });
    } catch (error: any) {
        console.error('[Sunny AI] Error generating copy:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate copy' },
            { status: 500 }
        );
    }
}
