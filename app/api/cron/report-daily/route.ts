import { NextRequest, NextResponse } from 'next/server';
import { gatherDataForReport } from '@/lib/services/vega/server-data-gatherer';
import { vegaGenerateReport } from '@/lib/services/vega/gemini';
import { saveReport } from '@/lib/services/vega/reports';
import { getNotificationConfig, sendNotification } from '@/lib/services/vega/notifications';
import type { VegaReport } from '@/lib/types/vega';

export async function GET(req: NextRequest) {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { context, period } = await gatherDataForReport('daily', 'admin');
        const content = await vegaGenerateReport('daily', context, period);

        const report: VegaReport = {
            id: `cron_daily_${Date.now()}`,
            type: 'daily',
            title: `El Latido del Negocio — ${period}`,
            content,
            generatedAt: Date.now(),
            period,
            automated: true,
            schedule: 'daily',
        };

        await saveReport(report, 'cron@system');

        // Send via configured channels
        const config = await getNotificationConfig('admin');
        const channels: string[] = [];
        if (config.telegramBotToken && config.telegramChatId) channels.push('telegram');
        if (config.slackWebhookUrl) channels.push('slack');

        if (channels.length > 0) {
            await sendNotification(config, content, channels);
            report.sentVia = channels as ('telegram' | 'slack')[];
        }

        return NextResponse.json({ success: true, reportId: report.id, sentVia: channels });
    } catch (error) {
        console.error('Cron daily report error:', error);
        return NextResponse.json({ error: 'Error generating daily report' }, { status: 500 });
    }
}
