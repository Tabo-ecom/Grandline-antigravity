'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Shield, Loader2, Trash2, Pencil, X, Check, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { auth } from '@/lib/firebase/config';
import { ALL_MODULES } from '@/lib/constants/modules';

interface TeamUser {
    user_id: string;
    email: string;
    display_name: string;
    role: 'admin' | 'viewer';
    allowed_modules: string[];
    created_at: any;
    created_by?: string;
}

export default function UsuariosPage() {
    const { user, profile } = useAuth();
    const [users, setUsers] = useState<TeamUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Create form
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<'admin' | 'viewer'>('viewer');
    const [newModules, setNewModules] = useState<string[]>([]);
    const [showPassword, setShowPassword] = useState(false);

    // Edit state
    const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
    const [editRole, setEditRole] = useState<'admin' | 'viewer'>('viewer');
    const [editModules, setEditModules] = useState<string[]>([]);
    const [editName, setEditName] = useState('');

    const getAuthToken = useCallback(async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('No autenticado');
        return currentUser.getIdToken();
    }, []);

    const loadUsers = useCallback(async () => {
        try {
            const token = await getAuthToken();
            const res = await fetch('/api/users/list', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setUsers(data.users || []);
        } catch (err: any) {
            console.error('Error loading users:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [getAuthToken]);

    useEffect(() => {
        if (user && profile?.role === 'admin') {
            loadUsers();
        } else {
            setLoading(false);
        }
    }, [user, profile, loadUsers]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName || !newEmail || !newPassword) return;

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const token = await getAuthToken();
            const res = await fetch('/api/users/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    email: newEmail,
                    password: newPassword,
                    displayName: newName,
                    role: newRole,
                    allowedModules: newRole === 'admin' ? [] : newModules,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSuccess(`Usuario ${newName} creado exitosamente`);
            setNewName('');
            setNewEmail('');
            setNewPassword('');
            setNewRole('viewer');
            setNewModules([]);
            setTimeout(() => setSuccess(null), 4000);
            await loadUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingUser) return;

        setSaving(true);
        setError(null);

        try {
            const token = await getAuthToken();
            const res = await fetch('/api/users/update', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    userId: editingUser.user_id,
                    role: editRole,
                    allowedModules: editRole === 'admin' ? [] : editModules,
                    displayName: editName,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setEditingUser(null);
            setSuccess('Usuario actualizado');
            setTimeout(() => setSuccess(null), 3000);
            await loadUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (targetUser: TeamUser) => {
        if (!window.confirm(`¿Eliminar a ${targetUser.display_name} (${targetUser.email})? Esta acción no se puede deshacer.`)) return;

        setSaving(true);
        setError(null);

        try {
            const token = await getAuthToken();
            const res = await fetch('/api/users/delete', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ userId: targetUser.user_id }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSuccess(`${targetUser.display_name} eliminado`);
            setTimeout(() => setSuccess(null), 3000);
            await loadUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const openEdit = (u: TeamUser) => {
        setEditingUser(u);
        setEditRole(u.role);
        setEditModules(u.allowed_modules || []);
        setEditName(u.display_name);
    };

    const toggleModule = (moduleId: string, current: string[], setter: (v: string[]) => void) => {
        setter(current.includes(moduleId) ? current.filter(m => m !== moduleId) : [...current, moduleId]);
    };

    if (profile?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Shield className="w-12 h-12 text-muted mb-4" />
                <p className="text-muted text-sm">No tienes permisos para acceder a esta sección.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
                <p className="text-muted font-mono text-xs uppercase tracking-widest">Cargando Tripulación...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-['Space_Grotesk']">Gestión de Equipo</h1>
                <p className="text-muted mt-1">Administra los miembros de tu equipo y sus permisos de acceso.</p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in">
                    <X className="w-5 h-5 text-red-400 shrink-0 cursor-pointer" onClick={() => setError(null)} />
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in">
                    <Check className="w-5 h-5 text-green-400 shrink-0" />
                    <p className="text-sm text-green-400">{success}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Team Members List */}
                <div className="lg:col-span-3 bg-card border border-card-border p-6 rounded-3xl">
                    <div className="flex items-center gap-3 mb-6">
                        <Users className="w-5 h-5 text-accent" />
                        <h3 className="font-bold uppercase tracking-widest text-sm italic text-accent">Miembros del Equipo</h3>
                        <span className="ml-auto text-[10px] font-bold text-muted bg-hover-bg px-2 py-1 rounded-lg border border-card-border">
                            {users.length} {users.length === 1 ? 'miembro' : 'miembros'}
                        </span>
                    </div>

                    <div className="space-y-3">
                        {users.map((u) => {
                            const isOwner = u.user_id === user?.uid;
                            const isEditing = editingUser?.user_id === u.user_id;

                            return (
                                <div key={u.user_id} className={`p-4 rounded-2xl border transition-all ${isEditing ? 'bg-accent/5 border-accent/20' : 'bg-hover-bg border-card-border'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                            {u.display_name?.charAt(0).toUpperCase() || u.email?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-foreground truncate">{u.display_name}</p>
                                                {isOwner && (
                                                    <span className="text-[9px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">TÚ</span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-muted truncate">{u.email}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${u.role === 'admin' ? 'bg-accent/20 text-accent' : 'bg-blue-500/20 text-blue-400'}`}>
                                            {u.role}
                                        </span>
                                        {!isOwner && (
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => isEditing ? setEditingUser(null) : openEdit(u)}
                                                    className="p-2 rounded-lg hover:bg-hover-bg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-3.5 h-3.5 text-muted" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(u)}
                                                    disabled={saving}
                                                    className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 text-red-400/60" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Module chips */}
                                    {u.role !== 'admin' && u.allowed_modules && u.allowed_modules.length > 0 && !isEditing && (
                                        <div className="flex flex-wrap gap-1.5 mt-3 ml-14">
                                            {u.allowed_modules.map(moduleId => {
                                                const mod = ALL_MODULES.find(m => m.id === moduleId);
                                                return mod ? (
                                                    <span key={moduleId} className="text-[9px] font-bold text-muted bg-hover-bg border border-card-border px-2 py-0.5 rounded-lg">
                                                        {mod.name}
                                                    </span>
                                                ) : null;
                                            })}
                                        </div>
                                    )}

                                    {u.role !== 'admin' && (!u.allowed_modules || u.allowed_modules.length === 0) && !isEditing && (
                                        <p className="text-[10px] text-muted italic mt-2 ml-14">Acceso completo (sin restricciones)</p>
                                    )}

                                    {/* Edit Form */}
                                    {isEditing && (
                                        <div className="mt-4 ml-14 space-y-4 border-t border-card-border pt-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Nombre</label>
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="w-full bg-hover-bg border border-card-border rounded-xl px-3 py-2 text-sm focus:border-accent outline-none transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Rol</label>
                                                <select
                                                    value={editRole}
                                                    onChange={(e) => setEditRole(e.target.value as any)}
                                                    className="w-full bg-hover-bg border border-card-border rounded-xl px-3 py-2 text-sm focus:border-accent outline-none transition-colors"
                                                >
                                                    <option value="viewer">Viewer</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            </div>
                                            {editRole === 'viewer' && (
                                                <div>
                                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 block">Módulos Permitidos</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {ALL_MODULES.map(mod => (
                                                            <label key={mod.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-xs ${editModules.includes(mod.id) ? 'bg-accent/10 border border-accent/20 text-accent font-bold' : 'bg-hover-bg border border-card-border text-muted hover:text-foreground'}`}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={editModules.includes(mod.id)}
                                                                    onChange={() => toggleModule(mod.id, editModules, setEditModules)}
                                                                    className="w-3.5 h-3.5 accent-[#d75c33]"
                                                                />
                                                                {mod.name}
                                                            </label>
                                                        ))}
                                                    </div>
                                                    <p className="text-[9px] text-muted mt-1 italic">Si no seleccionas ninguno, el usuario tendrá acceso a todos los módulos.</p>
                                                </div>
                                            )}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleUpdate}
                                                    disabled={saving}
                                                    className="flex-1 bg-accent text-white font-bold py-2 rounded-xl text-xs uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                    Guardar
                                                </button>
                                                <button
                                                    onClick={() => setEditingUser(null)}
                                                    className="px-4 py-2 rounded-xl text-xs font-bold text-muted border border-card-border hover:bg-hover-bg transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {users.length === 0 && (
                            <div className="text-center py-12 border border-dashed border-card-border rounded-2xl">
                                <Users className="w-10 h-10 text-muted/30 mx-auto mb-3" />
                                <p className="text-xs text-muted italic">No hay miembros en tu equipo todavía.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Create User Form */}
                <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleCreate} className="bg-card border border-card-border p-6 rounded-3xl space-y-5">
                        <div className="flex items-center gap-3">
                            <UserPlus className="w-5 h-5 text-emerald-400" />
                            <h3 className="font-bold uppercase tracking-widest text-sm italic text-emerald-400">Nuevo Miembro</h3>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 block">Nombre</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full bg-hover-bg border border-card-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-colors"
                                placeholder="Juan Pérez"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 block">Email</label>
                            <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                className="w-full bg-hover-bg border border-card-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-colors font-mono"
                                placeholder="equipo@empresa.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 block">Contraseña</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-hover-bg border border-card-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-colors font-mono pr-10"
                                    placeholder="Mínimo 6 caracteres"
                                    minLength={6}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 block">Rol</label>
                            <select
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value as any)}
                                className="w-full bg-hover-bg border border-card-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-colors"
                            >
                                <option value="viewer">Viewer — Solo lectura</option>
                                <option value="admin">Admin — Acceso total</option>
                            </select>
                        </div>

                        {newRole === 'viewer' && (
                            <div>
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 block">Módulos Permitidos</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {ALL_MODULES.map(mod => (
                                        <label key={mod.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all text-xs ${newModules.includes(mod.id) ? 'bg-accent/10 border border-accent/20 text-accent font-bold' : 'bg-hover-bg border border-card-border text-muted hover:text-foreground'}`}>
                                            <input
                                                type="checkbox"
                                                checked={newModules.includes(mod.id)}
                                                onChange={() => toggleModule(mod.id, newModules, setNewModules)}
                                                className="w-4 h-4 accent-[#d75c33]"
                                            />
                                            {mod.name}
                                        </label>
                                    ))}
                                </div>
                                <p className="text-[9px] text-muted mt-2 italic leading-relaxed">
                                    Si no seleccionas ningún módulo, el usuario podrá ver todos. Selecciona los específicos para restringir el acceso.
                                </p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={saving || !newName || !newEmail || !newPassword}
                            className="w-full bg-accent text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                            Crear Usuario
                        </button>
                    </form>

                    <div className="bg-blue-500/5 border border-blue-500/20 p-5 rounded-2xl">
                        <div className="flex gap-3">
                            <Shield className="w-5 h-5 text-blue-400 shrink-0" />
                            <div>
                                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Sobre los Roles</h4>
                                <ul className="text-[10px] text-muted space-y-1.5 leading-relaxed">
                                    <li><strong className="text-foreground/80">Admin:</strong> Acceso total a todos los módulos, configuración y gestión de equipo.</li>
                                    <li><strong className="text-foreground/80">Viewer:</strong> Acceso limitado a los módulos seleccionados. No puede editar configuración ni usuarios.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
