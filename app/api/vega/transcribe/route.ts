import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        const rl = checkRateLimit(`${auth.uid}:vega-transcribe`, { max: 10, windowMs: 300_000 });
        if (!rl.success) return rateLimitResponse();

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const language = (formData.get('language') as string) || 'es';

        if (!file) {
            return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
        }

        if (!GEMINI_KEY) {
            return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });
        }

        // Convert file to base64
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString('base64');

        // Detect MIME type
        const mimeType = file.type || 'video/mp4';
        const isAudio = mimeType.startsWith('audio/');
        const isVideo = mimeType.startsWith('video/');

        if (!isAudio && !isVideo) {
            return NextResponse.json({ error: 'Solo archivos de video o audio (mp4, mp3, wav, webm, m4a)' }, { status: 400 });
        }

        // Upload file to Gemini Files API first (for large files)
        // For files under 20MB, use inline data
        const fileSizeMB = bytes.byteLength / (1024 * 1024);

        let parts: any[];

        if (fileSizeMB > 20) {
            // Use File API for large files
            const uploadRes = await fetch(
                `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_KEY}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': mimeType,
                        'X-Goog-Upload-Protocol': 'raw',
                        'X-Goog-Upload-Command': 'upload, finalize',
                    },
                    body: Buffer.from(bytes),
                }
            );

            if (!uploadRes.ok) {
                const err = await uploadRes.text();
                return NextResponse.json({ error: `Error subiendo archivo a Gemini: ${err.slice(0, 200)}` }, { status: 500 });
            }

            const uploadData = await uploadRes.json();
            const fileUri = uploadData.file?.uri;

            if (!fileUri) {
                return NextResponse.json({ error: 'No se pudo obtener URI del archivo' }, { status: 500 });
            }

            // Wait for file to be processed
            await new Promise(r => setTimeout(r, 3000));

            parts = [
                { fileData: { mimeType, fileUri } },
                { text: `Transcribe este ${isVideo ? 'video' : 'audio'} a texto en ${language === 'es' ? 'español' : language}. Solo devuelve la transcripción literal, sin timestamps, sin comentarios, sin formato especial. Si hay múltiples personas hablando, indica quién habla con "Persona 1:", "Persona 2:", etc.` },
            ];
        } else {
            // Inline data for smaller files
            parts = [
                { inlineData: { mimeType, data: base64 } },
                { text: `Transcribe este ${isVideo ? 'video' : 'audio'} a texto en ${language === 'es' ? 'español' : language}. Solo devuelve la transcripción literal, sin timestamps, sin comentarios, sin formato especial. Si hay múltiples personas hablando, indica quién habla con "Persona 1:", "Persona 2:", etc.` },
            ];
        }

        // Call Gemini with the file
        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 16384,
                    },
                }),
            }
        );

        if (!geminiRes.ok) {
            const err = await geminiRes.text();
            return NextResponse.json({ error: `Error de Gemini: ${err.slice(0, 200)}` }, { status: 500 });
        }

        const data = await geminiRes.json();
        const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!transcript) {
            const reason = data.candidates?.[0]?.finishReason || 'unknown';
            return NextResponse.json({ error: `No se pudo transcribir (reason: ${reason})` }, { status: 500 });
        }

        return NextResponse.json({
            transcript,
            filename: file.name,
            duration: null, // Could estimate from file size
            language,
            chars: transcript.length,
            words: transcript.split(/\s+/).length,
        });

    } catch (error: any) {
        console.error('Transcription error:', error);
        return NextResponse.json({ error: error.message || 'Error en la transcripción' }, { status: 500 });
    }
}

export const config = {
    api: { bodyParser: false },
};
