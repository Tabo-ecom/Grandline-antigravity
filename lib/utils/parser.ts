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
    // 0. Check filename (Very reliable if using standard exports)
    const fn = fileName.toLowerCase();
    if (fn.includes('guatemala') || fn.includes('_gt') || fn.includes('gt_') || fn.includes('gt.')) return 'GT';
    if (fn.includes('ecuador') || fn.includes('_ec') || fn.includes('ec_') || fn.includes('ec.')) return 'EC';
    if (fn.includes('panama') || fn.includes('_pa') || fn.includes('pa_') || fn.includes('pa.')) return 'PA';
    if (fn.includes('colombia') || fn.includes('_co') || fn.includes('co_') || fn.includes('co.')) return 'CO';
    if (fn.includes('mexico') || fn.includes('méxico') || fn.includes('_mx') || fn.includes('mx_') || fn.includes('mx.')) return 'MX';
    if (fn.includes('peru') || fn.includes('perú') || fn.includes('_pe') || fn.includes('pe_') || fn.includes('pe.')) return 'PE';
    if (fn.includes('chile') || fn.includes('_cl') || fn.includes('cl_') || fn.includes('cl.')) return 'CL';
    if (fn.includes('paraguay') || fn.includes('_py') || fn.includes('py_') || fn.includes('py.')) return 'PY';
    if (fn.includes('argentina') || fn.includes('_ar') || fn.includes('ar_') || fn.includes('ar.')) return 'AR';
    if (fn.includes('españa') || fn.includes('espana') || fn.includes('spain') || fn.includes('_es') || fn.includes('es_') || fn.includes('es.')) return 'ES';
    if (fn.includes('costa rica') || fn.includes('costarica') || fn.includes('_cr') || fn.includes('cr_') || fn.includes('cr.')) return 'CR';

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

                        return {
                            ID: String(row.ID || row['ID Orden'] || row['ID ORDEN'] || row['NÚMERO DE ORDEN'] || row['Numero de orden'] || index),
                            ESTATUS: String(row.ESTATUS || row.Estado || row['ESTADO'] || 'DESCONOCIDO'),
                            "TOTAL DE LA ORDEN": Number(row['TOTAL DE LA ORDEN'] || row.Total || row['Total orden'] || row['TOTAL'] || 0),
                            PRODUCTO: productName,
                            SKU: sku,
                            PRODUCTO_ID: productId,
                            CANTIDAD: Number(row.CANTIDAD || row.Cantidad || row['Cant.'] || 1),
                            CIUDAD: String(row.CIUDAD || row.Ciudad || row['CIUDAD DESTINO'] || row.Municipio || row.Departamento || row['Población'] || ''),
                            "CIUDAD DESTINO": String(row['CIUDAD DESTINO'] || row.CIUDAD || row.Ciudad || row.Municipio || row.Departamento || row['Población'] || ''),
                            FECHA: String(row.FECHA || row.Fecha || row['FECHA DE CREACIÓN'] || ''),
                            "PRECIO FLETE": Number(row['PRECIO FLETE'] || row.Flete || row['Costo envío'] || row['VALOR FLETE'] || 0),
                            "COSTO DEVOLUCION FLETE": Number(row['COSTO DEVOLUCION FLETE'] || row['COSTO DEVOLUCIÓN FLETE'] || row['Costo devolucion flete'] || row['Costo devolución flete'] || 0),
                            "PRECIO PROVEEDOR": Number(row['PRECIO PROVEEDOR'] || row['Precio proveedor'] || 0),
                            "PRECIO PROVEEDOR X CANTIDAD": Number(row['PRECIO PROVEEDOR X CANTIDAD'] || row['Costo producto'] || 0),
                            PAIS: String(row.PAIS || row.Pais || row['PAÍS'] || row['País'] || row['pais'] || row.Country || row['COUNTRY'] || row['PAIS DE ENTREGA'] || row['País de destino'] || row['PAIS DESTINO'] || ''),
                            TRANSPORTADORA: String(row.TRANSPORTADORA || row.Transportadora || row['TRANSPORTADOR'] || row['Transportador'] || row['EMPRESA DE ENVIO'] || row['Empresa de envio'] || row['COURIER'] || ''),
                            GANANCIA: Number(row.GANANCIA || row.Ganancia || row['GANANCIA TOTAL'] || 0),
                            RECAUDO: String(row.RECAUDO || row.Recaudo || row['TIPO DE RECAUDO'] || row['Tipo recaudo'] || row['TIPO RECAUDO'] || row['Tipo de recaudo'] || row['COD'] || ''),
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
