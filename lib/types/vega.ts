// Vega AI Module - Type Definitions

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertFrequency = 'realtime' | 'daily' | 'weekly' | 'monthly';
export type AlertCondition = 'greater_than' | 'less_than' | 'equals' | 'change_percent_up' | 'change_percent_down';
export type NotificationChannel = 'in_app' | 'telegram' | 'slack';
export type ReportType = 'daily' | 'weekly' | 'monthly' | 'logistics' | 'financial' | 'supplier' | 'month_close' | 'audit' | 'efficiency' | 'ads' | 'profitability' | 'custom';

// Color identity per report type
export const REPORT_COLOR_MAP: Record<string, string> = {
    daily: '#d75c33',
    weekly: '#d75c33',
    logistics: '#3b82f6',
    financial: '#10b981',
    supplier: '#8b5cf6',
    month_close: '#f59e0b',
    monthly: '#f59e0b',
};

export const REPORT_TITLE_MAP: Record<string, string> = {
    daily: 'El Latido del Negocio',
    weekly: 'La Brújula Táctica',
    monthly: 'La Visión del Almirante',
    logistics: 'Bitácora Logística',
    financial: 'Estado de Resultados',
    supplier: 'Reporte Proveedor',
    month_close: 'Cierre de Mes',
};

export const REPORT_LABEL_MAP: Record<string, string> = {
    daily: 'REPORTE DIARIO',
    weekly: 'REPORTE SEMANAL',
    monthly: 'REPORTE MENSUAL',
    logistics: 'BITÁCORA LOGÍSTICA',
    financial: 'ESTADO DE RESULTADOS',
    supplier: 'REPORTE PROVEEDOR',
    month_close: 'CIERRE DE MES',
};

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

export interface VegaReportMetadata {
    healthScore: { level: string; score: number };
    kpis: Record<string, number>;
    metricsByCountry: {
        countryName: string;
        kpis: Record<string, number>;
        products: {
            id: string;
            name: string;
            n_ord: number;
            n_ent: number;
            n_can: number;
            n_dev: number;
            n_tra: number;
            tasa_ent: number;
            ads: number;
            cpa: number;
            cpaDesp: number;
            utilReal: number;
            utilProy: number;
            lossStreak?: number;
        }[];
    }[];
    adPlatformMetrics?: { fb: number; tiktok: number; google: number };
    prevKpis?: Record<string, number>;
    berryExpenses?: { category: string; amount: number }[];
    // New report data
    supplierKpis?: {
        ingreso: number; costo: number; ganancia: number; margen: number;
        unidades: number; ordenes: number;
        topProducts?: { nombre: string; unidades: number; ganancia: number; margen: number }[];
        stockAlerts?: { nombre: string; stockActual: number; diasRestantes: number }[];
    };
    cancelReasons?: { tag: string; count: number; pct: number }[];
    carrierBreakdown?: { carrier: string; orders: number; delivered: number; deliveryRate: number }[];
    pnlCascade?: {
        ingProveedor: number; ingDropshipping: number; ingTotal: number;
        costoTotal: number; gananciaBruta: number; margenBruto: number;
        fletes: number; ads: number; gastosOp: number; gastosAdmin: number;
        utilidadNeta: number; margenNeto: number;
    };
}

export interface VegaReport {
    id: string;
    type: ReportType;
    title: string;
    content: string;
    generatedAt: number;
    period: string;
    automated?: boolean;
    schedule?: 'daily' | 'weekly_monday' | 'weekly_friday' | 'monthly_1' | 'monthly_7' | 'monthly_15';
    sentVia?: ('telegram' | 'slack' | 'email')[];
    metadata?: VegaReportMetadata;
}

export interface VegaNotificationConfig {
    telegramBotToken: string;
    telegramChatId: string;
    slackWebhookUrl: string;
    emailEnabled?: boolean;
    emailRecipients?: string[]; // Multiple recipients
    // Slack Bot (bidirectional control)
    slackBotToken?: string;
    slackSigningSecret?: string;
    slackChannelId?: string;
}

export interface VegaScheduleConfig {
    timezone: string;
    dailyReport: { enabled: boolean; hour: number };
    weeklyReport: { enabled: boolean; dayOfWeek: number; hour: number };
    monthlyReport: { enabled: boolean; daysOfMonth: number[]; hour: number };
    logisticsReport?: { enabled: boolean; hour: number };              // Daily logistics
    financialReport?: { enabled: boolean; dayOfWeek: number; hour: number }; // Weekly financial
    supplierReport?: { enabled: boolean; dayOfWeek: number; hour: number };  // Weekly supplier
    monthCloseReport?: { enabled: boolean; dayOfMonth: number; hour: number }; // Monthly close
    adPerformanceReport: {
        enabled: boolean;
        intervalHours: number;
        startHour: number;
        endHour: number;
    };
    alertHours: { enabled: boolean; startHour: number; endHour: number };
    lastAdReportAt?: number;
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
