import { NextRequest, NextResponse } from 'next/server';
import { gatherDataForReport } from '@/lib/services/vega/server-data-gatherer';
import { vegaGenerateReport } from '@/lib/services/vega/gemini';
import { saveReport } from '@/lib/services/vega/reports';
import { getNotificationConfig, sendNotification } from '@/lib/services/vega/notifications';
import type { VegaReport } from '@/lib/types/vega';

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { context, period } = await gatherDataForReport('weekly', 'admin');
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

        await saveReport(report, 'cron@system');

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
        console.error('Cron weekly report error:', error);
        return NextResponse.json({ error: 'Error generating weekly report' }, { status: 500 });
    }
}
