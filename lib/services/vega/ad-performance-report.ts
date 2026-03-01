/**
 * Vega AI - Ad Performance Report
 * Structured report of campaign performance sent every N hours.
 * NO AI involved — pure data formatting for speed.
 */

import { adminDb } from '@/lib/firebase/admin';
import { adminGetAppData, adminSetAppData } from '@/lib/firebase/admin-helpers';
import { decryptSettings } from '@/lib/api/crypto';
import { fetchTodayAdInsights, type CampaignInsight } from './meta-server';
import { sendTelegramMessage, sendSlackMessage } from './notifications';
import type { VegaNotificationConfig } from '@/lib/types/vega';

/** Minimum spend threshold (in local currency) to include in report */
const MIN_SPEND_THRESHOLD = 20000; // $20,000 COP

function fmt(n: number, currency: string): string {
    if (currency === 'COP') return `$${Math.round(n).toLocaleString('es-CO')}`;
    return `$${n.toFixed(2)}`;
}

function buildSlackAdReport(insights: CampaignInsight[], currency: string): string {
    const lines: string[] = [];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    lines.push(`📊 *Reporte de Ads* — ${timeStr}`);
    lines.push('');

    // Totals
    const totalSpend = insights.reduce((s, c) => s + c.spend, 0);
    const totalConversions = insights.reduce((s, c) => s + c.conversions, 0);
    const totalRevenue = insights.reduce((s, c) => s + c.revenue, 0);
    const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const overallCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

    lines.push(`💰 *Total*: Gasto ${fmt(totalSpend, currency)} | Conv: ${totalConversions} | ROAS: ${overallRoas.toFixed(2)}x | CPA: ${fmt(overallCpa, currency)}`);
    lines.push('');

    // Sort: highest spend first
    const sorted = [...insights].sort((a, b) => b.spend - a.spend);

    // Profitable campaigns (ROAS > 1)
    const profitable = sorted.filter(c => c.roas > 1 && c.conversions > 0);
    if (profitable.length > 0) {
        lines.push('🟢 *Rentables*');
        for (const c of profitable.slice(0, 8)) {
            lines.push(`• ${c.campaignName}: ${fmt(c.spend, currency)} | ${c.conversions} conv | ROAS ${c.roas.toFixed(2)}x | CPA ${fmt(c.cpa, currency)}`);
        }
        lines.push('');
    }

    // Spending but no conversions or ROAS < 1
    const losing = sorted.filter(c => c.roas <= 1 || c.conversions === 0);
    if (losing.length > 0) {
        lines.push('🔴 *Bajo rendimiento*');
        for (const c of losing.slice(0, 8)) {
            const status = c.conversions === 0 ? '0 conv' : `ROAS ${c.roas.toFixed(2)}x`;
            lines.push(`• ${c.campaignName}: ${fmt(c.spend, currency)} | ${status} | CPA ${fmt(c.cpa, currency)}`);
        }
        lines.push('');
    }

    lines.push('_Responde con acciones: "sube presupuesto de [campaña] un 20%"_');

    return lines.join('\n');
}

function buildTelegramAdReport(insights: CampaignInsight[], currency: string): string {
    const lines: string[] = [];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    lines.push(`📊 *Reporte de Ads — ${timeStr}*`);
    lines.push('');

    const totalSpend = insights.reduce((s, c) => s + c.spend, 0);
    const totalConversions = insights.reduce((s, c) => s + c.conversions, 0);
    const totalRevenue = insights.reduce((s, c) => s + c.revenue, 0);
    const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const overallCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

    lines.push(`💰 Gasto: ${fmt(totalSpend, currency)}`);
    lines.push(`📈 Conv: ${totalConversions} | ROAS: ${overallRoas.toFixed(2)}x | CPA: ${fmt(overallCpa, currency)}`);
    lines.push('');

    const sorted = [...insights].sort((a, b) => b.spend - a.spend);

    for (const c of sorted.slice(0, 10)) {
        const emoji = c.roas > 1 ? '🟢' : c.conversions > 0 ? '🟡' : '🔴';
        lines.push(`${emoji} ${c.campaignName}`);
        lines.push(`   Gasto: ${fmt(c.spend, currency)} | Conv: ${c.conversions} | ROAS: ${c.roas.toFixed(2)}x`);
    }

    return lines.join('\n');
}

export async function generateAndSendAdReport(
    userId: string,
): Promise<{ sent: boolean; campaigns: number; channels: string[] }> {
    if (!adminDb) throw new Error('Database not available');

    // Get user's ad settings (encrypted)
    const settingsDoc = await adminDb.collection('app_data').doc(`ad_settings_${userId}`).get();
    if (!settingsDoc.exists) return { sent: false, campaigns: 0, channels: [] };

    const rawSettings = settingsDoc.data()?.value;
    if (!rawSettings) return { sent: false, campaigns: 0, channels: [] };

    const settings = decryptSettings(rawSettings);
    const fbToken = settings.fb_token;
    const fbAccounts = settings.fb_account_ids || [];

    if (!fbToken || fbAccounts.length === 0) return { sent: false, campaigns: 0, channels: [] };

    // Fetch live insights from all accounts
    const allInsights: CampaignInsight[] = [];

    for (const account of fbAccounts) {
        try {
            const insights = await fetchTodayAdInsights(fbToken, account.id);
            allInsights.push(...insights);
        } catch (err) {
            console.error(`[AdReport] Error fetching account ${account.id}:`, err);
        }
    }

    // Filter: only campaigns with spend > threshold OR with conversions
    const currency = allInsights[0]?.currency || 'COP';
    const filtered = allInsights.filter(
        c => c.spend >= MIN_SPEND_THRESHOLD || c.conversions > 0,
    );

    if (filtered.length === 0) return { sent: false, campaigns: 0, channels: [] };

    // Get notification config
    const config = await adminGetAppData<VegaNotificationConfig>('vega_notification_config', userId) || {
        telegramBotToken: '', telegramChatId: '', slackWebhookUrl: '',
    };

    const channels: string[] = [];

    // Send to Slack
    if (config.slackWebhookUrl) {
        const slackMsg = buildSlackAdReport(filtered, currency);
        const ok = await sendSlackMessage(config.slackWebhookUrl, slackMsg);
        if (ok) channels.push('slack');
    }

    // Send to Telegram
    if (config.telegramBotToken && config.telegramChatId) {
        const tgMsg = buildTelegramAdReport(filtered, currency);
        const ok = await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, tgMsg);
        if (ok) channels.push('telegram');
    }

    // Update lastAdReportAt
    const scheduleDoc = await adminDb.collection('app_data').doc(`vega_schedule_config_${userId}`).get();
    if (scheduleDoc.exists) {
        await adminSetAppData('vega_schedule_config', {
            ...scheduleDoc.data()?.value,
            lastAdReportAt: Date.now(),
        }, userId);
    }

    return { sent: true, campaigns: filtered.length, channels };
}
