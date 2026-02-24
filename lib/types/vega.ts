// Vega AI Module - Type Definitions

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertFrequency = 'realtime' | 'daily' | 'weekly' | 'monthly';
export type AlertCondition = 'greater_than' | 'less_than' | 'equals' | 'change_percent_up' | 'change_percent_down';
export type NotificationChannel = 'in_app' | 'telegram' | 'slack';
export type ReportType = 'daily' | 'weekly' | 'monthly' | 'audit' | 'custom';

export interface VegaAlertRule {
    id: string;
    name: string;
    metric: string;
    condition: AlertCondition;
    threshold: number;
    frequency: AlertFrequency;
    channels: NotificationChannel[];
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface VegaTriggeredAlert {
    id: string;
    ruleId: string;
    ruleName: string;
    message: string;
    severity: AlertSeverity;
    metric: string;
    currentValue: number;
    threshold: number;
    timestamp: number;
    acknowledged: boolean;
}

export interface VegaChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export interface VegaReport {
    id: string;
    type: ReportType;
    title: string;
    content: string;
    generatedAt: number;
    period: string;
    automated?: boolean;
    schedule?: 'daily' | 'weekly_monday' | 'monthly_1' | 'monthly_7' | 'monthly_15';
    sentVia?: ('telegram' | 'slack')[];
}

export interface VegaNotificationConfig {
    telegramBotToken: string;
    telegramChatId: string;
    slackWebhookUrl: string;
}

// Available metrics for alert configuration
export const VEGA_METRICS = [
    { key: 'roas_real', label: 'ROAS Real', unit: 'x' },
    { key: 'cpa', label: 'CPA', unit: '$' },
    { key: 'tasa_ent', label: 'Tasa de Entrega', unit: '%' },
    { key: 'tasa_can', label: 'Tasa de Cancelación', unit: '%' },
    { key: 'tasa_dev', label: 'Tasa de Devolución', unit: '%' },
    { key: 'g_ads', label: 'Gasto Total Ads', unit: '$' },
    { key: 'ing_real', label: 'Ingreso Real', unit: '$' },
    { key: 'u_real', label: 'Utilidad Real', unit: '$' },
    { key: 'fact_neto', label: 'Facturación Neta', unit: '$' },
    { key: 'perc_ads_revenue', label: '% Ads vs Revenue', unit: '%' },
    { key: 'n_ord', label: 'Total Órdenes', unit: '#' },
] as const;

export const ALERT_CONDITIONS: { key: AlertCondition; label: string }[] = [
    { key: 'greater_than', label: 'Mayor que' },
    { key: 'less_than', label: 'Menor que' },
    { key: 'equals', label: 'Igual a' },
    { key: 'change_percent_up', label: 'Sube más de %' },
    { key: 'change_percent_down', label: 'Baja más de %' },
];
