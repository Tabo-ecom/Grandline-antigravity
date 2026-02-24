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
        const { context, period } = await gatherDataForReport('monthly', 'admin');
        const content = await vegaGenerateReport('monthly', context, period);

        const report: VegaReport = {
            id: `cron_monthly_${Date.now()}`,
            type: 'monthly',
            title: `La Visión del Almirante — ${period}`,
            content,
            generatedAt: Date.now(),
            period,
            automated: true,
            schedule: `monthly_${new Date().getDate()}` as any,
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
        console.error('Cron monthly report error:', error);
        return NextResponse.json({ error: 'Error generating monthly report' }, { status: 500 });
    }
}
