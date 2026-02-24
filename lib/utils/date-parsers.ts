
/**
 * Utility functions for robust date parsing and handling
 * specifically designed for Dropi CSV exports and local timezone management.
 */

// Parse a date string from Dropi (DD/MM/YYYY or YYYY-MM-DD) into a native Date object
// Returns a Date object set to local midnight, or a very old date if invalid
export function parseDropiDate(dateStr: string | Date | undefined): Date {
    if (!dateStr) return new Date(0);
    if (dateStr instanceof Date) return dateStr;

    const str = String(dateStr).trim();

    // 1. Try DD/MM/YYYY (Common in Latam)
    if (str.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
        const parts = str.split(' ')[0].split('/');
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);

        // Basic validation
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            const date = new Date(y, m - 1, d);
            // Check if date obeys what we parsed (handles invalid days like 31st feb)
            if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
                return date;
            }
        }
    }

    // 2. Try MM/DD/YYYY (US format fallback - sometimes Dropi varies)
    // Note: This regex is the same as above, but we swap m/d. 
    // Usually we prioritize DD/MM/YYYY for Latam.
    if (str.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
        const parts = str.split(' ')[0].split('/');
        const m = parseInt(parts[0], 10); // Swap: First part as month
        const d = parseInt(parts[1], 10); // Second part as day
        const y = parseInt(parts[2], 10);

        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            const date = new Date(y, m - 1, d);
            if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
                return date;
            }
        }
    }

    // 2.5 Try DD-MM-YYYY (Latam with dashes)
    if (str.match(/^\d{1,2}-\d{1,2}-\d{4}/)) {
        const parts = str.split(' ')[0].split('-');
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);

        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            const date = new Date(y, m - 1, d);
            if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
                return date;
            }
        }
    }

    // 3. Try YYYY-MM-DD
    if (str.match(/^\d{4}-\d{1,2}-\d{1,2}/)) {
        const parts = str.split('T')[0].split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const date = new Date(y, m - 1, d);
        if (!isNaN(date.getTime())) return date;
    }

    // 4. Excel Serial Date (e.g. 45321)
    if (str.match(/^\d{5}$/) || (str.match(/^\d+$/) && parseInt(str, 10) > 40000)) {
        const serial = parseInt(str, 10);
        // Excel epoch is Dec 30 1899
        const excelEpoch = new Date(1899, 11, 30);
        const millis = serial * 86400 * 1000;
        const date = new Date(excelEpoch.getTime() + millis);
        if (!isNaN(date.getTime())) return date;
    }

    // 5. Fallback to native parse (handles ISO, weird local formats, etc)
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
        return date;
    }

    return new Date(0);
}

// Get a local YYYY-MM-DD string from a Date object
// Used for grouping and keys, ensuring no UTC shift
export function getLocalDateKey(date: Date | string | undefined): string {
    const d = parseDropiDate(date);
    if (d.getTime() === 0) return 'unknown';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Get start date for a relative range
export function getStartDateForRange(range: string): Date {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    if (range === 'Hoy') {
        return start;
    }

    if (range === 'Ayer') {
        start.setDate(start.getDate() - 1);
        return start;
    }

    if (range === 'Este Mes') {
        return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    if (range === 'Mes Pasado') {
        return new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    }

    const daysMap: Record<string, number> = {
        'Últimos 3 Días': 3,
        'Últimos 7 Días': 7,
        'Últimos 30 Días': 30
    };

    const days = daysMap[range] ?? 30; // Default to 30 if unknown
    start.setDate(start.getDate() - days);
    return start;
}

// Get end date for a relative range
export function getEndDateForRange(range: string): Date {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (range === 'Ayer') {
        end.setDate(end.getDate() - 1);
        return end;
    }

    if (range === 'Mes Pasado') {
        return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }

    return end;
}
