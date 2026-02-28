import type { KPITarget } from '@/lib/types/kpi-targets';
import type { KPIResults } from '@/lib/calculations/kpis';

export type HealthStatus = 'good' | 'warning' | 'bad';
export type OverallHealthLevel = 'EXCELENTE' | 'MUY BUENO' | 'BUENO' | 'ALERTA' | 'CRITICO';

export function evaluateHealth(value: number, target: KPITarget): HealthStatus {
    if (target.inverse) {
        if (value <= target.good) return 'good';
        if (value >= target.warning) return 'bad';
        return 'warning';
    }
    if (value >= target.good) return 'good';
    if (value <= target.warning) return 'bad';
    return 'warning';
}

export function getHealthColor(status: HealthStatus): string {
    switch (status) {
        case 'good': return 'text-emerald-400';
        case 'warning': return 'text-orange-400';
        case 'bad': return 'text-red-400';
    }
}

export function getHealthBgClass(status: HealthStatus): string {
    switch (status) {
        case 'good': return 'bg-emerald-500/10 border-emerald-500/20';
        case 'warning': return 'bg-orange-500/10 border-orange-500/20';
        case 'bad': return 'bg-red-500/10 border-red-500/20';
    }
}

export function getHealthLabel(status: HealthStatus, kpiKey: string): string {
    const labels: Record<string, Record<HealthStatus, string>> = {
        roas_real: { good: 'Saludable', warning: 'En riesgo', bad: 'Critico' },
        tasa_ent: { good: 'Optimo', warning: 'Aceptable', bad: 'Bajo' },
        perc_ads_revenue: { good: 'Eficiente', warning: 'Aceptable', bad: 'Alto' },
        tasa_can: { good: 'Controlada', warning: 'Elevada', bad: 'Critica' },
        tasa_dev: { good: 'Controlada', warning: 'Elevada', bad: 'Critica' },
        margen_neto: { good: 'Saludable', warning: 'Ajustado', bad: 'En perdida' },
        cpa: { good: 'Eficiente', warning: 'Elevado', bad: 'Critico' },
    };
    return labels[kpiKey]?.[status] || (
        status === 'good' ? 'Bueno' : status === 'warning' ? 'Atencion' : 'Critico'
    );
}

export function findTarget(targets: KPITarget[], key: string): KPITarget | undefined {
    return targets.find(t => t.key === key);
}

export function calculateOverallHealth(
    kpis: KPIResults,
    targets: KPITarget[]
): { level: OverallHealthLevel; score: number } {
    const weights: { key: string; weight: number; getValue: (k: KPIResults) => number }[] = [
        { key: 'roas_real', weight: 0.25, getValue: k => k.roas_real },
        { key: 'tasa_ent', weight: 0.20, getValue: k => k.tasa_ent },
        { key: 'tasa_can', weight: 0.15, getValue: k => k.tasa_can },
        { key: 'perc_ads_revenue', weight: 0.15, getValue: k => k.perc_ads_revenue },
    ];

    let weightedScore = 0;
    let totalWeight = 0;

    for (const w of weights) {
        const target = findTarget(targets, w.key);
        if (!target) continue;
        const status = evaluateHealth(w.getValue(kpis), target);
        const points = status === 'good' ? 100 : status === 'warning' ? 50 : 10;
        weightedScore += points * w.weight;
        totalWeight += w.weight;
    }

    // Utilidad real (25% weight) — special handling: positive = good, zero = warning, negative = bad
    const uRealWeight = 0.25;
    const uRealPoints = kpis.u_real > 0 ? 100 : kpis.u_real === 0 ? 50 : 10;
    weightedScore += uRealPoints * uRealWeight;
    totalWeight += uRealWeight;

    const score = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 50;

    let level: OverallHealthLevel;
    if (score >= 85) level = 'EXCELENTE';
    else if (score >= 70) level = 'MUY BUENO';
    else if (score >= 55) level = 'BUENO';
    else if (score >= 35) level = 'ALERTA';
    else level = 'CRITICO';

    return { level, score };
}
