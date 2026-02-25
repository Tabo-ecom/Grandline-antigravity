import { useAuth } from '@/lib/context/AuthContext';

/**
 * Plan hierarchy: free < rookie < supernova < yonko
 * Each plan includes all modules from lower plans.
 */
const PLAN_LEVEL: Record<string, number> = {
    free: 0,
    rookie: 1,
    supernova: 2,
    yonko: 3,
};

/**
 * Minimum plan required for each module route.
 * Modules not listed here are accessible to all authenticated users.
 */
export const MODULE_REQUIRED_PLAN: Record<string, string> = {
    // Rookie (tier 1)
    dashboard: 'rookie',
    import: 'rookie',
    publicidad: 'rookie',

    // Supernova (tier 2)
    'log-pose': 'supernova',
    berry: 'supernova',
    'vega-ai': 'supernova',

    // Yonko (tier 3)
    sunny: 'yonko',
};

/**
 * Modules visible per plan (for sidebar display).
 * Higher plans include all modules from lower plans.
 */
export const PLAN_MODULES: Record<string, string[]> = {
    free: [],
    rookie: ['dashboard', 'import', 'publicidad'],
    supernova: ['dashboard', 'import', 'publicidad', 'log-pose', 'berry', 'vega-ai'],
    yonko: ['dashboard', 'import', 'publicidad', 'log-pose', 'berry', 'vega-ai', 'sunny'],
};

export function usePlanAccess() {
    const { profile } = useAuth();

    const plan = profile?.plan || 'free';
    const isActive = profile?.subscriptionStatus === 'active' || profile?.subscriptionStatus === 'trialing';
    const userLevel = PLAN_LEVEL[plan] ?? 0;

    /** Check if user can access a specific module */
    const canAccess = (moduleId: string): boolean => {
        // Admin role always has full access (for dev/testing)
        if (profile?.role === 'admin' && !profile?.plan) return true;

        const requiredPlan = MODULE_REQUIRED_PLAN[moduleId];
        if (!requiredPlan) return true; // module not restricted

        if (!isActive) return false; // no active subscription

        const requiredLevel = PLAN_LEVEL[requiredPlan] ?? 0;
        return userLevel >= requiredLevel;
    };

    /** Get all modules the user can access */
    const accessibleModules = (): string[] => {
        if (profile?.role === 'admin' && !profile?.plan) {
            return PLAN_MODULES['yonko']; // full access for admins without plan (dev)
        }
        if (!isActive) return [];
        return PLAN_MODULES[plan] || [];
    };

    /** Get the user's plan display name */
    const planLabel = (): string => {
        const labels: Record<string, string> = {
            free: 'Free',
            rookie: 'Rookie',
            supernova: 'Supernova',
            yonko: 'Yonko',
        };
        return labels[plan] || 'Free';
    };

    return {
        plan,
        isActive,
        canAccess,
        accessibleModules,
        planLabel,
    };
}
