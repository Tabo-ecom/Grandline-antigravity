import type { KPITarget } from '@/lib/types/kpi-targets';

export type HealthStatus = 'good' | 'warning' | 'bad';

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
