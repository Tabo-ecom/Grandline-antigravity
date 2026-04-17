import { db } from '@/lib/firebase/config';
import {
    collection, doc, getDoc, setDoc, deleteDoc,
    query, where, getDocs, orderBy, serverTimestamp,
    writeBatch,
} from 'firebase/firestore';
import type { JSONContent } from '@tiptap/react';

// ─── Types ───

export interface DocPage {
    id: string;
    title: string;
    icon: string;
    parent_id: string | null;  // null = root level
    team_id: string;
    content: JSONContent | null;  // TipTap JSON
    created_by: string;
    created_at: number;
    updated_at: number;
    order_index: number;
}

export type DocPageMeta = Omit<DocPage, 'content'>;

const COLLECTION = 'docs';

// ─── CRUD ───

export async function getDocPages(teamId: string): Promise<DocPageMeta[]> {
    const q = query(
        collection(db, COLLECTION),
        where('team_id', '==', teamId),
        orderBy('order_index', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        // Return without content to keep it light
        return {
            id: d.id,
            title: data.title || 'Sin titulo',
            icon: data.icon || '',
            parent_id: data.parent_id || null,
            team_id: data.team_id,
            created_by: data.created_by || '',
            created_at: data.created_at || 0,
            updated_at: data.updated_at || 0,
            order_index: data.order_index || 0,
        };
    });
}

export async function getDocContent(docId: string): Promise<DocPage | null> {
    const snap = await getDoc(doc(db, COLLECTION, docId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
        id: snap.id,
        title: data.title || 'Sin titulo',
        icon: data.icon || '',
        parent_id: data.parent_id || null,
        team_id: data.team_id,
        content: data.content || null,
        created_by: data.created_by || '',
        created_at: data.created_at || 0,
        updated_at: data.updated_at || 0,
        order_index: data.order_index || 0,
    };
}

export async function saveDocPage(page: DocPage): Promise<void> {
    await setDoc(doc(db, COLLECTION, page.id), {
        title: page.title,
        icon: page.icon,
        parent_id: page.parent_id,
        team_id: page.team_id,
        content: page.content,
        created_by: page.created_by,
        created_at: page.created_at,
        updated_at: Date.now(),
        order_index: page.order_index,
    });
}

export async function deleteDocPage(docId: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, docId));
}

export async function updateDocTitle(docId: string, title: string): Promise<void> {
    const ref = doc(db, COLLECTION, docId);
    await setDoc(ref, { title, updated_at: Date.now() }, { merge: true });
}

export async function updateDocIcon(docId: string, icon: string): Promise<void> {
    const ref = doc(db, COLLECTION, docId);
    await setDoc(ref, { icon, updated_at: Date.now() }, { merge: true });
}

export async function updateDocContent(docId: string, content: JSONContent): Promise<void> {
    const ref = doc(db, COLLECTION, docId);
    await setDoc(ref, { content, updated_at: Date.now() }, { merge: true });
}

export async function moveDocPage(docId: string, newParentId: string | null, orderIndex: number): Promise<void> {
    const ref = doc(db, COLLECTION, docId);
    await setDoc(ref, { parent_id: newParentId, order_index: orderIndex, updated_at: Date.now() }, { merge: true });
}

// ─── Helpers ───

export function createDocId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyDoc(teamId: string, parentId: string | null = null, title = 'Sin titulo', icon = '', orderIndex = 0): DocPage {
    return {
        id: createDocId(),
        title,
        icon,
        parent_id: parentId,
        team_id: teamId,
        content: null,
        created_by: '',
        created_at: Date.now(),
        updated_at: Date.now(),
        order_index: orderIndex,
    };
}

// ─── Seed from Notion structure ───

interface NotionSeedItem {
    title: string;
    icon: string;
    children?: NotionSeedItem[];
}

export async function seedFromNotion(teamId: string, structure: NotionSeedItem[]): Promise<DocPage[]> {
    const pages: DocPage[] = [];
    let orderCounter = 0;

    function walk(items: NotionSeedItem[], parentId: string | null) {
        for (const item of items) {
            const page = createEmptyDoc(teamId, parentId, item.title, item.icon, orderCounter++);
            pages.push(page);
            if (item.children?.length) {
                walk(item.children, page.id);
            }
        }
    }

    walk(structure, null);

    // Batch write
    const batch = writeBatch(db);
    for (const page of pages) {
        batch.set(doc(db, COLLECTION, page.id), {
            title: page.title,
            icon: page.icon,
            parent_id: page.parent_id,
            team_id: page.team_id,
            content: null,
            created_by: 'system',
            created_at: page.created_at,
            updated_at: page.updated_at,
            order_index: page.order_index,
        });
    }
    await batch.commit();

    return pages;
}

// Enterprise structure — comprehensive company documentation
export const NOTION_SEED_STRUCTURE: NotionSeedItem[] = [
    // ─── 1. EMPRESA ─────────────────────────────────────────────
    { title: 'EMPRESA', icon: '🏢', children: [
        { title: 'Misión, Visión y Valores', icon: '🌐' },
        { title: 'Estructura Organizacional', icon: '🌟' },
        { title: 'Cultura y Principios', icon: '💎' },
        { title: 'Objetivos y OKRs', icon: '🎯' },
        { title: 'Colaboradores', icon: '👷' },
        { title: 'Onboarding Nuevos Miembros', icon: '🚀' },
    ]},

    // ─── 2. MARCAS ──────────────────────────────────────────────
    { title: 'MARCAS', icon: '🏷️', children: [
        { title: 'TABO Accesorios', icon: '🎧', children: [
            { title: 'Identidad de Marca', icon: '🎨' },
            { title: 'Buyer Persona', icon: '👤' },
            { title: 'Catálogo de Productos', icon: '📦' },
            { title: 'Estrategia de Marketing', icon: '📣' },
        ]},
        { title: 'Lucent Skincare', icon: '✨', children: [
            { title: 'Identidad de Marca', icon: '🎨' },
            { title: 'Buyer Persona', icon: '👤' },
            { title: 'Catálogo de Productos', icon: '📦' },
            { title: 'Estrategia de Marketing', icon: '📣' },
        ]},
        { title: 'Premium Home', icon: '🏠', children: [
            { title: 'Identidad de Marca', icon: '🎨' },
            { title: 'Buyer Persona', icon: '👤' },
            { title: 'Catálogo de Productos', icon: '📦' },
            { title: 'Estrategia de Marketing', icon: '📣' },
        ]},
        { title: 'Essentials Colombia', icon: '🇨🇴', children: [
            { title: 'Identidad de Marca', icon: '🎨' },
            { title: 'Buyer Persona', icon: '👤' },
            { title: 'Catálogo de Productos', icon: '📦' },
            { title: 'Estrategia de Marketing', icon: '📣' },
        ]},
    ]},

    // ─── 3. PROCESOS ────────────────────────────────────────────
    { title: 'PROCESOS', icon: '⚙️', children: [
        { title: 'Investigación de Mercado', icon: '💹', children: [
            { title: 'Cómo Encontrar Productos Winner', icon: '🤑' },
            { title: 'Análisis de Competencia', icon: '🔍' },
            { title: 'Validación de Producto', icon: '✅' },
            { title: 'Estudio de Nicho', icon: '📊' },
        ]},
        { title: 'Creación de Producto', icon: '🛠️', children: [
            { title: 'De Amazon a Shopify (Pipeline)', icon: '🚀' },
            { title: 'Landing Page — Estructura', icon: '🧩' },
            { title: 'Copywriting CRO', icon: '✍️' },
            { title: 'Fotografía y Mockups', icon: '📸' },
        ]},
        { title: 'Publicidad', icon: '📣', children: [
            { title: 'Estructuras de Campañas', icon: '✅' },
            { title: 'Campañas Facebook', icon: '🔵' },
            { title: 'Campañas TikTok', icon: '🟣' },
            { title: 'Métricas y KPIs Clave', icon: '📉' },
            { title: 'Escalamiento', icon: '📈' },
            { title: 'Exclusiones y Audiencias', icon: '👁️' },
            { title: 'Ángulos de Venta', icon: '🎯' },
        ]},
        { title: 'Creativos y Contenido', icon: '🎬', children: [
            { title: 'Búsqueda de Creativos', icon: '📸' },
            { title: 'Estructura de Videos', icon: '📹' },
            { title: 'Plantillas y Prompts AI', icon: '🤖' },
            { title: 'UGC — Guía Creadores', icon: '🎥' },
            { title: 'Embudos de Venta', icon: '📱' },
        ]},
        { title: 'Logística y Operación', icon: '📦', children: [
            { title: 'Flujo de Pedidos (Dropi)', icon: '🧡' },
            { title: 'Asesor Logístico — Manual', icon: '🤝', children: [
                { title: 'Chat y Call Flow', icon: '💬' },
                { title: 'Manejo de Dropi', icon: '🧡' },
                { title: 'Manejo de Effi', icon: '💙' },
                { title: 'Garantías y Devoluciones', icon: '⚠️' },
            ]},
            { title: 'Líder Logístico — Manual', icon: '📞', children: [
                { title: 'Cronograma Semanal', icon: '🕐' },
                { title: 'Actividades Bodega', icon: '🚚' },
                { title: 'Carritos Abandonados', icon: '🛒' },
                { title: 'Validación de Pedidos', icon: '✋' },
                { title: 'Reportes a Entregar', icon: '🗣️' },
            ]},
            { title: 'Automatizaciones', icon: '🤖' },
        ]},
    ]},

    // ─── 4. CAPACITACIONES ──────────────────────────────────────
    { title: 'CAPACITACIONES', icon: '📚', children: [
        { title: 'Auxiliar Creativo', icon: '🎨' },
        { title: 'Editor de Video', icon: '🎬' },
        { title: 'Media Buyer', icon: '📣' },
        { title: 'Asesor Logístico', icon: '📞' },
        { title: 'Cronograma de Entrenamiento', icon: '📅' },
    ]},

    // ─── 5. ADMINISTRACIÓN ──────────────────────────────────────
    { title: 'ADMINISTRACIÓN', icon: '📕', children: [
        { title: 'Finanzas y Contabilidad', icon: '💰', children: [
            { title: 'Control de Gastos', icon: '📊' },
            { title: 'Reportes Mensuales', icon: '📒' },
            { title: 'Impuestos', icon: '📅' },
            { title: 'Bodega', icon: '🚚' },
            { title: 'Comercializadora', icon: '📦' },
        ]},
        { title: 'Legal y Compliance', icon: '⚖️' },
        { title: 'Contraseñas y Accesos', icon: '🔑' },
        { title: 'Presentaciones', icon: '💻' },
        { title: 'Proveedores', icon: '🤝' },
    ]},

    // ─── 6. BASE DE CONOCIMIENTO ────────────────────────────────
    { title: 'BASE DE CONOCIMIENTO', icon: '🧠', children: [
        { title: 'Herramientas del Equipo', icon: '🛠️' },
        { title: 'Tutoriales Grand Line', icon: '🧭' },
        { title: 'Recursos y Templates', icon: '📄' },
        { title: 'Lecciones Aprendidas', icon: '💡' },
        { title: 'FAQ Interno', icon: '❓' },
    ]},
];
