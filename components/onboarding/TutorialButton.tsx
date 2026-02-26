'use client';

import React, { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { MODULE_TUTORIALS } from '@/lib/config/tutorials';
import VideoTutorialModal from './VideoTutorialModal';

interface Props {
    moduleKey: string;
}

export default function TutorialButton({ moduleKey }: Props) {
    const [open, setOpen] = useState(false);
    const tutorial = MODULE_TUTORIALS[moduleKey];

    if (!tutorial) return null;

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[#d75c33] hover:bg-[#d75c33]/10 transition-colors text-xs font-semibold"
                title={`Tutorial: ${tutorial.title}`}
            >
                <PlayCircle size={16} />
                <span className="hidden sm:inline">Tutorial</span>
            </button>
            {open && (
                <VideoTutorialModal
                    tutorial={tutorial}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}
