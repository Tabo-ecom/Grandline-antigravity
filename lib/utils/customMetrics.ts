import type { CustomMetric } from '@/lib/services/marketing';

const AVAILABLE_VARIABLES = [
    'amount', 'impressions', 'clicks', 'ctr', 'cpc',
    'page_visits', 'add_to_cart', 'conversions', 'revenue_attributed',
    'real_cpa', 'fb_cpa', 'facturado_real', 'facturado_bruto', 'facturado_despachado'
] as const;

export type MetricVariable = typeof AVAILABLE_VARIABLES[number];

export const METRIC_VARIABLES = AVAILABLE_VARIABLES;

/**
 * Evaluate a custom metric formula like "{revenue_attributed} / {clicks}"
 * against a data object containing the variable values.
 */
export function evaluateCustomMetric(formula: string, data: Record<string, number>): number {
    try {
        // Replace {variable} tokens with numeric values
        const expression = formula.replace(/\{(\w+)\}/g, (_, varName) => {
            const val = data[varName];
            return typeof val === 'number' && isFinite(val) ? String(val) : '0';
        });

        // Validate: only allow numbers, operators, parentheses, whitespace, and decimal points
        if (!/^[\d\s+\-*/().]+$/.test(expression)) {
            return 0;
        }

        // Use Function constructor for safe arithmetic evaluation
        const result = new Function(`return (${expression})`)();

        if (typeof result !== 'number' || !isFinite(result)) {
            return 0;
        }

        return result;
    } catch {
        return 0;
    }
}

/**
 * Format a custom metric value based on its format type.
 */
export function formatMetricValue(value: number, format: CustomMetric['format']): string {
    if (!isFinite(value) || value === 0) return '-';

    switch (format) {
        case 'currency':
            return new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(value);
        case 'percent':
            return `${value.toFixed(1)}%`;
        case 'number':
        default:
            return value.toFixed(2);
    }
}
