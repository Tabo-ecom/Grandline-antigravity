import { NextRequest, NextResponse } from 'next/server';
import { sendSlackBotMessage } from '@/lib/services/vega/slack-bot';

async function notifySlack(text: string) {
    const token = process.env.SLACK_BOT_TOKEN;
    const channel = process.env.SLACK_LEADS_CHANNEL_ID;
    if (!token || !channel) return;

    await sendSlackBotMessage(token, channel, text);
}

export async function POST(req: NextRequest) {
    try {
        const { type, email, name } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
        }

        if (type === 'registration') {
            await notifySlack(
                `:new: *Nuevo registro en Grand Line*\n` +
                `*Email:* ${email}\n` +
                `*Nombre:* ${name || 'No proporcionado'}\n` +
                `*Fecha:* ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Notify Lead] Error:', error);
        return NextResponse.json({ error: 'Error' }, { status: 500 });
    }
}
