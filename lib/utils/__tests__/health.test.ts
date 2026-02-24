import { describe, it, expect } from 'vitest';
import { evaluateHealth, getHealthColor, getHealthBgClass, getHealthLabel, findTarget } from '../health';
import type { KPITarget } from '@/lib/types/kpi-targets';
import { DEFAULT_KPI_TARGETS } from '@/lib/types/kpi-targets';

// Normal KPI (higher is better)
const roasTarget: KPITarget = {
    key: 'roas_real',
    label: 'ROAS Real',
    unit: 'x',
    good: 2,
    warning: 1.5,
    inverse: false,
    description: 'Retorno sobre inversion publicitaria. Mayor es mejor.',
};

// Inverse KPI (lower is better)
const cpaTarget: KPITarget = {
    key: 'cpa',
    label: 'CPA',
    unit: '$',
    good: 25000,
    warning: 30000,
    inverse: true,
    description: 'Costo por adquisicion. Menor es mejor.',
};

describe('evaluateHealth', () => {
    describe('normal KPI (higher is better)', () => {
        it('returns good when value >= good threshold', () => {
            expect(evaluateHealth(2.5, roasTarget)).toBe('good');
            expect(evaluateHealth(2.0, roasTarget)).toBe('good');
        });

        it('returns warning between good and warning thresholds', () => {
            expect(evaluateHealth(1.7, roasTarget)).toBe('warning');
            expect(evaluateHealth(1.6, roasTarget)).toBe('warning');
        });

        it('returns bad when value <= warning threshold', () => {
            expect(evaluateHealth(1.5, roasTarget)).toBe('bad');
            expect(evaluateHealth(1.0, roasTarget)).toBe('bad');
            expect(evaluateHealth(0, roasTarget)).toBe('bad');
        });

        it('handles exact boundary values', () => {
            expect(evaluateHealth(2.0, roasTarget)).toBe('good'); // exactly good
            expect(evaluateHealth(1.5, roasTarget)).toBe('bad'); // exactly warning
        });
    });

    describe('inverse KPI (lower is better)', () => {
        it('returns good when value <= good threshold', () => {
            expect(evaluateHealth(20000, cpaTarget)).toBe('good');
            expect(evaluateHealth(25000, cpaTarget)).toBe('good');
        });

        it('returns warning between good and warning thresholds', () => {
            expect(evaluateHealth(27000, cpaTarget)).toBe('warning');
            expect(evaluateHealth(28000, cpaTarget)).toBe('warning');
        });

        it('returns bad when value >= warning threshold', () => {
            expect(evaluateHealth(30000, cpaTarget)).toBe('bad');
            expect(evaluateHealth(35000, cpaTarget)).toBe('bad');
        });

        it('handles exact boundary values', () => {
            expect(evaluateHealth(25000, cpaTarget)).toBe('good');
            expect(evaluateHealth(30000, cpaTarget)).toBe('bad');
        });
    });

    describe('zero values', () => {
        it('handles zero for normal KPI', () => {
            expect(evaluateHealth(0, roasTarget)).toBe('bad');
        });

        it('handles zero for inverse KPI', () => {
            expect(evaluateHealth(0, cpaTarget)).toBe('good');
        });
    });
});

describe('getHealthColor', () => {
    it('returns correct Tailwind class for each status', () => {
        expect(getHealthColor('good')).toBe('text-emerald-400');
        expect(getHealthColor('warning')).toBe('text-orange-400');
        expect(getHealthColor('bad')).toBe('text-red-400');
    });
});

describe('getHealthBgClass', () => {
    it('returns correct Tailwind background class for each status', () => {
        expect(getHealthBgClass('good')).toContain('emerald');
        expect(getHealthBgClass('warning')).toContain('orange');
        expect(getHealthBgClass('bad')).toContain('red');
    });
});

describe('getHealthLabel', () => {
    it('returns Spanish labels for known KPI keys', () => {
        expect(getHealthLabel('good', 'roas_real')).toBe('Saludable');
        expect(getHealthLabel('bad', 'roas_real')).toBe('Critico');
        expect(getHealthLabel('good', 'tasa_ent')).toBe('Optimo');
        expect(getHealthLabel('bad', 'tasa_can')).toBe('Critica');
    });

    it('returns generic labels for unknown KPI keys', () => {
        expect(getHealthLabel('good', 'unknown_kpi')).toBe('Bueno');
        expect(getHealthLabel('warning', 'unknown_kpi')).toBe('Atencion');
        expect(getHealthLabel('bad', 'unknown_kpi')).toBe('Critico');
    });
});

describe('findTarget', () => {
    it('finds target by key from DEFAULT_KPI_TARGETS', () => {
        const target = findTarget(DEFAULT_KPI_TARGETS, 'roas_real');
        expect(target).toBeDefined();
        expect(target!.key).toBe('roas_real');
        expect(target!.good).toBe(2);
    });

    it('returns undefined for non-existent key', () => {
        expect(findTarget(DEFAULT_KPI_TARGETS, 'nonexistent')).toBeUndefined();
    });

    it('works with custom target array', () => {
        const custom: KPITarget[] = [
            { key: 'custom_metric', label: 'Custom', unit: '%', good: 90, warning: 70, inverse: false, description: '' },
        ];
        expect(findTarget(custom, 'custom_metric')?.good).toBe(90);
    });
});
