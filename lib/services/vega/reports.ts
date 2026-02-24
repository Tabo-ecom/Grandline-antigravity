/**
 * Vega AI - Report Generation & Storage
 */

import { getAppData, setAppData } from '@/lib/firebase/firestore';
import type { VegaReport } from '@/lib/types/vega';

const REPORTS_KEY = 'vega_reports';

export async function getReportHistory(userId: string): Promise<VegaReport[]> {
    if (!userId) return [];
    return (await getAppData<VegaReport[]>(REPORTS_KEY, userId)) || [];
}

export async function saveReport(report: VegaReport, userId: string): Promise<void> {
    if (!userId) return;
    const reports = await getReportHistory(userId);
    reports.unshift(report);
    // Keep only last 50 reports
    await setAppData(REPORTS_KEY, reports.slice(0, 50), userId);
}

export async function getReport(reportId: string, userId: string): Promise<VegaReport | null> {
    if (!userId) return null;
    const reports = await getReportHistory(userId);
    return reports.find(r => r.id === reportId) || null;
}
