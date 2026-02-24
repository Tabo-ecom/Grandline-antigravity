'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { getKPITargets, saveKPITargets } from '@/lib/services/kpi-targets';
import type { KPITarget } from '@/lib/types/kpi-targets';
import { DEFAULT_KPI_TARGETS } from '@/lib/types/kpi-targets';

export function useKPITargets() {
    const { effectiveUid } = useAuth();
    const [targets, setTargets] = useState<KPITarget[]>(DEFAULT_KPI_TARGETS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            if (!effectiveUid) return;
            try {
                const loaded = await getKPITargets(effectiveUid);
                setTargets(loaded);
            } catch (err) {
                console.error('Error loading KPI targets:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [effectiveUid]);

    const save = async (newTargets: KPITarget[]) => {
        if (!effectiveUid) return;
        setTargets(newTargets);
        await saveKPITargets(newTargets, effectiveUid);
    };

    return { targets, loading, save };
}
