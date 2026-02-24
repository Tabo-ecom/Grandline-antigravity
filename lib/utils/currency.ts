// Exchange rates interface
export interface ExchangeRates {
    COP_USD: number;
    COP_GTQ: number;
    timestamp: number;
}

// Currency conversion functions
export function toCOP(
    value: number,
    sourceCurrency: string,
    rates: ExchangeRates
): number {
    if (sourceCurrency === "COP") return value;
    if (sourceCurrency === "USD") return value * rates.COP_USD;
    if (sourceCurrency === "GTQ") return value * rates.COP_GTQ;
    return value;
}

export function fromCOP(
    value: number,
    targetCurrency: string,
    rates: ExchangeRates
): number {
    if (targetCurrency === "COP") return value;
    if (targetCurrency === "USD") return value / rates.COP_USD;
    if (targetCurrency === "GTQ") return value / rates.COP_GTQ;
    return value;
}

// Cache key and TTL for exchange rates (6 hours)
const RATES_CACHE_KEY = 'grand_line_exchange_rates';
const RATES_CACHE_TTL = 6 * 60 * 60 * 1000;

// In-memory singleton to avoid multiple simultaneous API calls
let ratesPromise: Promise<ExchangeRates> | null = null;

// Fetch exchange rates with localStorage cache (6h TTL)
export async function fetchExchangeRates(): Promise<ExchangeRates> {
    // Check localStorage cache first
    if (typeof window !== 'undefined') {
        try {
            const cached = localStorage.getItem(RATES_CACHE_KEY);
            if (cached) {
                const parsed: ExchangeRates = JSON.parse(cached);
                if (Date.now() - parsed.timestamp < RATES_CACHE_TTL) {
                    return parsed;
                }
            }
        } catch { /* ignore parse errors */ }
    }

    // Deduplicate concurrent requests
    if (ratesPromise) return ratesPromise;

    ratesPromise = (async () => {
        try {
            const response = await fetch('https://open.er-api.com/v6/latest/USD');
            const data = await response.json();

            const rates: ExchangeRates = {
                COP_USD: data.rates.COP || 4200,
                COP_GTQ: data.rates.COP / data.rates.GTQ || 540,
                timestamp: Date.now(),
            };

            // Persist to localStorage
            if (typeof window !== 'undefined') {
                try { localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(rates)); } catch { /* quota */ }
            }

            return rates;
        } catch (error) {
            console.error('Error fetching exchange rates:', error);
            return { COP_USD: 4200, COP_GTQ: 540, timestamp: Date.now() };
        } finally {
            ratesPromise = null;
        }
    })();

    return ratesPromise;
}

// Format currency with optional decimals
export function formatCurrency(
    value: number,
    currency: string = 'COP',
    decimals: number = 0
): string {
    const absValue = Math.round(Math.abs(value));
    const formatted = absValue.toLocaleString('es-CO', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });

    const sign = value < 0 ? '-' : '';

    switch (currency) {
        case 'COP':
            return `${sign}$${formatted}`;
        case 'USD':
            return `${sign}$${formatted}`;
        case 'GTQ':
            return `${sign}Q${formatted}`;
        default:
            return `${sign}${formatted}`;
    }
}

// Dual currency display (Primary in target, sub with secondary)
export function formatDualCurrency(
    valueInCOP: number,
    originalCurrency: string,
    rates: ExchangeRates | null
): { primary: string; secondary: string } {
    const primary = formatCurrency(valueInCOP, 'COP');

    if (!rates || originalCurrency === 'COP') {
        return { primary, secondary: '' };
    }

    const originalValue = fromCOP(valueInCOP, originalCurrency, rates);
    const secondary = formatCurrency(originalValue, originalCurrency);

    return { primary, secondary };
}

// Mappings for robust country identification
export const COUNTRY_MAP: Record<string, { code: string; name: string; currency: string }> = {
    'colombia': { code: 'CO', name: 'Colombia', currency: 'COP' },
    'ecuador': { code: 'EC', name: 'Ecuador', currency: 'USD' },
    'guatemala': { code: 'GT', name: 'Guatemala', currency: 'GTQ' },
    'panama': { code: 'PA', name: 'Panamá', currency: 'USD' },
};

// Normalize string for comparison (removes accents and lowercase)
export function normalizeCountry(str: string): string {
    if (!str) return '';
    return str.toLowerCase().trim()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Get official display name for a slugified/coded country
export function getOfficialCountryName(country: string): string {
    const normalized = normalizeCountry(country);
    if (COUNTRY_MAP[normalized]) return COUNTRY_MAP[normalized].name;

    // Check by code
    const byCode = Object.values(COUNTRY_MAP).find(c => c.code.toLowerCase() === normalized);
    if (byCode) return byCode.name;

    return country.charAt(0).toUpperCase() + country.slice(1);
}

// Get currency for country
export function getCurrencyForCountry(country: string): string {
    const normalized = normalizeCountry(country);

    // Check direct keys (colombia, ecuador...)
    if (COUNTRY_MAP[normalized]) return COUNTRY_MAP[normalized].currency;

    // Check by code
    const byCode = Object.values(COUNTRY_MAP).find(c => c.code.toLowerCase() === normalized);
    if (byCode) return byCode.currency;

    return 'COP';
}

/**
 * Robust check if a file country matches the search target
 */
export function isMatchingCountry(fileCountry: string, searchTarget: string): boolean {
    const normFile = normalizeCountry(fileCountry);
    const normSearch = normalizeCountry(searchTarget);

    if (normFile === normSearch) return true;

    // mappings
    const mappingFile = COUNTRY_MAP[normFile] || Object.values(COUNTRY_MAP).find(c => c.code.toLowerCase() === normFile);
    const mappingSearch = COUNTRY_MAP[normSearch] || Object.values(COUNTRY_MAP).find(c => c.code.toLowerCase() === normSearch);

    const codeFile = mappingFile?.code.toLowerCase() || normFile;
    const codeSearch = mappingSearch?.code.toLowerCase() || normSearch;

    return codeFile === codeSearch;
}
