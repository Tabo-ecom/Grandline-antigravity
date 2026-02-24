import { getAppData, setAppData } from '@/lib/firebase/firestore';
import type { KPITarget, KPITargetsConfig } from '@/lib/types/kpi-targets';
import { DEFAULT_KPI_TARGETS } from '@/lib/types/kpi-targets';

const KPI_TARGETS_KEY = 'kpi_targets';

export async function getKPITargets(userId: string): Promise<KPITarget[]> {
    if (!userId) return DEFAULT_KPI_TARGETS;
    const config = await getAppData<KPITargetsConfig>(KPI_TARGETS_KEY, userId);
    return config?.targets || DEFAULT_KPI_TARGETS;
}

export async function saveKPITargets(targets: KPITarget[], userId: string): Promise<void> {
    if (!userId) return;
    const config: KPITargetsConfig = {
        targets,
        updatedAt: Date.now(),
    };
    await setAppData(KPI_TARGETS_KEY, config, userId);
}
