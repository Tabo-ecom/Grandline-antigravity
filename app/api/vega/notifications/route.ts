import { NextRequest, NextResponse } from 'next/server';
import { getNotificationConfig, saveNotificationConfig, sendTelegramMessage, sendSlackMessage } from '@/lib/services/vega/notifications';
import { sendReportEmail } from '@/lib/services/vega/email';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import type { VegaNotificationConfig } from '@/lib/types/vega';

export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const config = await getNotificationConfig(auth.teamId);
        return NextResponse.json({ config });
    } catch (error) {
        console.error('Error fetching notification config:', error);
        return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const { config, test } = await req.json();

        if (test) {
            const testConfig = config as VegaNotificationConfig;
            const results: Record<string, boolean> = {};

            if (testConfig.telegramBotToken && testConfig.telegramChatId) {
                results.telegram = await sendTelegramMessage(
                    testConfig.telegramBotToken,
                    testConfig.telegramChatId,
                    '🧪 *VEGA TEST* - Notificación de prueba configurada correctamente.'
                );
            }

            if (testConfig.slackWebhookUrl) {
                results.slack = await sendSlackMessage(
                    testConfig.slackWebhookUrl,
                    '🧪 *VEGA TEST* - Notificación de prueba configurada correctamente.'
                );
            }

            if (testConfig.emailEnabled && auth.email) {
                results.email = await sendReportEmail(
                    auth.email,
                    '🧪 VEGA TEST — Notificación de prueba',
                    `<div style="font-family: Arial, sans-serif; padding: 24px; background: #0A0A0F; color: #ededed;">
                        <h2 style="color: #d75c33;">VEGA TEST</h2>
                        <p>Notificación de prueba configurada correctamente.</p>
                        <p style="color: #6b7280; font-size: 12px;">Los reportes diarios se enviarán a este correo.</p>
                    </div>`
                );
            }

            return NextResponse.json({ success: true, results });
        }

        if (!config) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
        }

        await saveNotificationConfig(config as VegaNotificationConfig, auth.teamId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving notification config:', error);
        return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 });
    }
}
