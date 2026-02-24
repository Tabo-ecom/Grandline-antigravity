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

    // 1. Check for an explicit "PAIS" property if it was captured
    const countries = orders.map(o => String(o.PAIS || '').toLowerCase().trim());
    if (countries.some(c => c === 'guatemala' || c === 'gt' || c.includes('guatemal'))) return 'GT';
    if (countries.some(c => c === 'ecuador' || c === 'ec' || c.includes('ecuad'))) return 'EC';
    if (countries.some(c => c === 'panama' || c === 'pa' || c.includes('panam'))) return 'PA';
    if (countries.some(c => c === 'colombia' || c === 'co' || c.includes('colomb'))) return 'CO';

    // 2. Fallback to city detection
    const cities = orders.slice(0, 100).map(o => o.CIUDAD?.toLowerCase() || '');

    // High confidence markers for each country
    const markers = {
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
    };

    // Use a scoring system instead of first-match to be more robust
    const scores: Record<string, number> = { GT: 0, EC: 0, PA: 0, CO: 0 };
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
                            "PRECIO FLETE": Number(row['PRECIO FLETE'] || row.Flete || row['Costo envío'] || 0),
                            "PRECIO PROVEEDOR X CANTIDAD": Number(row['PRECIO PROVEEDOR X CANTIDAD'] || row['Costo producto'] || 0),
                            PAIS: String(row.PAIS || row.Pais || row['PAÍS'] || row.Country || ''),
                            TRANSPORTADORA: String(row.TRANSPORTADORA || row.Transportadora || row['TRANSPORTADOR'] || row['Transportador'] || row['EMPRESA DE ENVIO'] || row['Empresa de envio'] || row['COURIER'] || ''),
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
