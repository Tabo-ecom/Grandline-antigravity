export const ALL_MODULES = [
    // Finanzas
    { id: 'dashboard', name: 'Wheel (Dashboard)', href: '/dashboard', category: 'Finanzas' },
    { id: 'berry', name: 'Berry (Finanzas)', href: '/berry', category: 'Finanzas' },
    { id: 'publicidad', name: 'Publicidad', href: '/publicidad', category: 'Finanzas' },
    { id: 'log-pose', name: 'Log Pose', href: '/log-pose', category: 'Finanzas' },
    // Operaciones
    { id: 'sunny', name: 'Sunny (Lanzador)', href: '/sunny', category: 'Operaciones' },
    { id: 'vega-ai', name: 'Vega AI', href: '/vega-ai', category: 'Operaciones' },
    { id: 'proveedor', name: 'Proveedor', href: '/proveedor', category: 'Operaciones' },
    // Workspace
    { id: 'tareas', name: 'Tareas', href: '/tareas', category: 'Workspace' },
    { id: 'docs', name: 'Docs / Wiki', href: '/docs', category: 'Workspace' },
    { id: 'chat', name: 'Chat', href: '/chat', category: 'Workspace' },
    { id: 'calendario', name: 'Calendario', href: '/calendario', category: 'Workspace' },
    // Logistica
    { id: 'logistica', name: 'Logistica (Paises)', href: '/logistica', category: 'Logistica' },
    // Utilidades
    { id: 'import', name: 'Importar Datos', href: '/import', category: 'Utilidades' },
] as const;

export type ModuleId = typeof ALL_MODULES[number]['id'];

export const MODULE_CATEGORIES = ['Finanzas', 'Operaciones', 'Workspace', 'Logistica', 'Utilidades'] as const;
