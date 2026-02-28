/**
 * Capture a rendered DOM element to PDF using html2canvas.
 * This produces a pixel-perfect PDF that matches the web UI exactly.
 */
import jsPDF from 'jspdf';

export async function captureElementToPDF(
    element: HTMLElement,
    filename: string
): Promise<void> {
    const { default: html2canvas } = await import('html2canvas-pro');

    // Walk up the ENTIRE DOM tree and temporarily disable all overflow/scroll/max-height
    // constraints. Tailwind classes like max-h-[700px] use CSS classes which have specificity,
    // so we must use !important to override them.
    const overrides: { el: HTMLElement; orig: { overflow: string; overflowY: string; maxHeight: string; height: string } }[] = [];
    let ancestor: HTMLElement | null = element.parentElement;

    while (ancestor && ancestor !== document.documentElement) {
        const computed = window.getComputedStyle(ancestor);
        if (
            computed.overflow !== 'visible' ||
            computed.overflowY !== 'visible' ||
            computed.overflowX !== 'visible' ||
            computed.maxHeight !== 'none'
        ) {
            overrides.push({
                el: ancestor,
                orig: {
                    overflow: ancestor.style.overflow,
                    overflowY: ancestor.style.overflowY,
                    maxHeight: ancestor.style.maxHeight,
                    height: ancestor.style.height,
                },
            });
            ancestor.style.setProperty('overflow', 'visible', 'important');
            ancestor.style.setProperty('overflow-y', 'visible', 'important');
            ancestor.style.setProperty('max-height', 'none', 'important');
            ancestor.style.setProperty('height', 'auto', 'important');
        }
        ancestor = ancestor.parentElement;
    }

    // Small delay to let the browser re-layout after removing overflow constraints
    await new Promise(r => setTimeout(r, 100));

    const canvas = await html2canvas(element, {
        scale: 2, // 2x for sharp text
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0A0A0F', // Match app dark background
        logging: false,
        imageTimeout: 5000,
        // Capture the full scrollable content
        windowHeight: element.scrollHeight + 200,
    });

    // Restore all ancestor styles
    overrides.forEach(({ el, orig }) => {
        el.style.overflow = orig.overflow;
        el.style.overflowY = orig.overflowY;
        el.style.maxHeight = orig.maxHeight;
        el.style.height = orig.height;
    });

    // A4 dimensions in mm
    const a4Width = 210;
    const a4Height = 297;
    const margin = 8; // mm margin on each side
    const contentWidth = a4Width - margin * 2;

    // Calculate how the canvas maps to A4
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Available height per page (with margin top/bottom)
    const pageContentHeight = a4Height - margin * 2;

    // Number of pages needed
    const totalPages = Math.ceil(imgHeight / pageContentHeight);

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    for (let page = 0; page < totalPages; page++) {
        if (page > 0) doc.addPage();

        // Dark background on every page
        doc.setFillColor('#0A0A0F');
        doc.rect(0, 0, a4Width, a4Height, 'F');

        // Calculate the y-offset for this page slice
        const srcY = page * pageContentHeight;

        // Add the full image but offset it so only the current page's slice shows
        doc.addImage(
            imgData,
            'JPEG',
            margin,
            margin - srcY,
            imgWidth,
            imgHeight
        );

        // Mask overflow: draw dark rectangles above and below the visible area
        // Top mask (covers content from previous pages bleeding into top)
        if (page > 0) {
            doc.setFillColor('#0A0A0F');
            doc.rect(0, 0, a4Width, margin, 'F');
        }
        // Bottom mask (covers content from next pages bleeding into bottom)
        doc.setFillColor('#0A0A0F');
        doc.rect(0, a4Height - margin, a4Width, margin, 'F');

        // Footer
        doc.setFontSize(6);
        doc.setTextColor('#8892a4');
        doc.text(
            `Grand Line — Command Center  |  Generado por VEGA IA  |  Pagina ${page + 1} de ${totalPages}`,
            a4Width / 2,
            a4Height - 4,
            { align: 'center' }
        );
    }

    doc.save(filename);
}
