'use client';

import React, { useState } from 'react';
import { Compass, ChevronRight, Loader2 } from 'lucide-react';
import { SURVEY_QUESTIONS, type SurveyAnswers } from '@/lib/config/tutorials';

interface Props {
    onComplete: (answers: SurveyAnswers) => void;
    userName?: string;
}

export default function OnboardingSurvey({ onComplete, userName }: Props) {
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<SurveyAnswers>({
        monthlyOrders: '',
        countries: [],
        goals: [],
    });
    const [submitting, setSubmitting] = useState(false);

    const questions = [
        {
            key: 'monthlyOrders' as const,
            ...SURVEY_QUESTIONS.monthlyOrders,
            multiSelect: false,
        },
        {
            key: 'countries' as const,
            ...SURVEY_QUESTIONS.countries,
            multiSelect: true,
        },
        {
            key: 'goals' as const,
            ...SURVEY_QUESTIONS.goals,
            multiSelect: true,
        },
    ];

    const current = questions[step];
    const isLast = step === questions.length - 1;

    const isSelected = (option: string) => {
        if (current.key === 'monthlyOrders') return answers.monthlyOrders === option;
        return (answers[current.key] as string[]).includes(option);
    };

    const toggleOption = (option: string) => {
        if (current.key === 'monthlyOrders') {
            setAnswers(prev => ({ ...prev, monthlyOrders: option }));
        } else {
            const key = current.key as 'countries' | 'goals';
            setAnswers(prev => {
                const arr = prev[key] as string[];
                return {
                    ...prev,
                    [key]: arr.includes(option) ? arr.filter(o => o !== option) : [...arr, option],
                };
            });
        }
    };

    const canProceed = current.key === 'monthlyOrders'
        ? !!answers.monthlyOrders
        : (answers[current.key] as string[]).length > 0;

    const handleNext = async () => {
        if (!canProceed) return;
        if (isLast) {
            setSubmitting(true);
            try {
                // Send email via API
                await fetch('/api/onboarding/survey', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ answers, userName }),
                }).catch(() => {}); // Non-blocking
                onComplete(answers);
            } finally {
                setSubmitting(false);
            }
        } else {
            setStep(s => s + 1);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <div className="relative z-10 w-full max-w-lg border-2 border-[#d75c33] bg-card rounded-2xl shadow-[0_0_30px_rgba(215,92,51,0.15)] animate-in zoom-in-95 duration-200 overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-6 pb-2">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-[#d75c33]/10 flex items-center justify-center">
                            <Compass size={22} className="text-[#d75c33]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground">
                                {step === 0 ? 'Cuentanos sobre tu negocio' : current.question}
                            </h2>
                            <p className="text-xs text-muted">Paso {step + 1} de {questions.length}</p>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-1 bg-card-border rounded-full overflow-hidden mb-4">
                        <div
                            className="h-full bg-[#d75c33] rounded-full transition-all duration-300"
                            style={{ width: `${((step + 1) / questions.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Question */}
                <div className="px-6 pb-4">
                    {step === 0 && (
                        <p className="text-sm text-muted mb-3">Esto nos ayuda a personalizar tu experiencia.</p>
                    )}
                    <p className="text-sm font-semibold text-foreground mb-3">
                        {current.question}
                        {current.multiSelect && <span className="text-muted font-normal ml-1">(puedes elegir varias)</span>}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {current.options.map(option => (
                            <button
                                key={option}
                                onClick={() => toggleOption(option)}
                                className={`px-4 py-3 rounded-xl text-sm text-left transition-all duration-150 border-2 ${
                                    isSelected(option)
                                        ? 'border-[#d75c33] bg-[#d75c33]/10 text-foreground font-semibold'
                                        : 'border-card-border bg-card hover:border-[#d75c33]/40 text-foreground/70'
                                }`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex items-center justify-between">
                    {step > 0 ? (
                        <button
                            onClick={() => setStep(s => s - 1)}
                            className="text-sm text-muted hover:text-foreground transition-colors"
                        >
                            Atras
                        </button>
                    ) : <div />}
                    <button
                        onClick={handleNext}
                        disabled={!canProceed || submitting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#d75c33] text-white text-sm font-semibold rounded-xl hover:bg-[#c04e2a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {submitting ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <>
                                {isLast ? 'Comenzar' : 'Siguiente'}
                                <ChevronRight size={16} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
