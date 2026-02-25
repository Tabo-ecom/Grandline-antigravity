import { NextRequest, NextResponse } from 'next/server';
import { gatherDataForReport } from '@/lib/services/vega/server-data-gatherer';
import { vegaGenerateReport } from '@/lib/services/vega/gemini';
import { adminGetAppData, adminSetAppData } from '@/lib/firebase/admin-helpers';
import { sendTelegramMessage, sendSlackMessage } from '@/lib/services/vega/notifications';
import type { VegaReport, VegaNotificationConfig } from '@/lib/types/vega';

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = process.env.CRON_USER_ID;
        if (!userId) {
            return NextResponse.json({ error: 'CRON_USER_ID not configured' }, { status: 500 });
        }

        const { context, period } = await gatherDataForReport('weekly', userId);
        const content = await vegaGenerateReport('weekly', context, period);

        const report: VegaReport = {
            id: `cron_weekly_${Date.now()}`,
            type: 'weekly',
            title: `La Brújula Táctica — ${period}`,
            content,
            generatedAt: Date.now(),
            period,
            automated: true,
            schedule: 'weekly_monday',
        };

        // Save report via Admin SDK
        const existing = await adminGetAppData<VegaReport[]>('vega_reports', userId) || [];
        existing.unshift(report);
        await adminSetAppData('vega_reports', existing.slice(0, 50), userId);

        // Get notification config via Admin SDK
        const config = await adminGetAppData<VegaNotificationConfig>('vega_notification_config', userId) || {
            telegramBotToken: '', telegramChatId: '', slackWebhookUrl: '',
        };

        const channels: string[] = [];

        // Telegram gets the full report
        if (config.telegramBotToken && config.telegramChatId) {
            channels.push('telegram');
            await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, content);
        }

        // Slack gets the full weekly report
        if (config.slackWebhookUrl) {
            channels.push('slack');
            await sendSlackMessage(config.slackWebhookUrl, content);
        }

        report.sentVia = channels as ('telegram' | 'slack')[];

        return NextResponse.json({ success: true, reportId: report.id, sentVia: channels });
    } catch (error: any) {
        console.error('Cron weekly report error:', error);
        return NextResponse.json({ error: error?.message || 'Error generating weekly report' }, { status: 500 });
    }
}
