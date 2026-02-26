'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useOnboarding } from '@/lib/hooks/useOnboarding';
import { useAuth } from '@/lib/context/AuthContext';
import { TUTORIAL_INTRO, MODULE_TUTORIALS, type SurveyAnswers } from '@/lib/config/tutorials';
import OnboardingSurvey from './OnboardingSurvey';
import VideoTutorialModal from './VideoTutorialModal';
import { PlayCircle } from 'lucide-react';

export default function OnboardingFlow() {
    const { profile } = useAuth();
    const pathname = usePathname();
    const {
        loading,
        shouldShowSurvey,
        shouldShowIntro,
        markSurveyed,
        markIntroSeen,
    } = useOnboarding();

    const [showSurvey, setShowSurvey] = useState(false);
    const [showIntro, setShowIntro] = useState(false);
    const [showManualTutorial, setShowManualTutorial] = useState(false);

    // Get current module tutorial based on route
    const getModuleKey = (path: string): string => {
        if (MODULE_TUTORIALS[path]) return path;
        for (const key of Object.keys(MODULE_TUTORIALS)) {
            if (path.startsWith(key)) return key;
        }
        return '';
    };

    const currentModuleKey = getModuleKey(pathname);
    const currentTutorial = currentModuleKey ? MODULE_TUTORIALS[currentModuleKey] : null;

    // Survey: only on first ever session
    useEffect(() => {
        if (shouldShowSurvey) setShowSurvey(true);
    }, [shouldShowSurvey]);

    // Intro: only once after survey
    useEffect(() => {
        if (shouldShowIntro && !showSurvey) setShowIntro(true);
    }, [shouldShowIntro, showSurvey]);

    const handleSurveyComplete = async (answers: SurveyAnswers) => {
        await markSurveyed(answers);
        setShowSurvey(false);
    };

    const handleIntroDismiss = async () => {
        await markIntroSeen();
        setShowIntro(false);
    };

    if (loading) return null;

    return (
        <>
            {/* Survey — first login only */}
            {showSurvey && (
                <OnboardingSurvey
                    onComplete={handleSurveyComplete}
                    userName={profile?.display_name || profile?.email || ''}
                />
            )}

            {/* Intro video — once after survey */}
            {showIntro && !showSurvey && (
                <VideoTutorialModal
                    tutorial={TUTORIAL_INTRO}
                    onClose={handleIntroDismiss}
                />
            )}

            {/* Floating Tutorial button — always visible when a module tutorial exists */}
            {!showSurvey && !showIntro && currentTutorial && (
                <>
                    <button
                        onClick={() => setShowManualTutorial(true)}
                        className="fixed bottom-6 right-20 z-[60] flex items-center gap-2 px-4 py-2.5 bg-[#d75c33] text-white text-sm font-semibold rounded-xl shadow-lg hover:bg-[#c04e2a] transition-all hover:scale-105"
                        title={`Tutorial: ${currentTutorial.title}`}
                    >
                        <PlayCircle size={18} />
                        <span className="hidden sm:inline">Tutorial</span>
                    </button>

                    {showManualTutorial && (
                        <VideoTutorialModal
                            tutorial={currentTutorial}
                            onClose={() => setShowManualTutorial(false)}
                        />
                    )}
                </>
            )}
        </>
    );
}
