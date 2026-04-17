import { db } from '@/lib/firebase/config';
import { collection, doc, setDoc, deleteDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';

// ─── Status Definitions ───

export interface TaskStatusDef {
    value: string;
    label: string;
    color: string;
    type: 'open' | 'active' | 'done' | 'closed';
}

export const ASIGNACIONES_STATUSES: TaskStatusDef[] = [
    { value: 'pendiente', label: 'Pendiente', color: '#87909e', type: 'open' },
    { value: 'en_progreso', label: 'En Progreso', color: '#1090e0', type: 'active' },
    { value: 'bloqueado', label: 'Bloqueado', color: '#e16b16', type: 'active' },
    { value: 'retraso', label: 'Retraso', color: '#d33d44', type: 'active' },
    { value: 'pendiente_aprobacion', label: 'Pendiente Aprobacion', color: '#f8ae00', type: 'active' },
    { value: 'corregir', label: 'Corregir', color: '#e84393', type: 'active' },
    { value: 'listo_para_subir', label: 'Listo para Subir', color: '#0f9d9f', type: 'done' },
    { value: 'testeo_programado', label: 'Testeo Programado', color: '#0f9d9f', type: 'done' },
    { value: 'completado', label: 'Completado', color: '#008844', type: 'closed' },
];

export const ANALISIS_STATUSES: TaskStatusDef[] = [
    { value: 'sin_asignar', label: 'Sin Asignar', color: '#87909e', type: 'open' },
    { value: 'corriendo', label: 'Corriendo', color: '#1090e0', type: 'active' },
    { value: 'revision', label: 'Revision', color: '#e16b16', type: 'active' },
    { value: 'escalando', label: 'Escalando', color: '#7B68EE', type: 'active' },
    { value: 'apagado', label: 'Apagado', color: '#d33d44', type: 'done' },
    { value: 'completado', label: 'Completado', color: '#008844', type: 'closed' },
];

// ─── Space & List Types ───

export type ListType = 'asignaciones' | 'analisis';

export interface TaskSpace {
    id: string;
    name: string;
    icon: string;
    color: string;
    type: 'public' | 'private';
    members: string[];
    team_id: string;
    order_index: number;
}

export interface SpaceTask {
    id: string;
    name: string;
    description: string;
    space_id: string;
    list_type: ListType;
    status: string;
    assignees: string[];
    priority: string; // urgente, alta, normal, baja
    due_date: number | null;
    // Asignaciones fields
    tienda: string;
    producto: string;
    codigo_dropi: string;
    tipo_actividad: string;
    tipo_estrategia: string;
    link_drive: string;
    url_pagina: string;
    cuenta_publicitaria: string;
    // Analisis fields
    rendimiento: string; // Excelente, Bueno, Regular, Malo
    resultados: string;
    punto_dolor: string;
    nota: string;
    // Progress
    progress: number;
    // Meta
    created_by: string;
    created_at: number;
    updated_at: number;
    team_id: string;
    // Sub-items
    subtasks: SpaceSubtask[];
    comments: SpaceComment[];
    files: SpaceFile[];
    activity: SpaceActivity[];
}

export interface SpaceSubtask {
    id: string;
    text: string;
    done: boolean;
    assignee: string;
}

export interface SpaceComment {
    id: string;
    author: string;
    text: string;
    timestamp: number;
}

export interface SpaceFile {
    id: string;
    name: string;
    url: string;
    uploaded_by: string;
    size: string;
    timestamp: number;
}

export interface SpaceActivity {
    id: string;
    actor: string;
    text: string;
    timestamp: number;
}

// ─── Collections ───
const SPACES_COL = 'task_spaces';
const TASKS_COL = 'space_tasks';

// ─── Space CRUD ───

export async function getSpaces(teamId: string): Promise<TaskSpace[]> {
    const q = query(collection(db, SPACES_COL), where('team_id', '==', teamId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskSpace))
        .sort((a, b) => a.order_index - b.order_index);
}

export async function saveSpace(space: TaskSpace): Promise<void> {
    await setDoc(doc(db, SPACES_COL, space.id), space);
}

export async function deleteSpace(spaceId: string): Promise<void> {
    await deleteDoc(doc(db, SPACES_COL, spaceId));
}

// ─── Task CRUD ───

export async function getTasks(teamId: string, spaceId?: string, listType?: ListType): Promise<SpaceTask[]> {
    let q;
    if (spaceId && listType) {
        q = query(collection(db, TASKS_COL), where('team_id', '==', teamId), where('space_id', '==', spaceId), where('list_type', '==', listType));
    } else if (spaceId) {
        q = query(collection(db, TASKS_COL), where('team_id', '==', teamId), where('space_id', '==', spaceId));
    } else {
        q = query(collection(db, TASKS_COL), where('team_id', '==', teamId));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SpaceTask))
        .sort((a, b) => b.updated_at - a.updated_at);
}

export async function saveTask(task: SpaceTask): Promise<void> {
    await setDoc(doc(db, TASKS_COL, task.id), { ...task, updated_at: Date.now() });
}

export async function deleteTask(taskId: string): Promise<void> {
    await deleteDoc(doc(db, TASKS_COL, taskId));
}

// ─── Helpers ───

export function createId(prefix = 'st'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyTask(spaceId: string, listType: ListType, teamId: string): SpaceTask {
    return {
        id: createId('task'),
        name: '',
        description: '',
        space_id: spaceId,
        list_type: listType,
        status: listType === 'asignaciones' ? 'pendiente' : 'sin_asignar',
        assignees: [],
        priority: 'normal',
        due_date: null,
        tienda: '',
        producto: '',
        codigo_dropi: '',
        tipo_actividad: '',
        tipo_estrategia: '',
        link_drive: '',
        url_pagina: '',
        cuenta_publicitaria: '',
        rendimiento: '',
        resultados: '',
        punto_dolor: '',
        nota: '',
        progress: 0,
        created_by: '',
        created_at: Date.now(),
        updated_at: Date.now(),
        team_id: teamId,
        subtasks: [],
        comments: [],
        files: [],
        activity: [],
    };
}

export function getStatusDef(status: string, listType: ListType): TaskStatusDef | undefined {
    const list = listType === 'asignaciones' ? ASIGNACIONES_STATUSES : ANALISIS_STATUSES;
    return list.find(s => s.value === status);
}

// ─── Kanban columns for board view ───

export const ASIGNACIONES_BOARD_COLS = [
    { key: 'pendiente', label: 'Pendiente', color: '#87909e', statuses: ['pendiente'] },
    { key: 'en_progreso', label: 'En Progreso', color: '#1090e0', statuses: ['en_progreso'] },
    { key: 'bloqueado', label: 'Bloqueado', color: '#e16b16', statuses: ['bloqueado'] },
    { key: 'retraso', label: 'Retraso', color: '#d33d44', statuses: ['retraso'] },
    { key: 'pendiente_aprobacion', label: 'Pend. Aprobacion', color: '#f8ae00', statuses: ['pendiente_aprobacion', 'corregir'] },
    { key: 'terminada', label: 'Terminada', color: '#0f9d9f', statuses: ['listo_para_subir', 'testeo_programado'] },
    { key: 'completado', label: 'Completado', color: '#008844', statuses: ['completado'] },
];

export const ANALISIS_BOARD_COLS = [
    { key: 'sin_asignar', label: 'Sin Asignar', color: '#87909e', statuses: ['sin_asignar'] },
    { key: 'corriendo', label: 'Corriendo', color: '#1090e0', statuses: ['corriendo'] },
    { key: 'revision', label: 'Revision', color: '#e16b16', statuses: ['revision'] },
    { key: 'escalando', label: 'Escalando', color: '#7B68EE', statuses: ['escalando'] },
    { key: 'apagado', label: 'Apagado', color: '#d33d44', statuses: ['apagado'] },
    { key: 'completado', label: 'Completado', color: '#008844', statuses: ['completado'] },
];

// ─── Priority definitions ───

export const PRIORITIES = [
    { value: 'urgente', label: 'Urgente', color: '#f50000' },
    { value: 'alta', label: 'Alta', color: '#f8ae00' },
    { value: 'normal', label: 'Normal', color: '#6fddff' },
    { value: 'baja', label: 'Baja', color: '#d8d8d8' },
];

export const RENDIMIENTO_OPTIONS = [
    { value: 'excelente', label: 'Excelente', color: '#008844' },
    { value: 'bueno', label: 'Bueno', color: '#1090e0' },
    { value: 'regular', label: 'Regular', color: '#f8ae00' },
    { value: 'malo', label: 'Malo', color: '#d33d44' },
];

export const TIPO_ACTIVIDAD_OPTIONS = [
    'VIDEOS CREATIVOS', 'IMAGENES PUBLICITARIAS', 'LANDING PAGE', 'FUNNEL',
    'CAMPAÑAS', 'BANNER', 'DISEÑO', 'EBOOK', 'EMAIL MARKETING',
    'MOCK UP', 'OFERTA - NUEVA PÁGINA', 'ORGANIZAR PÁGINA',
    'PRODUCTO NUEVO', 'REPLICAR PRODUCT', 'REVISIÓN', 'UPSELL',
    'COMPRA DE PRODUCTO',
];

export const TIENDA_OPTIONS = [
    { value: 'TABO ACCESORIOS', label: 'TABO ACCESORIOS', color: '#d75c33' },
    { value: 'LUCENT', label: 'LUCENT', color: '#8b5cf6' },
    { value: 'NATURAL SKIN', label: 'NATURAL SKIN', color: '#22c55e' },
    { value: 'DROP COLOMBIA', label: 'DROP COLOMBIA', color: '#6366f1' },
    { value: 'DROP ECUADOR', label: 'DROP ECUADOR', color: '#eab308' },
    { value: 'DROP GUATEMALA', label: 'DROP GUATEMALA', color: '#06b6d4' },
];

export const CUENTA_OPTIONS = [
    'BUFALO 9', 'CP1', 'CP3', 'CUENTA P4', 'ECUADOR 1', 'RESCATE CUENTA 1',
];

export const PRODUCTO_OPTIONS = [
    'MAGWALLET PRO', 'MAGWALLET', 'ECHOPLUGS SENSE', 'ECHOPLUGS PARTY', 'SELFIE PANTALLA',
    'CINTA CICATRICES', 'POLVOS CANDY BELLA', 'CONTORNO DE OJOS', 'BRASSIER POSTURA',
    'EXFOLIANTE NARANJA', 'PINK STUFF', 'RETINOL', 'SEOUL 1988', 'MIXSOON BEAN ESSENCE',
    'SPRAY MAGNESIO', 'SPRAY ARRUGAS ROPA', 'PETER TOMAS CONTORNO', 'MELAXIN PEEL SHOOT',
    'SUPER BEET', 'BEETFLOW', 'HAIR GROWTH GOMITAS', 'ASTAXANTHIN',
    'DR MELAXIN', 'CYPERUS GOTAS', 'CREMA RETINOL', 'BATANA OIL',
    'GOLI GOMAS', 'COLAGENO MARINO', 'OMEGA 3', 'CREATINA',
    'PELOTA INDESTRUCTIBLE', 'JABON MADAGASCAR', 'KIT ESPINILLAS',
];

// ─── Default spaces (matching ClickUp) ───

export const TEAM_MEMBERS_LIST = [
    { name: 'Aurora Quejada', initials: 'AQ', color: '#aa2fff' },
    { name: 'Andres Candamil', initials: 'AC', color: '#d60800' },
    { name: 'Luisa Garcia', initials: 'LG', color: '#f59e0b' },
    { name: 'Alejandra', initials: 'AL', color: '#3b82f6' },
    { name: 'Carolina', initials: 'CA', color: '#ec4899' },
    { name: 'Gustavo M.', initials: 'GM', color: '#22c55e' },
];

export const DEFAULT_SPACES: Omit<TaskSpace, 'id' | 'team_id'>[] = [
    { name: 'TABO accesorios', icon: '🎧', color: '#3b82f6', type: 'public', members: [], order_index: 0 },
    { name: 'Lucent', icon: '✨', color: '#8b5cf6', type: 'public', members: [], order_index: 1 },
    { name: 'Dropshipping', icon: '🦋', color: '#06b6d4', type: 'public', members: [], order_index: 2 },
    { name: 'Creadores UGC', icon: '🎬', color: '#ec4899', type: 'private', members: [], order_index: 3 },
    { name: 'GUSTAVO', icon: '🟢', color: '#22c55e', type: 'public', members: [], order_index: 4 },
];

export async function seedDefaultSpaces(teamId: string): Promise<TaskSpace[]> {
    const spaces: TaskSpace[] = [];
    const batch = writeBatch(db);
    for (const def of DEFAULT_SPACES) {
        const space: TaskSpace = { ...def, id: createId('space'), team_id: teamId };
        spaces.push(space);
        batch.set(doc(db, SPACES_COL, space.id), space);
    }
    await batch.commit();
    return spaces;
}
