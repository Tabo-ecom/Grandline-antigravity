import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendSlackBotMessage } from '@/lib/services/vega/slack-bot';

export async function POST(req: NextRequest) {
    try {
        const { email, name } = await req.json();

        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
        }

        if (!adminDb) {
            return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if already on waitlist
        const existing = await adminDb.collection('waitlist')
            .where('email', '==', normalizedEmail)
            .limit(1)
            .get();

        if (!existing.empty) {
            return NextResponse.json({ message: 'already_registered' });
        }

        // Save to Firestore
        await adminDb.collection('waitlist').add({
            email: normalizedEmail,
            name: name?.trim() || '',
            createdAt: new Date().toISOString(),
            source: 'landing_beta',
        });

        // Notify Slack
        const token = process.env.SLACK_BOT_TOKEN;
        const channel = process.env.SLACK_LEADS_CHANNEL_ID;
        if (token && channel) {
            await sendSlackBotMessage(token, channel,
                `:rocket: *Nuevo registro en Lista de Espera Beta*\n` +
                `*Email:* ${normalizedEmail}\n` +
                `*Nombre:* ${name || 'No proporcionado'}\n` +
                `*Fecha:* ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`
            ).catch(() => {});
        }

        return NextResponse.json({ message: 'success' });
    } catch (error) {
        console.error('[Waitlist] Error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
