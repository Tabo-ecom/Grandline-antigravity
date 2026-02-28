'use client';

import React, { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import type { PDFReportData } from '@/lib/services/pdf/types';

interface PDFExportButtonProps {
    getData: () => PDFReportData;
    label?: string;
    compact?: boolean;
}

export const PDFExportButton: React.FC<PDFExportButtonProps> = ({ getData, label = 'PDF', compact = false }) => {
    const [generating, setGenerating] = useState(false);

    const handleExport = async () => {
        setGenerating(true);
        try {
            // Dynamic import to avoid loading jspdf in the main bundle
            const { downloadPDFReport } = await import('@/lib/services/pdf/generator');
            const data = getData();
            await downloadPDFReport(data);
        } catch (err) {
            console.error('Error generating PDF:', err);
        } finally {
            setGenerating(false);
        }
    };

    if (compact) {
        return (
            <button
                onClick={handleExport}
                disabled={generating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40"
                title="Exportar PDF"
            >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                {label}
            </button>
        );
    }

    return (
        <button
            onClick={handleExport}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-muted bg-hover-bg border border-card-border hover:border-accent/30 hover:text-foreground transition-all disabled:opacity-40"
        >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            {label}
        </button>
    );
};
