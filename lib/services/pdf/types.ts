import type { KPIResults } from '@/lib/calculations/kpis';
import type { KPITarget } from '@/lib/types/kpi-targets';
import type { VegaReportMetadata } from '@/lib/types/vega';

export interface PDFAlert {
    level: 'CRITICA' | 'ATENCION' | 'INFO';
    message: string;
}

export interface PDFReportData {
    title: string;
    period: string;
    generatedAt: number;
    kpis: KPIResults | null;
    kpiTargets: KPITarget[];
    metricsByCountry?: {
        name: string;
        orderCount: number;
        deliveryRate: number;
        cancelRate: number;
        sales: number;
        adSpend: number;
        profit: number;
    }[];
    logisticStats?: {
        entregados: number;
        transito: number;
        cancelados: number;
        devoluciones: number;
    };
    vegaAnalysis?: string;
    executiveSummary?: string;
    alerts?: PDFAlert[];
    reportType?: 'daily' | 'weekly' | 'monthly';
    reportMetadata?: VegaReportMetadata;
}

export const PDF_COLORS = {
    background: '#0a0f1a',
    cardBg: '#141b2d',
    cardBorder: '#1e293b',
    accent: '#d75c33',
    text: '#ffffff',
    textMuted: '#8892a4',
    good: '#10b981',
    warning: '#f59e0b',
    bad: '#ef4444',
    blue: '#3b82f6',
    purple: '#8b5cf6',
} as const;
