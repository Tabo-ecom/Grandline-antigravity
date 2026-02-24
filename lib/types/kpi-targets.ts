export interface KPITarget {
    key: string;
    label: string;
    unit: string;
    good: number;
    warning: number;
    inverse: boolean;
    description: string;
}

export interface KPITargetsConfig {
    targets: KPITarget[];
    updatedAt: number;
}

export const DEFAULT_KPI_TARGETS: KPITarget[] = [
    {
        key: 'roas_real',
        label: 'ROAS Real',
        unit: 'x',
        good: 2,
        warning: 1.5,
        inverse: false,
        description: 'Retorno sobre inversion publicitaria. Mayor es mejor.',
    },
    {
        key: 'cpa',
        label: 'CPA',
        unit: '$',
        good: 25000,
        warning: 30000,
        inverse: true,
        description: 'Costo por adquisicion. Menor es mejor.',
    },
    {
        key: 'tasa_ent',
        label: 'Tasa de Entrega',
        unit: '%',
        good: 65,
        warning: 50,
        inverse: false,
        description: 'Porcentaje de ordenes entregadas vs no canceladas. Mayor es mejor.',
    },
    {
        key: 'tasa_can',
        label: 'Tasa de Cancelacion',
        unit: '%',
        good: 30,
        warning: 40,
        inverse: true,
        description: 'Porcentaje de ordenes canceladas. Menor es mejor.',
    },
    {
        key: 'margen_neto',
        label: 'Margen Neto',
        unit: '%',
        good: 15,
        warning: 5,
        inverse: false,
        description: 'Porcentaje de utilidad sobre ingreso. Mayor es mejor.',
    },
    {
        key: 'perc_ads_revenue',
        label: '% Ads vs Revenue',
        unit: '%',
        good: 25,
        warning: 35,
        inverse: true,
        description: 'Proporcion del gasto publicitario sobre facturacion. Menor es mejor.',
    },
    {
        key: 'tasa_dev',
        label: 'Tasa de Devolucion',
        unit: '%',
        good: 10,
        warning: 20,
        inverse: true,
        description: 'Porcentaje de ordenes devueltas. Menor es mejor.',
    },
];
