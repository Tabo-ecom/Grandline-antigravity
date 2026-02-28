/**
 * Vega AI - Report Generation & Storage
 * Uses Firebase Admin SDK (server-side) for Firestore access.
 */

import { adminDb } from '@/lib/firebase/admin';
import type { VegaReport } from '@/lib/types/vega';

const COLLECTION = 'app_data';
const REPORTS_KEY = 'vega_reports';

function getDocId(userId: string) {
    return `${REPORTS_KEY}_${userId}`;
}

export async function getReportHistory(userId: string): Promise<VegaReport[]> {
    if (!userId || !adminDb) return [];
    const docRef = adminDb.collection(COLLECTION).doc(getDocId(userId));
    const snap = await docRef.get();
    if (!snap.exists) return [];
    return (snap.data()?.value as VegaReport[]) || [];
}

export async function saveReport(report: VegaReport, userId: string): Promise<void> {
    if (!userId || !adminDb) return;
    const reports = await getReportHistory(userId);
    reports.unshift(report);
    // Keep only last 50 reports
    const docRef = adminDb.collection(COLLECTION).doc(getDocId(userId));
    await docRef.set({
        key: REPORTS_KEY,
        value: reports.slice(0, 50),
        userId,
        updated_at: new Date(),
    });
}

export async function getReport(reportId: string, userId: string): Promise<VegaReport | null> {
    if (!userId) return null;
    const reports = await getReportHistory(userId);
    return reports.find(r => r.id === reportId) || null;
}

export async function deleteReport(reportId: string, userId: string): Promise<void> {
    if (!userId || !adminDb) return;
    const reports = await getReportHistory(userId);
    const filtered = reports.filter(r => r.id !== reportId);
    const docRef = adminDb.collection(COLLECTION).doc(getDocId(userId));
    await docRef.set({
        key: REPORTS_KEY,
        value: filtered,
        userId,
        updated_at: new Date(),
    });
}
