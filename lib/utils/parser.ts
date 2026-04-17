import * as XLSX from 'xlsx';
import { DropiOrder } from '../calculations/kpis';

export interface ParseResult {
    orders: DropiOrder[];
    country: string;
    fileName: string;
    timestamp: number;
}

/**
 * Detect country based on city column in Dropi export
 */
export const detectCountry = (orders: DropiOrder[], fileName: string = ''): string => {
    // 0. Check filename — full country names first (very reliable), then isolated 2-letter codes
    const fn = fileName.toLowerCase();
    // Full names (safe, no false positives)
    if (fn.includes('guatemala')) return 'GT';
    if (fn.includes('ecuador')) return 'EC';
    if (fn.includes('panama') || fn.includes('panamá')) return 'PA';
    if (fn.includes('colombia')) return 'CO';
    if (fn.includes('mexico') || fn.includes('méxico')) return 'MX';
    if (fn.includes('peru') || fn.includes('perú')) return 'PE';
    if (fn.includes('chile')) return 'CL';
    if (fn.includes('paraguay')) return 'PY';
    if (fn.includes('argentina')) return 'AR';
    if (fn.includes('españa') || fn.includes('espana') || fn.includes('spain')) return 'ES';
    if (fn.includes('costa rica') || fn.includes('costarica')) return 'CR';
    // 2-letter codes — require word boundary (start/end, underscore, hyphen, space, or dot)
    // so "ordenes.xlsx" does NOT match ES, but "es_ordenes.xlsx" or "ordenes_es.xlsx" does
    const codeMatch = (code: string) => new RegExp(`(?:^|[_\\-\\s.])${code}(?:[_\\-\\s.]|$)`).test(fn);
    if (codeMatch('gt')) return 'GT';
    if (codeMatch('ec')) return 'EC';
    if (codeMatch('pa')) return 'PA';
    if (codeMatch('co')) return 'CO';
    if (codeMatch('mx')) return 'MX';
    if (codeMatch('pe')) return 'PE';
    if (codeMatch('cl')) return 'CL';
    if (codeMatch('py')) return 'PY';
    if (codeMatch('ar')) return 'AR';
    if (codeMatch('es')) return 'ES';
    if (codeMatch('cr')) return 'CR';

    // 1. Check for an explicit "PAIS" property if it was captured
    const countries = orders.map(o => String(o.PAIS || '').toLowerCase().trim()).filter(c => c.length > 0);

    // Use scoring for PAIS field too (most common value wins)
    if (countries.length > 0) {
        const paisMap: Record<string, string> = {};
        const paisPatterns: [RegExp, string][] = [
            [/^(co|colombia|colomb)/i, 'CO'],
            [/^(ec|ecuador|ecuad)/i, 'EC'],
            [/^(gt|guatemala)/i, 'GT'],
            [/^(pa|panama|panam)/i, 'PA'],
            [/^(mx|mexico|mexic|méxic)/i, 'MX'],
            [/^(pe|peru|perú)/i, 'PE'],
            [/^(cl|chile)/i, 'CL'],
            [/^(py|paraguay|paragua)/i, 'PY'],
            [/^(ar|argentina|argentin)/i, 'AR'],
            [/^(es|españa|espana|spain|espa)/i, 'ES'],
            [/^(cr|costa\s?rica)/i, 'CR'],
        ];

        for (const c of countries) {
            for (const [pattern, code] of paisPatterns) {
                if (pattern.test(c)) {
                    paisMap[code] = (paisMap[code] || '') + '1';
                    break;
                }
            }
        }

        const bestPais = Object.entries(paisMap).sort((a, b) => b[1].length - a[1].length)[0];
        if (bestPais) return bestPais[0];
    }

    // 2. Fallback to city detection
    const cities = orders.slice(0, 100).map(o => o.CIUDAD?.toLowerCase() || '');

    // High confidence markers for each country
    const markers: Record<string, string[]> = {
        GT: [
            'guatemala', 'quetzaltenango', 'mixco', 'villa nueva', 'amatitlan',
            'escuintla', 'chinautla', 'petapa', 'chimaltenango', 'villanueva',
            'sacatepequez', 'izabal', 'alta verapaz', 'jalapa', 'jutiapa',
            'huehuetenango', 'quiche', 'antigua', 'solola', 'san marcos',
            'retalhuleu', 'mazatenango', 'zacapa', 'chiquimula', 'baja verapaz',
            'peten', 'santa rosa', 'el progreso', 'totonicapan', 'suchitepequez',
            'villa canales', 'santa catarina pinula', 'san jose pinula', 'fraijanes'
        ],
        EC: [
            'quito', 'guayaquil', 'cuenca', 'ambato', 'manta', 'portoviejo',
            'machala', 'duran', 'loja', 'esmeraldas', 'ibarra', 'santo domingo',
            'quevedo', 'babahoyo', 'latacunga', 'riobamba', 'milagro'
        ],
        PA: [
            'panama', 'colon', 'david', 'arraijan', 'chorrera', 'penonome', 'santiago',
            'chitre', 'aguadulce', 'las tablas', 'bugaba', 'boquete', 'veraguas',
            'chiriqui', 'cocle', 'herrera', 'los santos'
        ],
        CO: [
            'bogota', 'medellin', 'cali', 'barranquilla', 'bucaramanga', 'pereira',
            'envigado', 'itagui', 'bello', 'soledad', 'cucuta', 'ibague',
            'cartagena', 'santa marta', 'villavicencio', 'pasto', 'manizales',
            'monteria', 'neiva', 'arminia', 'valledupar', 'popayan'
        ],
        MX: [
            'ciudad de mexico', 'guadalajara', 'monterrey', 'puebla', 'tijuana',
            'leon', 'cancun', 'merida', 'queretaro', 'chihuahua', 'zapopan',
            'aguascalientes', 'morelia', 'saltillo', 'oaxaca', 'toluca',
            'veracruz', 'villahermosa', 'tuxtla', 'hermosillo', 'culiacan',
            'acapulco', 'mazatlan', 'tampico', 'cdmx'
        ],
        PE: [
            'lima', 'arequipa', 'trujillo', 'chiclayo', 'piura', 'cusco',
            'huancayo', 'iquitos', 'tacna', 'cajamarca', 'puno', 'callao',
            'sullana', 'chimbote', 'ayacucho', 'juliaca', 'huanuco'
        ],
        CL: [
            'santiago', 'valparaiso', 'concepcion', 'antofagasta', 'vina del mar',
            'temuco', 'rancagua', 'talca', 'arica', 'iquique', 'puerto montt',
            'la serena', 'osorno', 'chillan', 'copiapo', 'calama'
        ],
        PY: [
            'asuncion', 'ciudad del este', 'san lorenzo', 'luque', 'capiata',
            'lambare', 'fernando de la mora', 'limpio', 'encarnacion',
            'caaguazu', 'pedro juan caballero', 'coronel oviedo'
        ],
        AR: [
            'buenos aires', 'cordoba', 'rosario', 'mendoza', 'tucuman',
            'la plata', 'mar del plata', 'salta', 'santa fe', 'san juan',
            'resistencia', 'corrientes', 'posadas', 'neuquen', 'formosa',
            'san luis', 'santiago del estero', 'san miguel de tucuman'
        ],
        ES: [
            'madrid', 'barcelona', 'valencia', 'sevilla', 'zaragoza',
            'malaga', 'murcia', 'palma', 'bilbao', 'alicante',
            'valladolid', 'vigo', 'gijon', 'hospitalet', 'vitoria',
            'la coruna', 'granada', 'elche', 'oviedo', 'santander'
        ],
        CR: [
            'san jose', 'alajuela', 'cartago', 'heredia', 'liberia',
            'limon', 'puntarenas', 'san carlos', 'perez zeledon',
            'san ramon', 'grecia', 'nicoya', 'paraiso', 'desamparados'
        ],
    };

    // Use a scoring system instead of first-match to be more robust
    const scores: Record<string, number> = { GT: 0, EC: 0, PA: 0, CO: 0, MX: 0, PE: 0, CL: 0, PY: 0, AR: 0, ES: 0, CR: 0 };
    for (const city of cities) {
        if (!city) continue;
        for (const [code, cityList] of Object.entries(markers)) {
            if (cityList.some(marker => city.includes(marker))) {
                scores[code]++;
            }
        }
    }

    const best = Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a));
    if (best[1] > 0) return best[0];

    return 'CO'; // Default to Colombia if unsure
};

/**
 * Parse Dropi Excel/CSV file content
 */
export const parseDropiFile = async (file: File): Promise<ParseResult> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Convert to JSON
                const rawOrders = XLSX.utils.sheet_to_json(worksheet) as any[];

                // Map and validate (ensure correct headers for types)
                const orders: DropiOrder[] = rawOrders
                    .filter(row => {
                        // Skip if no ID or no Product
                        const id = row.ID || row['ID Orden'] || row['ID ORDEN'] || row['NÚMERO DE ORDEN'] || row['Numero de orden'];
                        const product = row.PRODUCTO || row.Producto || row['Producto/Servicio'] || row['PRODUCTO/SERVICIO'];
                        return id && product;
                    })
                    .map((row, index) => {
                        // Extract product name and clean it
                        const productName = String(row.PRODUCTO || row.Producto || row['Producto/Servicio'] || row['PRODUCTO/SERVICIO'] || 'Desconocido');
                        const sku = row.SKU || row.sku || row['Referencia'] || '';
                        const productId = row['PRODUCTO ID'] || row['producto_id'] || row['Producto ID'] || '';

                        // Helper to get string/number from multiple possible column names
                        const str = (...keys: string[]) => { for (const k of keys) { const v = row[k]; if (v !== undefined && v !== null && v !== '') return String(v); } return ''; };
                        const num = (...keys: string[]) => { for (const k of keys) { const v = Number(row[k]); if (v && isFinite(v)) return v; } return 0; };

                        return {
                            // Core identifiers
                            ID: str('ID', 'ID Orden', 'ID ORDEN', 'NÚMERO DE ORDEN', 'Numero de orden') || String(index),
                            ESTATUS: str('ESTATUS', 'Estado', 'ESTADO') || 'DESCONOCIDO',
                            PRODUCTO: productName,
                            SKU: sku,
                            PRODUCTO_ID: productId,
                            CANTIDAD: num('CANTIDAD', 'Cantidad', 'Cant.') || 1,
                            VARIANTE: str('VARIACION', 'VARIACIÓN', 'Variacion', 'Variación', 'VARIANTE', 'Variante'),

                            // Financials (from Dropi report columns)
                            "TOTAL DE LA ORDEN": num('TOTAL DE LA ORDEN', 'Total', 'Total orden', 'TOTAL', 'VALOR TOTAL'),
                            "PRECIO FLETE": num('PRECIO FLETE', 'Flete', 'Costo envío', 'VALOR FLETE', 'COSTO FLETE'),
                            "COSTO DEVOLUCION FLETE": num('COSTO DEVOLUCION FLETE', 'COSTO DEVOLUCIÓN FLETE', 'Costo devolucion flete', 'Costo devolución flete'),
                            "PRECIO PROVEEDOR": num('PRECIO PROVEEDOR', 'Precio proveedor', 'COSTO PROVEEDOR'),
                            "PRECIO PROVEEDOR X CANTIDAD": num('PRECIO PROVEEDOR X CANTIDAD', 'Costo producto', 'COSTO PRODUCTO'),
                            GANANCIA: num('GANANCIA', 'Ganancia', 'GANANCIA TOTAL', 'UTILIDAD'),
                            COMISION: num('COMISION', 'COMISIÓN', 'Comision', 'Comisión', 'COMISION DROPI'),
                            COMISION_PASARELA: num('% COMISION DE LA PLATAFORMMA', 'COMISION PASARELA', 'COMISIÓN PASARELA'),

                            // Location
                            CIUDAD: str('CIUDAD', 'Ciudad', 'CIUDAD DESTINO', 'Municipio', 'Población'),
                            "CIUDAD DESTINO": str('CIUDAD DESTINO', 'CIUDAD', 'Ciudad', 'Municipio', 'Población'),
                            DEPARTAMENTO: str('DEPARTAMENTO DESTINO', 'DEPARTAMENTO', 'Departamento', 'Provincia', 'PROVINCIA'),
                            PAIS: str('PAIS', 'Pais', 'PAÍS', 'País', 'pais', 'Country', 'COUNTRY', 'PAIS DE ENTREGA', 'País de destino', 'PAIS DESTINO'),
                            DIRECCION: str('DIRECCION', 'DIRECCIÓN', 'Direccion', 'Dirección'),

                            // Client info
                            NOMBRE_CLIENTE: str('NOMBRE CLIENTE', 'Nombre cliente', 'NOMBRE', 'Nombre', 'CLIENTE'),
                            TELEFONO_CLIENTE: str('TELÉFONO', 'TELEFONO', 'Telefono', 'Teléfono', 'CELULAR', 'Celular'),

                            // Dates
                            FECHA: str('FECHA', 'Fecha', 'FECHA DE CREACIÓN', 'FECHA DE CREACION'),
                            FECHA_ENTREGA: str('FECHA ENTREGA', 'FECHA DE ENTREGA', 'Fecha entrega'),
                            FECHA_DESPACHO: str('FECHA GUIA GENERADA', 'FECHA DESPACHO', 'FECHA DE DESPACHO'),
                            FECHA_DEVOLUCION: str('FECHA DEVOLUCION', 'FECHA DEVOLUCIÓN', 'FECHA DE DEVOLUCION', 'FECHA DE DEVOLUCIÓN'),

                            // Logistics
                            TRANSPORTADORA: str('TRANSPORTADORA', 'Transportadora', 'TRANSPORTADOR', 'Transportador', 'EMPRESA DE ENVIO', 'COURIER'),
                            GUIA: str('NÚMERO GUIA', 'NUMERO GUIA', 'NÚMERO GUÍA', 'Numero guia', 'GUIA', 'GUÍA'),
                            NUMERO_GUIA: str('NÚMERO GUIA', 'NUMERO GUIA', 'NÚMERO GUÍA'),
                            RECAUDO: str('TIPO DE ENVIO', 'RECAUDO', 'Recaudo', 'TIPO DE RECAUDO', 'TIPO RECAUDO', 'COD'),
                            OBSERVACIONES: str('NOTAS', 'OBSERVACIÓN', 'Observaciones', 'OBSERVACIONES', 'Notas', 'COMENTARIOS'),

                            // Novelty tracking
                            SUBESTATUS: str('NOVEDAD', 'SUBESTATUS', 'SUB ESTATUS'),

                            // Classification & Tags
                            TAGS: str('TAGS', 'Tags', 'tags', 'ETIQUETAS', 'Etiquetas', 'MOTIVO CANCELACIÓN', 'Motivo cancelación', 'MOTIVO CANCELACION'),

                            // Sales channel info
                            TIENDA: str('TIENDA', 'Tienda', 'NOMBRE TIENDA'),
                            VENDEDOR: str('VENDEDOR', 'Vendedor', 'ASESOR'),
                            BODEGA: str('BODEGA', 'Bodega', 'ALMACEN'),

                            // Store complete raw row for future features
                            _raw: { ...row },
                        };
                    });

                const country = detectCountry(orders, file.name);

                resolve({
                    orders,
                    country,
                    fileName: file.name,
                    timestamp: Date.now()
                });
            } catch (err) {
                reject(new Error('Error al parsear el archivo Excel. Asegúrate de que es un reporte de Dropi.'));
            }
        };

        reader.onerror = () => reject(new Error('Error al leer el archivo.'));
        reader.readAsArrayBuffer(file);
    });
};
