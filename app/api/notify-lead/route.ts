import { NextRequest, NextResponse } from 'next/server';

async function sendSlackMessage(text: string) {
    const webhookUrl = process.env.SLACK_LEADS_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
    } catch (err) {
        console.error('[Slack Lead Notify] Error:', err);
    }
}

export async function POST(req: NextRequest) {
    try {
        const { type, email, name } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
        }

        if (type === 'registration') {
            await sendSlackMessage(
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
