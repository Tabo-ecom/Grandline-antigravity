/**
 * Generate Report Endpoint
 * Called by the dispatcher to generate a report for a single user.
 * POST: { userId, reportType }
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateAndSendReport } from '@/lib/services/vega/report-generator';

export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { userId, reportType } = await req.json();

        if (!userId || !reportType) {
            return NextResponse.json(
                { error: 'Missing userId or reportType' },
                { status: 400 },
            );
        }

        if (!['daily', 'weekly', 'monthly'].includes(reportType)) {
            return NextResponse.json(
                { error: 'Invalid reportType' },
                { status: 400 },
            );
        }

        const result = await generateAndSendReport(userId, reportType);

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error: any) {
        console.error(`[generate-report] Error:`, error);
        return NextResponse.json(
            { error: error?.message || 'Error generating report' },
            { status: 500 },
        );
    }
}
