/**
 * Vega AI - Schedule Configuration Service
 * Manages per-user report scheduling and timezone preferences
 */

import { adminGetAppData, adminSetAppData } from '@/lib/firebase/admin-helpers';
import type { VegaScheduleConfig } from '@/lib/types/vega';

const SCHEDULE_KEY = 'vega_schedule_config';

const DEFAULT_SCHEDULE: VegaScheduleConfig = {
    timezone: 'America/Bogota',
    dailyReport: { enabled: false, hour: 8 },
    weeklyReport: { enabled: false, dayOfWeek: 1, hour: 8 },
    monthlyReport: { enabled: false, daysOfMonth: [1, 15], hour: 8 },
    adPerformanceReport: { enabled: false, intervalHours: 2, startHour: 8, endHour: 22 },
    alertHours: { enabled: false, startHour: 7, endHour: 21 },
};

export async function getScheduleConfig(userId: string): Promise<VegaScheduleConfig> {
    const saved = await adminGetAppData<VegaScheduleConfig>(SCHEDULE_KEY, userId);
    return saved ? { ...DEFAULT_SCHEDULE, ...saved } : DEFAULT_SCHEDULE;
}

export async function saveScheduleConfig(config: VegaScheduleConfig, userId: string): Promise<void> {
    await adminSetAppData(SCHEDULE_KEY, config, userId);
}

/** Get current time in the user's timezone */
export function getUserLocalTime(timezone: string): Date {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
    return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
}

/** Check if a report should run right now based on user's schedule */
export function shouldRunReport(
    config: VegaScheduleConfig,
    reportType: 'daily' | 'weekly' | 'monthly' | 'ad_performance',
    nowUtc: Date,
): boolean {
    const local = getUserLocalTime(config.timezone);
    const hour = local.getHours();
    const dayOfWeek = local.getDay();
    const dayOfMonth = local.getDate();

    switch (reportType) {
        case 'daily':
            return config.dailyReport.enabled && hour === config.dailyReport.hour;

        case 'weekly':
            return config.weeklyReport.enabled
                && dayOfWeek === config.weeklyReport.dayOfWeek
                && hour === config.weeklyReport.hour;

        case 'monthly':
            return config.monthlyReport.enabled
                && config.monthlyReport.daysOfMonth.includes(dayOfMonth)
                && hour === config.monthlyReport.hour;

        case 'ad_performance': {
            if (!config.adPerformanceReport.enabled) return false;
            if (hour < config.adPerformanceReport.startHour || hour >= config.adPerformanceReport.endHour) return false;
            // Check interval since last run
            const lastRun = config.lastAdReportAt || 0;
            const hoursSinceLast = (nowUtc.getTime() - lastRun) / (1000 * 60 * 60);
            return hoursSinceLast >= config.adPerformanceReport.intervalHours;
        }

        default:
            return false;
    }
}

/** Check if alerts should be evaluated right now */
export function isAlertHourActive(config: VegaScheduleConfig): boolean {
    if (!config.alertHours.enabled) return true; // No restriction = always active
    const local = getUserLocalTime(config.timezone);
    const hour = local.getHours();
    return hour >= config.alertHours.startHour && hour < config.alertHours.endHour;
}

/** Common LATAM timezones for the UI selector */
export const LATAM_TIMEZONES = [
    { value: 'America/Bogota', label: 'Colombia (UTC-5)' },
    { value: 'America/Lima', label: 'Peru (UTC-5)' },
    { value: 'America/Guayaquil', label: 'Ecuador (UTC-5)' },
    { value: 'America/Panama', label: 'Panama (UTC-5)' },
    { value: 'America/Guatemala', label: 'Guatemala (UTC-6)' },
    { value: 'America/Mexico_City', label: 'Mexico (UTC-6)' },
    { value: 'America/Santiago', label: 'Chile (UTC-3)' },
    { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (UTC-3)' },
    { value: 'America/Sao_Paulo', label: 'Brasil (UTC-3)' },
    { value: 'America/Caracas', label: 'Venezuela (UTC-4)' },
    { value: 'America/New_York', label: 'US Eastern (UTC-5)' },
] as const;
