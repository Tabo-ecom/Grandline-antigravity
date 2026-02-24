// Order status definitions
export const STATUS_ENTREGADO = ["ENTREGADO"];
export const STATUS_CANCELADO = ["CANCELADO", "RECHAZADO"];
export const STATUS_DEVOLUCION = [
    "DEVOLUCION",
    "DEVOLUCIÓN",
    "EN DEVOLUCION",
    "EN DEVOLUCIÓN",
];
export const STATUS_NOVEDAD = ["NOVEDAD", "CON NOVEDAD"];
export const ALL_COUNTRIES_MASTER = ["Colombia", "Ecuador", "Panamá", "Guatemala"];

// Status classification functions
export function matchesStatus(status: string, statusList: string[]): boolean {
    const normalized = status.toUpperCase().trim();
    return statusList.some(s => normalized.includes(s));
}

export function isEntregado(status: string): boolean {
    return matchesStatus(status, STATUS_ENTREGADO);
}

export function isCancelado(status: string): boolean {
    return matchesStatus(status, STATUS_CANCELADO);
}

export function isDevolucion(status: string): boolean {
    return matchesStatus(status, STATUS_DEVOLUCION);
}

export function isNovedad(status: string): boolean {
    return matchesStatus(status, STATUS_NOVEDAD);
}

export function isTransit(status: string): boolean {
    return (
        !isEntregado(status) &&
        !isCancelado(status) &&
        !isDevolucion(status)
    );
}

// Country detection
export const COLOMBIA_CITIES = new Set([
    "BOGOTA", "BOGOTÁ", "MEDELLIN", "MEDELLÍN", "CALI", "BARRANQUILLA",
    "CARTAGENA", "BUCARAMANGA", "PEREIRA", "CUCUTA", "CÚCUTA", "MANIZALES",
    "IBAGUE", "IBAGUÉ", "PASTO", "SANTA MARTA", "VILLAVICENCIO", "NEIVA",
    "MONTERIA", "MONTERÍA", "VALLEDUPAR", "SINCELEJO", "POPAYAN", "POPAYÁN",
    "TUNJA", "ARMENIA", "RIOHACHA", "QUIBDO", "QUIBDÓ", "FLORENCIA",
]);

export const ECUADOR_CITIES = new Set([
    "QUITO", "GUAYAQUIL", "CUENCA", "AMBATO", "PORTOVIEJO",
    "MACHALA", "DURÁN", "DURAN", "LOJA", "MANTA", "SANTO DOMINGO",
    "RIOBAMBA", "ESMERALDAS", "IBARRA", "LATACUNGA", "MILAGRO",
]);

export const GUATEMALA_CITIES = new Set([
    "GUATEMALA", "MIXCO", "VILLA NUEVA", "QUETZALTENANGO",
    "ESCUINTLA", "CHINAUTLA", "HUEHUETENANGO", "COBAN", "COBÁN",
    "ANTIGUA", "CHIMALTENANGO", "MAZATENANGO", "RETALHULEU",
    "AMATITLAN", "PETAPA", "SANTA CATARINA PINULA", "VILLANUEVA",
    "JUTIAPA", "JALAPA", "CHIQUIMULA", "ZACAPA", "MAZATENANGO"
]);

export function detectCountry(cities: string[]): string | null {
    const normalizedCities = new Set(
        cities.map(c => c?.toUpperCase().trim()).filter(Boolean)
    );

    const scores = {
        Colombia: intersection(normalizedCities, COLOMBIA_CITIES).size,
        Ecuador: intersection(normalizedCities, ECUADOR_CITIES).size,
        Guatemala: intersection(normalizedCities, GUATEMALA_CITIES).size,
    };

    const entries = Object.entries(scores);
    const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a));

    return best[1] > 0 ? best[0] : null;
}

function intersection<T>(setA: Set<T>, setB: Set<T>): Set<T> {
    return new Set([...setA].filter(x => setB.has(x)));
}

// Product name normalization
export function extractBaseName(productName: string): string {
    const normalized = productName.trim().toUpperCase();
    const words = normalized.split(/\s+/);

    // Filter out numbers and common words
    const filtered = words.filter(
        word =>
            !/^\d+$/.test(word) &&
            !["X", "DE", "EL", "LA", "EN", "CON", "PARA", "POR"].includes(word)
    );

    // Take first 2 significant words
    return filtered.slice(0, 2).join(" ");
}
