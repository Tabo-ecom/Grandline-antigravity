/**
 * CSV/Excel parsing utilities for ad spend imports.
 */

/** Keywords to identify the real header row in a CSV/Excel file */
const HEADER_KEYWORDS = [
    'campaign', 'campaña', 'cost', 'coste', 'costo', 'gasto',
    'spend', 'date', 'fecha', 'día', 'day', 'nombre'
];

/**
 * Detect the header row index in raw sheet data.
 * Returns the row index where at least 2 header keywords match.
 */
export function detectHeaderRow(rawRows: any[][]): number {
    for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!Array.isArray(row)) continue;
        const rowText = row.map(cell => String(cell ?? '').toLowerCase()).join(' ');
        const matchCount = HEADER_KEYWORDS.filter(kw => rowText.includes(kw)).length;
        if (matchCount >= 2) return i;
    }
    return 0; // fallback to first row
}

/**
 * Find column index by trying multiple name variants (exact match first, then case-insensitive).
 */
export function findColumnIndex(headers: string[], variants: readonly string[]): number {
    for (const v of variants) {
        const exact = headers.indexOf(v);
        if (exact !== -1) return exact;
    }
    for (const v of variants) {
        const idx = headers.findIndex(h => h.toLowerCase() === v.toLowerCase());
        if (idx !== -1) return idx;
    }
    return -1;
}

/**
 * Parse a number from various formats (1,234.56 / 1.234,56 / plain).
 */
export function parseNumber(val: any): number {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const str = String(val).trim().replace(/[^\d.,-]/g, '');
    // European format: 1.234,56
    if (/^[-]?[\d.]+,[\d]+$/.test(str)) return parseFloat(str.replace(/\./g, '').replace(',', '.'));
    // US format: 1,234.56
    if (/^[-]?[\d,]+\.[\d]+$/.test(str)) return parseFloat(str.replace(/,/g, ''));
    return parseFloat(str.replace(/,/g, '')) || 0;
}

/**
 * Parse a date string from various formats into YYYY-MM-DD.
 * Returns null if the date cannot be parsed.
 */
export function parseDate(dateStr: any): string | null {
    const raw = String(dateStr).trim();

    // ISO format: 2024-01-15
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        return raw.slice(0, 10);
    }

    // Slash-separated format: DD/MM/YYYY or MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(raw)) {
        const parts = raw.split('/');
        const a = parseInt(parts[0], 10);
        const b = parseInt(parts[1], 10);
        // If first part > 12, it must be the day (DD/MM/YYYY)
        // If second part > 12, it must be the day (MM/DD/YYYY)
        // Otherwise default to MM/DD/YYYY (TikTok/US format)
        if (a > 12) {
            // DD/MM/YYYY
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else if (b > 12) {
            // MM/DD/YYYY
            return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        } else {
            // Ambiguous (both <= 12) — default MM/DD/YYYY (US/TikTok standard)
            return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
    }

    // Excel serial date number
    if (typeof dateStr === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const d = new Date(excelEpoch.getTime() + dateStr * 86400000);
        return d.toISOString().split('T')[0];
    }

    // Fallback: try native Date parsing
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }

    return null;
}

/**
 * Try to detect country from a campaign name string.
 */
export function detectCountryFromCampaign(campaignName: string): string | null {
    const upper = campaignName.toUpperCase();
    if (upper.includes('COLOMBIA') || upper.includes('CO-')) return 'Colombia';
    if (upper.includes('ECUADOR') || upper.includes('EC-')) return 'Ecuador';
    if (upper.includes('GUATEMALA') || upper.includes('GT-')) return 'Guatemala';
    if (upper.includes('PANAMA') || upper.includes('PA-')) return 'Panama';
    return null;
}

/** Standard column name variants for ad spend CSVs */
export const COLUMN_VARIANTS = {
    campaign: ['Campaign name', 'Campaña', 'Nombre de la campaña', 'campaign_name', 'Nombre campaña'],
    spend: ['Cost', 'Gasto', 'Spend', 'Coste', 'Costo', 'Importe gastado'],
    date: ['Date', 'Fecha', 'Day', 'By Day', 'Reporting date', 'Fecha de inicio'],
    currency: ['Currency', 'Divisa', 'Moneda'],
    impressions: ['Impressions', 'Impression', 'Impresiones', 'Impr.', 'impressions', 'impression'],
    clicks: ['Clicks', 'Click', 'Clics', 'clicks', 'click'],
    ctr: ['CTR', 'CTR(%)', 'CTR (%)', 'Click-Through Rate', 'ctr', 'Click-through rate'],
    cpc: ['CPC', 'CPC (Cost per Click)', 'CPC(USD)', 'CPC (USD)', 'Costo por clic', 'cpc', 'Average cost per click'],
    conversions: ['Conversions', 'Conversion', 'Conversiones', 'Total conversion', 'conversions', 'conversion', 'Result', 'Resultado', 'Results', 'Resultados', 'Complete payment'],
    reach: ['Reach', 'Alcance', 'reach'],
    revenue: ['Total purchase amount', 'Revenue', 'Ingresos', 'total_purchase_amount', 'Total complete payment ROAS', 'Total complete payment', 'Purchase amount'],
} as const;
