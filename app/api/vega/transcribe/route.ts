import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';

export const maxDuration = 120;

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        const rl = checkRateLimit(`${auth.uid}:vega-transcribe`, { max: 10, windowMs: 300_000 });
        if (!rl.success) return rateLimitResponse();

        if (!GEMINI_KEY) {
            return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });
        }

        const { fileBase64, filename, mimeType, language } = await req.json();

        if (!fileBase64) {
            return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
        }

        const langText = language === 'es' ? 'español' : language === 'en' ? 'inglés' : 'el idioma que detectes';
        const mediaType = mimeType?.startsWith('video') ? 'video' : 'audio';

        console.log(`Transcribe: ${filename}, mime: ${mimeType}, lang: ${language}`);

        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType: mimeType || 'video/mp4', data: fileBase64 } },
                            { text: `Transcribe este ${mediaType} a texto en ${langText}. Solo devuelve la transcripción literal del audio, sin timestamps, sin comentarios adicionales. Si hay múltiples personas hablando, indica "Persona 1:", "Persona 2:", etc.` },
                        ],
                    }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 16384 },
                }),
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            console.error('Gemini error:', errText.slice(0, 300));
            return NextResponse.json({ error: `Error de Gemini: ${errText.slice(0, 150)}` }, { status: 500 });
        }

        const data = await res.json();
        const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!transcript) {
            const reason = data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || 'sin respuesta';
            return NextResponse.json({ error: `No se pudo transcribir (${reason})` }, { status: 500 });
        }

        return NextResponse.json({
            transcript,
            filename: filename || 'archivo',
            language: language || 'es',
            chars: transcript.length,
            words: transcript.split(/\s+/).length,
        });

    } catch (error: any) {
        console.error('Transcription error:', error);
        return NextResponse.json({ error: error.message || 'Error en la transcripción' }, { status: 500 });
    }
}
