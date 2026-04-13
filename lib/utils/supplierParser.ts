import * as XLSX from 'xlsx';
import { detectCountry } from './parser';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SupplierOrder {
    ID: string;
    FECHA: string;
    HORA: string;
    ESTATUS: string;
    PRODUCTO: string;
    PRODUCTO_ID: string;
    SKU: string;
    VARIACION_ID: string;
    VARIACION: string;
    CANTIDAD: number;
    PRECIO_PROVEEDOR: number;
    PRECIO_PROVEEDOR_X_CANTIDAD: number;
    TOTAL_ORDEN: number;
    GANANCIA: number;
    PRECIO_FLETE: number;
    COSTO_DEVOLUCION_FLETE: number;
    TIENDA: string;
    TRANSPORTADORA: string;
    NUMERO_GUIA: string;
    TIPO_ENVIO: string;
    CIUDAD_DESTINO: string;
    DEPARTAMENTO_DESTINO: string;
    FECHA_ULTIMO_MOVIMIENTO: string;
    ULTIMO_MOVIMIENTO: string;
    PAIS?: string;
}

export interface SupplierParseResult {
    orders: SupplierOrder[];
    country: string;
    fileName: string;
    timestamp: number;
}

// ── Parser ──────────────────────────────────────────────────────────────────

export const parseSupplierFile = async (file: File): Promise<SupplierParseResult> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawOrders = XLSX.utils.sheet_to_json(worksheet) as any[];

                const orders: SupplierOrder[] = rawOrders
                    .filter(row => {
                        const id = row.ID || row['ID Orden'] || row['ID ORDEN'];
                        const product = row.PRODUCTO || row.Producto;
                        return id && product;
                    })
                    .map((row) => ({
                        ID: String(row.ID || row['ID Orden'] || row['ID ORDEN'] || ''),
                        FECHA: String(row.FECHA || row.Fecha || ''),
                        HORA: String(row.HORA || row.Hora || ''),
                        ESTATUS: String(row.ESTATUS || row.Estado || row['ESTADO'] || 'DESCONOCIDO'),
                        PRODUCTO: String(row.PRODUCTO || row.Producto || 'Desconocido'),
                        PRODUCTO_ID: String(row['PRODUCTO ID'] || row['producto_id'] || row['Producto ID'] || ''),
                        SKU: String(row.SKU || row.sku || ''),
                        VARIACION_ID: String(row['VARIACION ID'] || row['Variacion ID'] || row['variacion_id'] || ''),
                        VARIACION: String(row.VARIACION || row.Variacion || row['Variación'] || ''),
                        CANTIDAD: Number(row.CANTIDAD || row.Cantidad || 1),
                        PRECIO_PROVEEDOR: Number(row['PRECIO PROVEEDOR'] || row['Precio proveedor'] || 0),
                        PRECIO_PROVEEDOR_X_CANTIDAD: Number(row['PRECIO PROVEEDOR X CANTIDAD'] || row['Precio proveedor x cantidad'] || 0),
                        TOTAL_ORDEN: Number(row['TOTAL DE LA ORDEN'] || row.Total || 0),
                        GANANCIA: Number(row.GANANCIA || row.Ganancia || 0),
                        PRECIO_FLETE: Number(row['PRECIO FLETE'] || row.Flete || 0),
                        COSTO_DEVOLUCION_FLETE: Number(row['COSTO DEVOLUCION FLETE'] || row['COSTO DEVOLUCIÓN FLETE'] || 0),
                        TIENDA: String(row.TIENDA || row.Tienda || ''),
                        TRANSPORTADORA: String(row.TRANSPORTADORA || row.Transportadora || ''),
                        NUMERO_GUIA: String(row['NUMERO GUIA'] || row['Numero guia'] || row['NÚMERO GUÍA'] || ''),
                        TIPO_ENVIO: String(row['TIPO DE ENVIO'] || row['Tipo de envio'] || ''),
                        CIUDAD_DESTINO: String(row['CIUDAD DESTINO'] || row['Ciudad destino'] || ''),
                        DEPARTAMENTO_DESTINO: String(row['DEPARTAMENTO DESTINO'] || row['Departamento destino'] || ''),
                        FECHA_ULTIMO_MOVIMIENTO: String(row['FECHA DE ULTIMO MOVIMIENTO'] || ''),
                        ULTIMO_MOVIMIENTO: String(row['ULTIMO MOVIMIENTO'] || ''),
                        PAIS: String(row.PAIS || row['PAÍS'] || ''),
                    }));

                // Reuse detectCountry from parser.ts (needs DropiOrder-like shape)
                const ordersForDetection = orders.map(o => ({
                    CIUDAD: o.CIUDAD_DESTINO,
                    PAIS: o.PAIS,
                } as any));
                const country = detectCountry(ordersForDetection, file.name);

                resolve({
                    orders,
                    country,
                    fileName: file.name,
                    timestamp: Date.now(),
                });
            } catch (err) {
                reject(new Error('Error al parsear el archivo de proveedor. Asegúrate de que es un reporte de Dropi Proveedor.'));
            }
        };

        reader.onerror = () => reject(new Error('Error al leer el archivo.'));
        reader.readAsArrayBuffer(file);
    });
};

// ── Inventory File Parser ───────────────────────────────────────────────────

export interface ParsedInventoryProduct {
    productoId: string;
    nombre: string;
    variacionId: string;
    sku: string;
    stock: number;
    precio: number;          // PRECIO (costo proveedor)
    precioSugerido: number;  // PRECIO SUGERIDO
}

export const parseInventoryFile = async (file: File): Promise<ParsedInventoryProduct[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });

                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];

                if (!rawRows.length) { resolve([]); return; }

                // Detect format: "products export" has TIPO DE PRODUCTO column
                const isProductsExport = 'TIPO DE PRODUCTO' in rawRows[0];

                let products: ParsedInventoryProduct[];

                if (isProductsExport) {
                    // Format: Dropi products export (products_*.xlsx)
                    // SIMPLE → one entry. VARIABLE → skip parent, use VARIACION rows.
                    // VARIACION rows have empty ID — inherit from the last VARIABLE/SIMPLE parent.
                    products = [];
                    let currentParentId = '';

                    for (const row of rawRows) {
                        const tipo = String(row['TIPO DE PRODUCTO'] || '').toUpperCase();
                        const rowId = String(row['ID'] || '').replace(/\.0$/, '');
                        const nombre = String(row['NOMBRE'] || '');
                        const precio = Number(row['PRECIO'] || 0) || 0;

                        if (tipo === 'SIMPLE') {
                            currentParentId = rowId;
                            products.push({
                                productoId: rowId,
                                nombre,
                                variacionId: '',
                                sku: String(row['SKU'] || ''),
                                stock: Number(row['STOCK'] || 0) || 0,
                                precio,
                                precioSugerido: Number(row['PRECIO SUGERIDO'] || 0) || 0,
                            });
                        } else if (tipo === 'VARIABLE') {
                            // Parent of variations — save ID, don't create entry
                            currentParentId = rowId;
                        } else if (tipo === 'VARIACION') {
                            // Variation row — ID is empty, inherit from parent
                            const varId = String(row['VARIATION ID'] || '').replace(/\.0$/, '');
                            const varStock = Number(row['VARIATION STOCK'] ?? row['STOCK'] ?? 0) || 0;
                            products.push({
                                productoId: currentParentId,
                                nombre,
                                variacionId: varId,
                                sku: String(row['VARIATION SKU'] || ''),
                                stock: varStock,
                                precio,
                                precioSugerido: Number(row['PRECIO SUGERIDO'] || 0) || 0,
                            });
                        }
                    }
                } else {
                    // Format: Dropi variations export (variaciones-*.xlsx)
                    // Columns: ID PRODUCTO, NOMBRE PRODUCTO, ID VARIACION, SKU, STOCK, PRECIO, PRECIO SUGERIDO
                    products = rawRows
                        .filter(row => row['ID PRODUCTO'] || row['Id producto'] || row['id producto'])
                        .map(row => ({
                            productoId: String(row['ID PRODUCTO'] || row['Id producto'] || '').replace(/\.0$/, ''),
                            nombre: String(row['NOMBRE PRODUCTO'] || row['Nombre producto'] || ''),
                            variacionId: String(row['ID VARIACION'] || row['Id variacion'] || row['ID VARIACIÓN'] || '').replace(/\.0$/, ''),
                            sku: String(row['SKU'] || row['Sku'] || ''),
                            stock: Number(row['STOCK'] || row['Stock'] || 0) || 0,
                            precio: Number(row['PRECIO'] || row['Precio'] || 0) || 0,
                            precioSugerido: Number(row['PRECIO SUGERIDO'] || row['Precio sugerido'] || 0) || 0,
                        }));
                }

                resolve(products);
            } catch (err) {
                reject(new Error('Error al parsear el archivo de inventario/variaciones.'));
            }
        };

        reader.onerror = () => reject(new Error('Error al leer el archivo.'));
        reader.readAsArrayBuffer(file);
    });
};

// ── Returns File Parser ─────────────────────────────────────────────────────

export interface RawReturn {
    fechaRecibido: string;
    idDropi: string;
    producto: string;
    transportadora: string;
    guiaInicial: string;
    telefono: string;
}

export const parseReturnsFile = async (file: File): Promise<RawReturn[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });

                // Look for MARZO sheet or use first sheet
                const sheetName = workbook.SheetNames.find(n => n.toUpperCase().includes('MARZO')) || workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];

                const returns: RawReturn[] = rawRows
                    .filter(row => {
                        // Must have at least a date or guide number
                        const fecha = row['FECHA RECIBIDO'] || row['Fecha recibido'] || '';
                        const guia = row['GUIA INICIAL'] || row['Guia inicial'] || '';
                        return fecha || guia;
                    })
                    .map(row => {
                        let fecha = row['FECHA RECIBIDO'] || row['Fecha recibido'] || '';
                        // Handle Excel date serial numbers
                        if (typeof fecha === 'number') {
                            const d = XLSX.SSF.parse_date_code(fecha);
                            fecha = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
                        } else if (fecha instanceof Date) {
                            fecha = fecha.toISOString().split('T')[0];
                        } else {
                            fecha = String(fecha);
                        }

                        return {
                            fechaRecibido: fecha,
                            idDropi: String(row['ID DROPI'] || row['Id dropi'] || row['id dropi'] || '').replace(/\.0$/, ''),
                            producto: String(row.PRODUCTO || row.Producto || ''),
                            transportadora: String(row.TRANSPORTADORA || row.Transportadora || ''),
                            guiaInicial: String(row['GUIA INICIAL'] || row['Guia inicial'] || row['NUMERO DE GUIA'] || '').replace(/\.0$/, ''),
                            telefono: String(row['NUMERO DE TELEFONO'] || row['Numero de telefono'] || row.TELEFONO || '').replace(/\.0$/, ''),
                        };
                    });

                resolve(returns);
            } catch (err) {
                reject(new Error('Error al parsear el archivo de devoluciones.'));
            }
        };

        reader.onerror = () => reject(new Error('Error al leer el archivo.'));
        reader.readAsArrayBuffer(file);
    });
};

// ── Tickets Sheet Parser ────────────────────────────────────────────────────

export interface RawTicket {
    fechaTicket: string;
    ticketNumber: string;
    numeroGuia: string;
    transportadora: string;
    fechaSeguimiento: string;
    resuelto: boolean;
    solucion: string;
}

export const parseTicketsSheet = async (file: File): Promise<RawTicket[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });

                const sheetName = workbook.SheetNames.find(n =>
                    n.toUpperCase().includes('SEGUIMIENTO') || n.toUpperCase().includes('TICKET')
                );
                if (!sheetName) {
                    resolve([]);
                    return;
                }

                const worksheet = workbook.Sheets[sheetName];
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];

                const tickets: RawTicket[] = rawRows
                    .filter(row => {
                        const ticket = row.TICKET || row.Ticket || row['TICKET'] || '';
                        const guia = row['NUMERO DE GUIA'] || row['Numero de guia'] || '';
                        return ticket || guia;
                    })
                    .map(row => {
                        let fechaTicket = row['FECHA TICKET'] || row['Fecha ticket'] || '';
                        if (typeof fechaTicket === 'number') {
                            const d = XLSX.SSF.parse_date_code(fechaTicket);
                            fechaTicket = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
                        } else if (fechaTicket instanceof Date) {
                            fechaTicket = fechaTicket.toISOString().split('T')[0];
                        }

                        let fechaSeg = row['FECHA SEGUIMIENTO'] || row['Fecha seguimiento'] || '';
                        if (typeof fechaSeg === 'number') {
                            const d = XLSX.SSF.parse_date_code(fechaSeg);
                            fechaSeg = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
                        } else if (fechaSeg instanceof Date) {
                            fechaSeg = fechaSeg.toISOString().split('T')[0];
                        }

                        const resueltoRaw = String(row.RESUELTO || row.Resuelto || '').toUpperCase().trim();

                        return {
                            fechaTicket: String(fechaTicket),
                            ticketNumber: String(row.TICKET || row.Ticket || ''),
                            numeroGuia: String(row['NUMERO DE GUIA'] || row['Numero de guia'] || '').replace(/\.0$/, ''),
                            transportadora: String(row.TRANSPORTADORA || row.Transportadora || ''),
                            fechaSeguimiento: String(fechaSeg),
                            resuelto: resueltoRaw === 'SI' || resueltoRaw === 'SÍ',
                            solucion: String(row['SOLUCION Y RAZON'] || row['Solucion y razon'] || ''),
                        };
                    });

                resolve(tickets);
            } catch (err) {
                reject(new Error('Error al parsear la hoja de tickets.'));
            }
        };

        reader.onerror = () => reject(new Error('Error al leer el archivo.'));
        reader.readAsArrayBuffer(file);
    });
};
