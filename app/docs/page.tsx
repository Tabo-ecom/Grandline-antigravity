'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Loader2, Plus, ChevronDown, ChevronRight, FileText, Trash2, X,
    Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered,
    Heading1, Heading2, Heading3, Code, Quote, Minus, Link2, Redo, Undo,
    CheckSquare, AlignLeft, AlignCenter, AlignRight, Highlighter, MoreHorizontal,
    FolderOpen, Download, Search,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import UnderlineExt from '@tiptap/extension-underline';
import LinkExt from '@tiptap/extension-link';
import {
    DocPage, DocPageMeta,
    getDocPages, getDocContent, saveDocPage, deleteDocPage,
    updateDocTitle, updateDocContent, updateDocIcon,
    createEmptyDoc, seedFromNotion, NOTION_SEED_STRUCTURE,
} from '@/lib/services/docs';

// ─── Doc Tree Item ───
function TreeItem({ page, pages, selectedId, depth, onSelect, onToggle, expanded }: {
    page: DocPageMeta;
    pages: DocPageMeta[];
    selectedId: string | null;
    depth: number;
    onSelect: (id: string) => void;
    onToggle: (id: string) => void;
    expanded: Record<string, boolean>;
}) {
    const children = pages.filter(p => p.parent_id === page.id);
    const hasChildren = children.length > 0;
    const isExpanded = expanded[page.id];
    const isSelected = selectedId === page.id;

    return (
        <div>
            <div
                onClick={() => onSelect(page.id)}
                className={`w-full flex items-center gap-1.5 py-1.5 pr-2 rounded-lg text-left text-[12px] transition-all group cursor-pointer ${isSelected
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'text-muted hover:text-foreground hover:bg-hover-bg'
                }`}
                style={{ paddingLeft: `${8 + depth * 16}px` }}
            >
                {hasChildren ? (
                    <span
                        onClick={(e) => { e.stopPropagation(); onToggle(page.id); }}
                        className="w-4 h-4 flex items-center justify-center shrink-0 text-muted/50 hover:text-muted cursor-pointer"
                    >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </span>
                ) : (
                    <span className="w-4 shrink-0" />
                )}
                <span className="shrink-0 text-[11px]">{page.icon || '📄'}</span>
                <span className="truncate flex-1">{page.title}</span>
            </div>
            {hasChildren && isExpanded && (
                <div>
                    {children.sort((a, b) => a.order_index - b.order_index).map(child => (
                        <TreeItem
                            key={child.id}
                            page={child}
                            pages={pages}
                            selectedId={selectedId}
                            depth={depth + 1}
                            onSelect={onSelect}
                            onToggle={onToggle}
                            expanded={expanded}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Toolbar Button ───
function ToolBtn({ active, onClick, children, title }: {
    active?: boolean; onClick: () => void; children: React.ReactNode; title: string;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${active
                ? 'bg-accent/15 text-accent'
                : 'text-muted hover:text-foreground hover:bg-hover-bg'
            }`}
        >
            {children}
        </button>
    );
}

// ─── Main Page ───
export default function DocsPage() {
    const { effectiveUid } = useAuth();
    const [loading, setLoading] = useState(true);
    const [pages, setPages] = useState<DocPageMeta[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedDoc, setSelectedDoc] = useState<DocPage | null>(null);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [treeSearch, setTreeSearch] = useState('');
    const [editingTitle, setEditingTitle] = useState(false);

    // Save timer ref for debounced content save
    const saveTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    // Load pages
    useEffect(() => {
        if (!effectiveUid) return;
        (async () => {
            setLoading(true);
            const docs = await getDocPages(effectiveUid);
            setPages(docs);
            // Auto-expand root items
            const exp: Record<string, boolean> = {};
            docs.filter(d => !d.parent_id).forEach(d => { exp[d.id] = true; });
            setExpanded(exp);
            setLoading(false);
        })();
    }, [effectiveUid]);

    // Load doc content when selected
    useEffect(() => {
        if (!selectedId) { setSelectedDoc(null); return; }
        (async () => {
            const doc = await getDocContent(selectedId);
            setSelectedDoc(doc);
        })();
    }, [selectedId]);

    // TipTap editor
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Placeholder.configure({ placeholder: 'Escribe aqui... usa / para comandos' }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Highlight.configure({ multicolor: true }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            UnderlineExt,
            LinkExt.configure({ openOnClick: false }),
        ],
        content: selectedDoc?.content || '<p></p>',
        editorProps: {
            attributes: {
                class: 'prose prose-invert prose-sm max-w-none outline-none min-h-[400px] text-foreground',
            },
        },
        onUpdate: ({ editor }) => {
            if (!selectedId) return;
            // Debounce save
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(async () => {
                setSaving(true);
                await updateDocContent(selectedId, editor.getJSON());
                setSaving(false);
            }, 1000);
        },
    }, [selectedDoc?.id]); // Recreate editor when doc changes

    // Toggle tree node
    const toggleExpand = useCallback((id: string) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    }, []);

    // Create new page
    const handleNewPage = useCallback(async (parentId: string | null = null) => {
        if (!effectiveUid) return;
        const maxOrder = pages.filter(p => p.parent_id === parentId).reduce((max, p) => Math.max(max, p.order_index), -1);
        const newDoc = createEmptyDoc(effectiveUid, parentId, 'Nueva pagina', '📄', maxOrder + 1);
        await saveDocPage(newDoc);
        const { content, ...meta } = newDoc;
        setPages(prev => [...prev, meta]);
        setSelectedId(newDoc.id);
        if (parentId) setExpanded(prev => ({ ...prev, [parentId]: true }));
    }, [effectiveUid, pages]);

    // Delete page
    const handleDelete = useCallback(async () => {
        if (!selectedId || !effectiveUid) return;
        // Also delete children recursively
        const toDelete = [selectedId];
        const findChildren = (parentId: string) => {
            pages.filter(p => p.parent_id === parentId).forEach(p => {
                toDelete.push(p.id);
                findChildren(p.id);
            });
        };
        findChildren(selectedId);

        for (const id of toDelete) {
            await deleteDocPage(id);
        }
        setPages(prev => prev.filter(p => !toDelete.includes(p.id)));
        setSelectedId(null);
    }, [selectedId, pages, effectiveUid]);

    // Save title
    const handleTitleChange = useCallback(async (title: string) => {
        if (!selectedId) return;
        await updateDocTitle(selectedId, title);
        setPages(prev => prev.map(p => p.id === selectedId ? { ...p, title } : p));
        if (selectedDoc) setSelectedDoc({ ...selectedDoc, title });
    }, [selectedId, selectedDoc]);

    // Seed from Notion
    const handleSeedNotion = useCallback(async () => {
        if (!effectiveUid) return;
        setSeeding(true);
        const seeded = await seedFromNotion(effectiveUid, NOTION_SEED_STRUCTURE);
        const metas: DocPageMeta[] = seeded.map(({ content, ...meta }) => meta);
        setPages(prev => [...prev, ...metas]);
        // Expand root items
        const exp: Record<string, boolean> = {};
        metas.filter(d => !d.parent_id).forEach(d => { exp[d.id] = true; });
        setExpanded(prev => ({ ...prev, ...exp }));
        setSeeding(false);
    }, [effectiveUid]);

    // Filtered tree
    const rootPages = useMemo(() => {
        let filtered = pages;
        if (treeSearch) {
            const q = treeSearch.toLowerCase();
            const matchIds = new Set<string>();
            // Find matching pages and all their ancestors
            for (const p of pages) {
                if (p.title.toLowerCase().includes(q)) {
                    matchIds.add(p.id);
                    // Add ancestors
                    let current = p;
                    while (current.parent_id) {
                        matchIds.add(current.parent_id);
                        const parent = pages.find(pp => pp.id === current.parent_id);
                        if (!parent) break;
                        current = parent;
                    }
                }
            }
            filtered = pages.filter(p => matchIds.has(p.id));
        }
        return filtered.filter(p => !p.parent_id).sort((a, b) => a.order_index - b.order_index);
    }, [pages, treeSearch]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
                <p className="text-muted font-mono text-xs uppercase tracking-widest">Cargando documentos...</p>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-48px)] -m-3 md:-m-6">
            {/* ── Sidebar Tree ── */}
            <div className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-[260px] bg-card/50 md:border-r border-card-border flex-col shrink-0`}>
                {/* Header */}
                <div className="p-3 border-b border-card-border">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-accent" />
                            <span className="text-xs font-bold uppercase tracking-widest text-muted">Docs</span>
                        </div>
                        <button
                            onClick={() => handleNewPage(null)}
                            className="w-6 h-6 rounded-md bg-accent/10 text-accent flex items-center justify-center hover:bg-accent/20 transition-all"
                            title="Nueva pagina"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted/50" />
                        <input
                            value={treeSearch}
                            onChange={e => setTreeSearch(e.target.value)}
                            placeholder="Buscar pagina..."
                            className="w-full bg-hover-bg border border-card-border rounded-lg pl-7 pr-2 py-1.5 text-[11px] outline-none focus:border-accent/30 text-foreground placeholder:text-muted/40"
                        />
                    </div>
                </div>

                {/* Tree */}
                <div className="flex-1 overflow-y-auto p-2">
                    {rootPages.length === 0 && !treeSearch && (
                        <div className="text-center py-8 px-4">
                            <FileText className="w-8 h-8 text-muted/20 mx-auto mb-3" />
                            <p className="text-[11px] text-muted/50 mb-4">No hay documentos todavia</p>
                            <button
                                onClick={handleSeedNotion}
                                disabled={seeding}
                                className="flex items-center gap-2 mx-auto px-4 py-2 bg-accent/10 text-accent text-[11px] font-bold rounded-xl hover:bg-accent/20 transition-all border border-accent/20 disabled:opacity-50"
                            >
                                {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                Importar desde Notion
                            </button>
                        </div>
                    )}
                    {rootPages.map(page => (
                        <TreeItem
                            key={page.id}
                            page={page}
                            pages={pages}
                            selectedId={selectedId}
                            depth={0}
                            onSelect={setSelectedId}
                            onToggle={toggleExpand}
                            expanded={expanded}
                        />
                    ))}
                </div>

                {/* Bottom actions */}
                {pages.length > 0 && (
                    <div className="p-2 border-t border-card-border">
                        <button
                            onClick={() => handleNewPage(selectedId)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-muted hover:text-foreground hover:bg-hover-bg rounded-lg transition-all"
                        >
                            <Plus className="w-3 h-3" />
                            {selectedId ? 'Sub-pagina aqui' : 'Nueva pagina'}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Editor Area ── */}
            <div className="flex-1 flex flex-col min-w-0">
                {selectedDoc ? (
                    <>
                        {/* Toolbar */}
                        <div className="flex items-center gap-1 px-2 md:px-4 py-2 border-b border-card-border bg-card/30 shrink-0 flex-wrap overflow-x-auto">
                            {/* Mobile back button */}
                            <button onClick={() => setSelectedId(null)} className="md:hidden w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-foreground hover:bg-hover-bg mr-1 shrink-0">
                                <ChevronRight className="w-4 h-4 rotate-180" />
                            </button>
                            <ToolBtn active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()} title="Negrita">
                                <Bold className="w-3.5 h-3.5" />
                            </ToolBtn>
                            <ToolBtn active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()} title="Cursiva">
                                <Italic className="w-3.5 h-3.5" />
                            </ToolBtn>
                            <ToolBtn active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()} title="Subrayado">
                                <UnderlineIcon className="w-3.5 h-3.5" />
                            </ToolBtn>
                            <ToolBtn active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()} title="Tachado">
                                <Strikethrough className="w-3.5 h-3.5" />
                            </ToolBtn>
                            <ToolBtn active={editor?.isActive('highlight')} onClick={() => editor?.chain().focus().toggleHighlight().run()} title="Resaltar">
                                <Highlighter className="w-3.5 h-3.5" />
                            </ToolBtn>

                            <div className="w-px h-5 bg-card-border mx-1" />

                            <ToolBtn active={editor?.isActive('heading', { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} title="H1">
                                <Heading1 className="w-3.5 h-3.5" />
                            </ToolBtn>
                            <ToolBtn active={editor?.isActive('heading', { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="H2">
                                <Heading2 className="w-3.5 h-3.5" />
                            </ToolBtn>
                            <ToolBtn active={editor?.isActive('heading', { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} title="H3">
                                <Heading3 className="w-3.5 h-3.5" />
                            </ToolBtn>

                            <div className="w-px h-5 bg-card-border mx-1" />

                            <ToolBtn active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Lista">
                                <List className="w-3.5 h-3.5" />
                            </ToolBtn>
                            <ToolBtn active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()} title="Lista numerada">
                                <ListOrdered className="w-3.5 h-3.5" />
                            </ToolBtn>
                            <ToolBtn active={editor?.isActive('taskList')} onClick={() => editor?.chain().focus().toggleTaskList().run()} title="Checklist">
                                <CheckSquare className="w-3.5 h-3.5" />
                            </ToolBtn>

                            <div className="w-px h-5 bg-card-border mx-1" />

                            <ToolBtn active={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()} title="Cita">
                                <Quote className="w-3.5 h-3.5" />
                            </ToolBtn>
                            <ToolBtn active={editor?.isActive('codeBlock')} onClick={() => editor?.chain().focus().toggleCodeBlock().run()} title="Codigo">
                                <Code className="w-3.5 h-3.5" />
                            </ToolBtn>
                            <ToolBtn active={false} onClick={() => editor?.chain().focus().setHorizontalRule().run()} title="Separador">
                                <Minus className="w-3.5 h-3.5" />
                            </ToolBtn>

                            <div className="w-px h-5 bg-card-border mx-1" />

                            <ToolBtn active={false} onClick={() => editor?.chain().focus().undo().run()} title="Deshacer">
                                <Undo className="w-3.5 h-3.5" />
                            </ToolBtn>
                            <ToolBtn active={false} onClick={() => editor?.chain().focus().redo().run()} title="Rehacer">
                                <Redo className="w-3.5 h-3.5" />
                            </ToolBtn>

                            <div className="flex-1" />

                            {saving && <span className="text-[9px] text-muted/50 animate-pulse">Guardando...</span>}

                            <button
                                onClick={handleDelete}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                                title="Eliminar pagina"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Title + Content */}
                        <div className="flex-1 overflow-y-auto">
                            <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 md:py-8">
                                {/* Icon + Title */}
                                <div className="flex items-start gap-3 mb-6">
                                    <button
                                        className="text-3xl hover:bg-hover-bg rounded-lg p-1 transition-all shrink-0"
                                        title="Cambiar icono"
                                        onClick={() => {
                                            const icons = ['📄', '📝', '📋', '📌', '📎', '📊', '📈', '🎯', '💡', '🔍', '🔑', '📦', '🚀', '⚡', '🔥', '💰', '🎨', '📱', '🤖', '⭐'];
                                            const current = selectedDoc.icon || '📄';
                                            const idx = icons.indexOf(current);
                                            const next = icons[(idx + 1) % icons.length];
                                            updateDocIcon(selectedDoc.id, next);
                                            setSelectedDoc({ ...selectedDoc, icon: next });
                                            setPages(prev => prev.map(p => p.id === selectedDoc.id ? { ...p, icon: next } : p));
                                        }}
                                    >
                                        {selectedDoc.icon || '📄'}
                                    </button>
                                    <input
                                        className="text-3xl font-black bg-transparent border-none outline-none w-full text-foreground placeholder:text-muted/20"
                                        value={selectedDoc.title}
                                        placeholder="Sin titulo"
                                        onChange={e => setSelectedDoc({ ...selectedDoc, title: e.target.value })}
                                        onBlur={() => handleTitleChange(selectedDoc.title)}
                                    />
                                </div>

                                {/* Editor */}
                                <div className="docs-editor">
                                    <EditorContent editor={editor} />
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                        <FileText className="w-16 h-16 text-muted/10 mb-4" />
                        <h2 className="text-lg font-bold text-muted/30 mb-2">Selecciona un documento</h2>
                        <p className="text-xs text-muted/20 max-w-sm">
                            Elige una pagina del arbol o crea una nueva para empezar a escribir
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
