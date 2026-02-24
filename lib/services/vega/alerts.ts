/**
 * Vega AI - Alert Rules CRUD + Evaluation
 */

import { getAppData, setAppData } from '@/lib/firebase/firestore';
import type { VegaAlertRule, VegaTriggeredAlert } from '@/lib/types/vega';

const RULES_KEY = 'vega_alert_rules';
const TRIGGERED_KEY = 'vega_triggered_alerts';

// CRUD operations for alert rules
export async function getAlertRules(userId: string): Promise<VegaAlertRule[]> {
    if (!userId) return [];
    return (await getAppData<VegaAlertRule[]>(RULES_KEY, userId)) || [];
}

export async function saveAlertRule(rule: VegaAlertRule, userId: string): Promise<void> {
    if (!userId) return;
    const rules = await getAlertRules(userId);
    const idx = rules.findIndex(r => r.id === rule.id);
    if (idx >= 0) {
        rules[idx] = { ...rule, updatedAt: Date.now() };
    } else {
        rules.push({ ...rule, createdAt: Date.now(), updatedAt: Date.now() });
    }
    await setAppData(RULES_KEY, rules, userId);
}

export async function deleteAlertRule(ruleId: string, userId: string): Promise<void> {
    if (!userId) return;
    const rules = await getAlertRules(userId);
    await setAppData(RULES_KEY, rules.filter(r => r.id !== ruleId), userId);
}

export async function toggleAlertRule(ruleId: string, enabled: boolean, userId: string): Promise<void> {
    if (!userId) return;
    const rules = await getAlertRules(userId);
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
        rule.enabled = enabled;
        rule.updatedAt = Date.now();
        await setAppData(RULES_KEY, rules, userId);
    }
}

// Triggered alerts
export async function getTriggeredAlerts(userId: string): Promise<VegaTriggeredAlert[]> {
    if (!userId) return [];
    return (await getAppData<VegaTriggeredAlert[]>(TRIGGERED_KEY, userId)) || [];
}

export async function saveTriggeredAlert(alert: VegaTriggeredAlert, userId: string): Promise<void> {
    if (!userId) return;
    const alerts = await getTriggeredAlerts(userId);
    alerts.unshift(alert);
    // Keep only last 100 alerts
    await setAppData(TRIGGERED_KEY, alerts.slice(0, 100), userId);
}

export async function acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    if (!userId) return;
    const alerts = await getTriggeredAlerts(userId);
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
        alert.acknowledged = true;
        await setAppData(TRIGGERED_KEY, alerts, userId);
    }
}
