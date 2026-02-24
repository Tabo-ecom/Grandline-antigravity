import jsPDF from 'jspdf';
import { PDF_COLORS } from './types';

interface RenderOptions {
    maxWidth: number;
    startX: number;
    pageHeight: number;
    onNewPage: () => void;
}

/**
 * Renders markdown text into a jsPDF document with proper styling.
 * Supports: headers (##, ###), bold (**), bullet points (-), tables (|), and plain text.
 */
export function renderMarkdownToPDF(
    doc: jsPDF,
    markdown: string,
    startY: number,
    options: RenderOptions
): number {
    const { maxWidth, startX, pageHeight, onNewPage } = options;
    let y = startY;
    const bottomMargin = 20;
    const lineHeight = 5;

    function checkNewPage(neededHeight: number = lineHeight * 2) {
        if (y + neededHeight > pageHeight - bottomMargin) {
            doc.addPage();
            onNewPage();
            y = 15;
        }
    }

    const lines = markdown.split('\n');
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();

        // Skip empty lines
        if (line === '') {
            y += 3;
            i++;
            continue;
        }

        // H2 header
        if (line.startsWith('## ')) {
            checkNewPage(15);
            y += 4;
            doc.setFontSize(12);
            doc.setTextColor(PDF_COLORS.accent);
            const text = cleanMarkdownInline(line.slice(3));
            doc.text(text, startX, y);
            y += 7;
            // Underline
            doc.setDrawColor(PDF_COLORS.accent);
            doc.setLineWidth(0.3);
            doc.line(startX, y - 3, startX + maxWidth * 0.6, y - 3);
            i++;
            continue;
        }

        // H3 header
        if (line.startsWith('### ')) {
            checkNewPage(12);
            y += 3;
            doc.setFontSize(10);
            doc.setTextColor(PDF_COLORS.text);
            const text = cleanMarkdownInline(line.slice(4));
            doc.text(text, startX, y);
            y += 6;
            i++;
            continue;
        }

        // H1 header (also ##)
        if (line.startsWith('# ')) {
            checkNewPage(15);
            y += 5;
            doc.setFontSize(14);
            doc.setTextColor(PDF_COLORS.accent);
            const text = cleanMarkdownInline(line.slice(2));
            doc.text(text, startX, y);
            y += 8;
            i++;
            continue;
        }

        // Table (lines starting with |)
        if (line.startsWith('|')) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }
            y = renderTable(doc, tableLines, startX, y, maxWidth, pageHeight, bottomMargin, onNewPage);
            y += 3;
            continue;
        }

        // Bullet point
        if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
            checkNewPage();
            doc.setFontSize(8);
            doc.setTextColor(PDF_COLORS.textMuted);

            const bulletChar = line.startsWith('- ') || line.startsWith('* ') ? '•' : line.match(/^(\d+)\./)?.[1] + '.';
            const textContent = line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
            const cleaned = cleanMarkdownInline(textContent);

            doc.text(bulletChar || '•', startX + 2, y);

            // Wrap text
            const wrappedLines = doc.splitTextToSize(cleaned, maxWidth - 10);
            wrappedLines.forEach((wl: string, wi: number) => {
                checkNewPage();
                if (wi === 0) {
                    // Check for bold segments in the first line
                    doc.setTextColor(PDF_COLORS.text);
                    doc.text(wl, startX + 8, y);
                } else {
                    doc.setTextColor(PDF_COLORS.textMuted);
                    doc.text(wl, startX + 8, y);
                }
                y += lineHeight;
            });
            i++;
            continue;
        }

        // Regular paragraph
        checkNewPage();
        doc.setFontSize(8);
        doc.setTextColor(PDF_COLORS.text);
        const cleaned = cleanMarkdownInline(line);
        const wrappedLines = doc.splitTextToSize(cleaned, maxWidth);
        wrappedLines.forEach((wl: string) => {
            checkNewPage();
            doc.text(wl, startX, y);
            y += lineHeight;
        });
        i++;
    }

    return y;
}

function cleanMarkdownInline(text: string): string {
    // Remove bold markers
    let cleaned = text.replace(/\*\*(.*?)\*\*/g, '$1');
    // Remove italic markers
    cleaned = cleaned.replace(/\*(.*?)\*/g, '$1');
    // Remove inline code
    cleaned = cleaned.replace(/`(.*?)`/g, '$1');
    // Remove emojis (common report ones)
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
    // Clean up extra spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

function renderTable(
    doc: jsPDF,
    tableLines: string[],
    startX: number,
    y: number,
    maxWidth: number,
    pageHeight: number,
    bottomMargin: number,
    onNewPage: () => void
): number {
    // Parse table
    const rows = tableLines
        .filter(line => !line.match(/^\|[\s-:|]+\|$/)) // Skip separator rows
        .map(line =>
            line.split('|')
                .slice(1, -1) // Remove empty first/last from leading/trailing |
                .map(cell => cleanMarkdownInline(cell.trim()))
        );

    if (rows.length === 0) return y;

    const isHeader = tableLines.length > 1 && tableLines[1]?.match(/^\|[\s-:|]+\|$/);
    const headerRow = isHeader ? rows[0] : undefined;
    const bodyRows = isHeader ? rows.slice(1) : rows;

    // Check page space
    if (y + (bodyRows.length + 2) * 6 > pageHeight - bottomMargin) {
        doc.addPage();
        onNewPage();
        y = 15;
    }

    const { default: autoTable } = require('jspdf-autotable');
    autoTable(doc, {
        startY: y,
        head: headerRow ? [headerRow] : undefined,
        body: bodyRows,
        theme: 'plain',
        styles: {
            fillColor: PDF_COLORS.cardBg,
            textColor: PDF_COLORS.text,
            fontSize: 7,
            cellPadding: 2.5,
            lineColor: PDF_COLORS.cardBorder,
            lineWidth: 0.2,
        },
        headStyles: {
            fillColor: '#1a2332',
            textColor: PDF_COLORS.accent,
            fontStyle: 'bold',
            fontSize: 7,
        },
        margin: { left: startX, right: startX },
    });

    return (doc as any).lastAutoTable?.finalY || y + 20;
}
