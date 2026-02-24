export const ALL_MODULES = [
    { id: 'dashboard', name: 'Dashboard Global', href: '/dashboard' },
    { id: 'log-pose', name: 'Log Pose', href: '/log-pose' },
    { id: 'publicidad', name: 'Publicidad', href: '/publicidad' },
    { id: 'sunny', name: 'Módulo Sunny', href: '/sunny' },
    { id: 'berry', name: 'Berry', href: '/berry' },
    { id: 'vega-ai', name: 'Vega AI', href: '/vega-ai' },
    { id: 'import', name: 'Importar Datos', href: '/import' },
] as const;

export type ModuleId = typeof ALL_MODULES[number]['id'];
