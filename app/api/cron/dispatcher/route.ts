/**
 * Cron Dispatcher - runs every hour
 * Checks all users' schedule configs and triggers reports as needed.
 * Replaces the 3 individual cron routes (report-daily, report-weekly, report-monthly).
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getScheduleConfig, shouldRunReport } from '@/lib/services/vega/schedule';
import { generateAndSendAdReport } from '@/lib/services/vega/ad-performance-report';

const REPORT_TYPES = ['daily', 'weekly', 'monthly'] as const;
const PREFIX = 'vega_schedule_config_';

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
        return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    try {
        const nowUtc = new Date();
        const dispatched: { userId: string; reportType: string }[] = [];
        const errors: { userId: string; reportType: string; error: string }[] = [];

        // Query all docs whose ID starts with "vega_schedule_config_"
        const snapshot = await adminDb.collection('app_data')
            .where(FieldPath.documentId(), '>=', PREFIX)
            .where(FieldPath.documentId(), '<', PREFIX + '\uf8ff')
            .get();

        const userIds = snapshot.docs.map(doc => doc.id.slice(PREFIX.length));

        // Resolve base URL for internal API calls
        const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

        for (const userId of userIds) {
            const config = await getScheduleConfig(userId);

            // Standard reports (daily, weekly, monthly)
            for (const reportType of REPORT_TYPES) {
                if (shouldRunReport(config, reportType, nowUtc)) {
                    try {
                        fetch(`${baseUrl}/api/cron/generate-report`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${process.env.CRON_SECRET}`,
                            },
                            body: JSON.stringify({ userId, reportType }),
                        }).catch(() => {});

                        dispatched.push({ userId, reportType });
                    } catch (e: any) {
                        errors.push({ userId, reportType, error: e?.message || 'dispatch failed' });
                    }
                }
            }

            // Ad performance report (every N hours)
            if (shouldRunReport(config, 'ad_performance', nowUtc)) {
                try {
                    generateAndSendAdReport(userId).catch(() => {});
                    dispatched.push({ userId, reportType: 'ad_performance' });
                } catch (e: any) {
                    errors.push({ userId, reportType: 'ad_performance', error: e?.message || 'dispatch failed' });
                }
            }
        }

        return NextResponse.json({
            success: true,
            timestamp: nowUtc.toISOString(),
            usersChecked: userIds.length,
            dispatched,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Dispatcher error' },
            { status: 500 },
        );
    }
}
