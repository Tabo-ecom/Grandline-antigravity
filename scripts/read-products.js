const XLSX = require('xlsx');
const fs = require('fs');

// Read the Excel file
const filePath = '/Users/tabo/Downloads/ordenes_productos_20260206_081940.xlsx';
const workbook = XLSX.readFile(filePath);
const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];

// Get the range
const range = XLSX.utils.decode_range(worksheet['!ref']);

console.log('=== INFORMACIÓN DEL ARCHIVO ===');
console.log('Hoja:', firstSheetName);
console.log('Rango:', worksheet['!ref']);
console.log('');

// Get header row to find column AC
console.log('=== ENCABEZADOS (Primera fila) ===');
for (let col = 0; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = worksheet[cellAddress];
    if (cell) {
        const colName = XLSX.utils.encode_col(col);
        console.log(`${colName}: ${cell.v}`);
    }
}

console.log('\n=== COLUMNA AC (Productos únicos) ===');
// Column AC is column 28 (0-indexed: A=0, B=1, ..., AC=28)
const acColumnIndex = 28;
const products = new Set();

// Read all rows in column AC
for (let row = 1; row <= Math.min(range.e.r, 1000); row++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: acColumnIndex });
    const cell = worksheet[cellAddress];
    if (cell && cell.v) {
        products.add(String(cell.v).trim());
    }
}

// Convert to array and sort
const productList = Array.from(products).sort();

console.log(`Total productos únicos: ${productList.length}\n`);
productList.forEach((product, index) => {
    console.log(`${index + 1}. ${product}`);
});

// Also check what column "PRODUCTO" is
console.log('\n=== BÚSQUEDA DE COLUMNA "PRODUCTO" ===');
for (let col = 0; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = worksheet[cellAddress];
    if (cell && cell.v && String(cell.v).toUpperCase().includes('PRODUCTO')) {
        const colName = XLSX.utils.encode_col(col);
        console.log(`Columna ${colName} (índice ${col}): ${cell.v}`);

        // Show first 10 values in this column
        console.log('Primeros 10 valores:');
        for (let row = 1; row <= Math.min(10, range.e.r); row++) {
            const valueCell = worksheet[XLSX.utils.encode_cell({ r: row, c: col })];
            if (valueCell) {
                console.log(`  - ${valueCell.v}`);
            }
        }
    }
}
