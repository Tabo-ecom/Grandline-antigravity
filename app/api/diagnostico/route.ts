import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendSlackBotMessage } from '@/lib/services/vega/slack-bot';

async function notifySlack(name: string, email: string, whatsapp: string, metrics: any, country: string) {
    const token = process.env.SLACK_BOT_TOKEN;
    const channel = process.env.SLACK_LEADS_CHANNEL_ID;
    if (!token || !channel) return;

    const lines = [
        `:bar_chart: *Nueva auditoría completada*`,
        `*Nombre:* ${name}`,
        `*Email:* ${email}`,
    ];
    if (whatsapp) lines.push(`*WhatsApp:* ${whatsapp}`);
    if (country) lines.push(`*País:* ${country}`);
    if (metrics) {
        if (metrics.total_orders) lines.push(`*Órdenes:* ${metrics.total_orders}`);
        if (metrics.delivery_rate) lines.push(`*Tasa entrega:* ${metrics.delivery_rate.toFixed(1)}%`);
        if (metrics.profit !== undefined) lines.push(`*Utilidad:* $${Math.round(metrics.profit).toLocaleString()}`);
    }
    lines.push(`*Fecha:* ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);

    await sendSlackBotMessage(token, channel, lines.join('\n'));
}

export async function POST(req: NextRequest) {
    try {
        if (!adminDb) {
            return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
        }

        const body = await req.json();
        const { name, email, whatsapp, survey, metrics, country, productCount, dateRange } = body;

        if (!name || !email) {
            return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 });
        }

        await adminDb.collection('diagnostic_leads').add({
            name,
            email,
            whatsapp: whatsapp || '',
            survey: survey || {},
            metrics: metrics || {},
            country: country || '',
            productCount: productCount || 0,
            dateRange: dateRange || '',
            createdAt: new Date().toISOString(),
        });

        // Non-blocking Slack notification
        notifySlack(name, email, whatsapp || '', metrics, country).catch(() => {});

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Diagnostico API] Error:', error);
        return NextResponse.json({ error: 'Error guardando datos' }, { status: 500 });
    }
}
