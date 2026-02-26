'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAppData, setAppData } from '@/lib/firebase/firestore';
import { useAuth } from '@/lib/context/AuthContext';
import type { SurveyAnswers } from '@/lib/config/tutorials';

interface OnboardingState {
    surveyCompleted: boolean;
    introSeen: boolean;
    modulesSeen: Record<string, boolean>;
    surveyAnswers?: SurveyAnswers;
}

const DEFAULT_STATE: OnboardingState = {
    surveyCompleted: false,
    introSeen: false,
    modulesSeen: {},
};

const STORAGE_KEY = 'onboarding_state';

export function useOnboarding() {
    const { user, effectiveUid } = useAuth();
    const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
    const [loading, setLoading] = useState(true);

    const uid = effectiveUid || user?.uid || '';

    useEffect(() => {
        if (!uid) { setLoading(false); return; }
        let cancelled = false;
        (async () => {
            try {
                const saved = await getAppData<OnboardingState>(STORAGE_KEY, uid);
                if (!cancelled && saved) setState(saved);
            } catch (e) {
                console.error('[Onboarding] Error loading state:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [uid]);

    const persist = useCallback(async (newState: OnboardingState) => {
        setState(newState);
        if (uid) {
            try {
                await setAppData(STORAGE_KEY, newState, uid);
            } catch (e) {
                console.error('[Onboarding] Error saving state:', e);
            }
        }
    }, [uid]);

    const markSurveyed = useCallback(async (answers: SurveyAnswers) => {
        const newState = { ...state, surveyCompleted: true, surveyAnswers: answers };
        await persist(newState);
    }, [state, persist]);

    const markIntroSeen = useCallback(async () => {
        const newState = { ...state, introSeen: true };
        await persist(newState);
    }, [state, persist]);

    const markModuleSeen = useCallback(async (moduleId: string) => {
        const newState = {
            ...state,
            modulesSeen: { ...state.modulesSeen, [moduleId]: true },
        };
        await persist(newState);
    }, [state, persist]);

    const shouldShowSurvey = !loading && !!uid && !state.surveyCompleted;
    const shouldShowIntro = !loading && !!uid && state.surveyCompleted && !state.introSeen;

    const shouldShowModuleTutorial = useCallback((moduleId: string) => {
        if (loading || !uid || !state.surveyCompleted || !state.introSeen) return false;
        return !state.modulesSeen[moduleId];
    }, [loading, uid, state]);

    return {
        state,
        loading,
        markSurveyed,
        markIntroSeen,
        markModuleSeen,
        shouldShowSurvey,
        shouldShowIntro,
        shouldShowModuleTutorial,
    };
}
