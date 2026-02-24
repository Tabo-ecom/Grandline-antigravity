import { NextRequest, NextResponse } from 'next/server';
import { getAlertRules, saveTriggeredAlert } from '@/lib/services/vega/alerts';
import { getNotificationConfig, sendNotification } from '@/lib/services/vega/notifications';
import { vegaEvaluateAlerts } from '@/lib/services/vega/gemini';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import type { VegaTriggeredAlert } from '@/lib/types/vega';

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const { currentValues } = await req.json();

        if (!currentValues) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
        }

        const rules = await getAlertRules(auth.teamId);
        const activeRules = rules.filter(r => r.enabled);

        if (activeRules.length === 0) {
            return NextResponse.json({ triggered: [] });
        }

        const results = await vegaEvaluateAlerts(
            activeRules.map(r => ({ metric: r.metric, condition: r.condition, threshold: r.threshold, name: r.name })),
            currentValues
        );

        const triggered: VegaTriggeredAlert[] = [];
        const notifConfig = await getNotificationConfig(auth.teamId);

        for (const result of results) {
            if (!result.triggered) continue;

            const rule = activeRules[result.ruleIndex];
            const alert: VegaTriggeredAlert = {
                id: `alert_${Date.now()}_${result.ruleIndex}`,
                ruleId: rule.id,
                ruleName: rule.name,
                message: result.message,
                severity: rule.threshold > 0 && currentValues[rule.metric] > rule.threshold * 1.5 ? 'critical' : 'warning',
                metric: rule.metric,
                currentValue: currentValues[rule.metric],
                threshold: rule.threshold,
                timestamp: Date.now(),
                acknowledged: false,
            };

            triggered.push(alert);
            await saveTriggeredAlert(alert, auth.teamId);

            if (rule.channels.length > 0) {
                await sendNotification(notifConfig, `🚨 VEGA ALERT: ${result.message}`, rule.channels);
            }
        }

        return NextResponse.json({ triggered });
    } catch (error) {
        console.error('Error evaluating alerts:', error);
        return NextResponse.json({ error: 'Error al evaluar alertas' }, { status: 500 });
    }
}
