/**
 * Preview API
 * Returns sample formatted messages for each notification channel and report type.
 * Uses the user's most recent report data for realistic previews.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { adminGetAppData } from '@/lib/firebase/admin-helpers';
import { getNotificationConfig, sendTelegramMessage, sendSlackMessage } from '@/lib/services/vega/notifications';
import { sendReportEmail } from '@/lib/services/vega/email';
import type { VegaReport } from '@/lib/types/vega';

function fmt(n: number): string {
    return `$${Math.round(n).toLocaleString('es-CO')}`;
}

function buildSampleSlackDaily(report: VegaReport | null): string {
    if (!report?.metadata?.kpis) {
        return '🧭 *VEGA — Reporte Diario* (1 Mar 2026)\n\n📊 *Resumen*\nÓrdenes: 45 | Entregadas: 28 (62.2%) | Tránsito: 12\nAds: $850,000 | ROAS: 2.15x | CPA Desp: $30,357\nUtil. Real: $420,000 | Util. Proy: $580,000\n\n🟢 *Top 5 Productos*\n• Producto A: 15 órd | CPA: $25,000 | U.Proy: $180,000 ✅\n• Producto B: 12 órd | CPA: $28,000 | U.Proy: $95,000 ✅\n\n💡 *Recomendaciones*\n1. Escalar Producto A — mejor ROAS\n2. Revisar CPA de Producto C';
    }

    const k = report.metadata.kpis;
    const cpaDesp = k.n_nc > 0 ? k.g_ads / k.n_nc : 0;
    return `🧭 *VEGA — Reporte Diario* (${report.period})\n\n📊 *Resumen*\nÓrdenes: ${k.n_ord} | Entregadas: ${k.n_ent} (${(k.tasa_ent || 0).toFixed(1)}%) | Tránsito: ${k.n_tra}\nAds: ${fmt(k.g_ads)} | ROAS: ${(k.roas_real || 0).toFixed(2)}x | CPA Desp: ${fmt(cpaDesp)}\nUtil. Real: ${fmt(k.u_real)}\n\n💡 Recomendaciones generadas por IA incluidas en el reporte completo.`;
}

function buildSampleTelegramDaily(report: VegaReport | null): string {
    if (!report?.content) {
        return '📊 *VEGA — El Latido del Negocio*\n1 Mar 2026\n\n*Resumen Ejecutivo*\nOperación estable con 45 órdenes...\n\n*KPIs Clave*\n- ROAS: 2.15x\n- CPA: $30,357\n- Tasa de entrega: 62.2%\n\n*Recomendaciones*\n1. Escalar productos rentables\n2. Optimizar CPA en productos de mayor gasto';
    }
    // Truncate content for preview
    return report.content.substring(0, 500) + (report.content.length > 500 ? '...' : '');
}

function buildSampleSlackAds(): string {
    return '📊 *Reporte de Ads* — 14:00\n\n💰 *Total*: Gasto $1,250,000 | Conv: 18 | ROAS: 1.85x | CPA $69,444\n\n🟢 *Rentables*\n• Campaign Alpha: $450,000 | 8 conv | ROAS 2.40x | CPA $56,250\n• Campaign Beta: $320,000 | 5 conv | ROAS 1.95x | CPA $64,000\n\n🔴 *Bajo rendimiento*\n• Campaign Gamma: $280,000 | 2 conv | ROAS 0.65x | CPA $140,000\n• Campaign Delta: $200,000 | 0 conv | CPA N/A\n\n_Responde con acciones: "sube presupuesto de Campaign Alpha un 20%"_';
}

function buildSampleSlackAlert(): string {
    return '🚨 *VEGA — Alerta*\n\n*[CRITICA]* ROAS cayó a 0.8x (umbral: 1.5x)\nLa campaña "Campaign Gamma" tiene ROAS negativo con gasto de $280,000.\n\n*Acción sugerida:* Pausar campaña o reducir presupuesto un 50%.';
}

function buildSampleEmailSubject(report: VegaReport | null): string {
    if (report) return `VEGA — ${report.title}`;
    return 'VEGA — El Latido del Negocio — 1 Mar 2026';
}

export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        // Get latest report for realistic data
        const reports = await adminGetAppData<VegaReport[]>('vega_reports', auth.teamId) || [];
        const latestDaily = reports.find(r => r.type === 'daily') || null;

        return NextResponse.json({
            previews: {
                slack: {
                    daily: buildSampleSlackDaily(latestDaily),
                    ads: buildSampleSlackAds(),
                    alert: buildSampleSlackAlert(),
                },
                telegram: {
                    daily: buildSampleTelegramDaily(latestDaily),
                    ads: buildSampleSlackAds().replace(/\*/g, '*'), // Same format
                    alert: buildSampleSlackAlert().replace(/\*/g, '*'),
                },
                email: {
                    subject: buildSampleEmailSubject(latestDaily),
                    preview: 'El reporte completo se envía como HTML formateado con el diseño de Grand Line.',
                },
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Error generating preview' },
            { status: 500 },
        );
    }
}

/** Send the preview message as a test to the selected channel */
export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const { channel, previewType } = await req.json();

        // Get notification config
        const notifConfig = await getNotificationConfig(auth.teamId);

        // Build the preview message
        const reports = await adminGetAppData<VegaReport[]>('vega_reports', auth.teamId) || [];
        const latestDaily = reports.find(r => r.type === 'daily') || null;

        const slackPreviews: Record<string, string> = {
            daily: buildSampleSlackDaily(latestDaily),
            ads: buildSampleSlackAds(),
            alert: buildSampleSlackAlert(),
        };
        const telegramPreviews: Record<string, string> = {
            daily: buildSampleTelegramDaily(latestDaily),
            ads: buildSampleSlackAds(),
            alert: buildSampleSlackAlert(),
        };

        let success = false;

        if (channel === 'telegram') {
            if (!notifConfig.telegramBotToken || !notifConfig.telegramChatId) {
                return NextResponse.json({ error: 'Telegram no configurado. Guarda primero la configuración con Bot Token y Chat ID.' }, { status: 400 });
            }
            const message = telegramPreviews[previewType] || telegramPreviews.daily;
            success = await sendTelegramMessage(notifConfig.telegramBotToken, notifConfig.telegramChatId, message);
            if (!success) {
                return NextResponse.json({ error: 'Telegram falló. Verifica Bot Token y Chat ID.' }, { status: 400 });
            }
        } else if (channel === 'slack') {
            if (!notifConfig.slackWebhookUrl) {
                return NextResponse.json({ error: 'Slack no configurado. Guarda primero la configuración con el Webhook URL.' }, { status: 400 });
            }
            const message = slackPreviews[previewType] || slackPreviews.daily;
            success = await sendSlackMessage(notifConfig.slackWebhookUrl, message);
            if (!success) {
                return NextResponse.json({ error: `Slack webhook falló. Verifica que el URL sea válido: ${notifConfig.slackWebhookUrl.substring(0, 40)}...` }, { status: 400 });
            }
        } else if (channel === 'email') {
            if (!notifConfig.emailEnabled || !auth.email) {
                return NextResponse.json({ error: 'Email no habilitado.' }, { status: 400 });
            }
            success = await sendReportEmail(
                auth.email,
                buildSampleEmailSubject(latestDaily),
                `<div style="font-family: Arial, sans-serif; padding: 24px; background: #0A0A0F; color: #ededed;">
                    <h2 style="color: #d75c33;">VEGA — Preview Test</h2>
                    <pre style="white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${slackPreviews.daily}</pre>
                </div>`,
            );
        }

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'No se pudo enviar. Verifica la configuración del canal.' }, { status: 500 });
        }
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Error sending test' },
            { status: 500 },
        );
    }
}
