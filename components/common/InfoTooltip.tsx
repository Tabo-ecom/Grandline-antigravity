'use client';

import React, { useRef, useState } from 'react';
import { Info } from 'lucide-react';

const InfoTooltip = ({ text }: { text: string }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [above, setAbove] = useState(true);

    const handleEnter = () => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        setAbove(rect.top > 120);
    };

    return (
        <div ref={ref} className="relative group/info inline-flex" onMouseEnter={handleEnter}>
            <Info className="w-3.5 h-3.5 text-muted/50 hover:text-muted cursor-help transition-colors" />
            <div className={`absolute left-1/2 -translate-x-1/2 px-3 py-2 bg-foreground text-background text-[11px] leading-tight rounded-lg shadow-lg opacity-0 group-hover/info:opacity-100 pointer-events-none transition-opacity duration-200 w-48 text-center z-50 font-normal normal-case tracking-normal ${above ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
                {text}
                <div className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${above ? 'top-full -mt-px border-t-foreground' : 'bottom-full -mb-px border-b-foreground'}`} />
            </div>
        </div>
    );
};

export default InfoTooltip;
