'use client';

import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

const InfoTooltip = ({ text }: { text: string }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [show, setShow] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number; above: boolean }>({ top: 0, left: 0, above: true });
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const handleEnter = () => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const above = rect.top > 160;
        setPos({
            top: above ? rect.top - 8 : rect.bottom + 8,
            left: Math.min(Math.max(rect.left + rect.width / 2, 110), window.innerWidth - 110),
            above,
        });
        setShow(true);
    };

    return (
        <div ref={ref} className="relative inline-flex" onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
            <Info className="w-3.5 h-3.5 text-muted/50 hover:text-muted cursor-help transition-colors" />
            {show && mounted && createPortal(
                <div
                    className="fixed px-3 py-2 bg-foreground text-background text-[11px] leading-relaxed rounded-lg shadow-xl w-52 text-center font-normal normal-case tracking-normal whitespace-pre-line pointer-events-none"
                    style={{
                        zIndex: 9999,
                        top: pos.above ? undefined : pos.top,
                        bottom: pos.above ? `${window.innerHeight - pos.top}px` : undefined,
                        left: pos.left,
                        transform: 'translateX(-50%)',
                    }}
                >
                    {text}
                    <div
                        className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${pos.above ? 'top-full -mt-px border-t-foreground' : 'bottom-full -mb-px border-b-foreground'}`}
                    />
                </div>,
                document.body
            )}
        </div>
    );
};

export default InfoTooltip;
