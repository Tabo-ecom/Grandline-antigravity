'use client';

import React, { useState, useRef } from 'react';
import { Camera, Save, Loader2, User, Mail, Shield, Building2, Check } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import type { UserProfile } from '@/lib/context/AuthContext';
import { db, storage } from '@/lib/firebase/config';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function PerfilPage() {
    const { user, profile, refreshProfile } = useAuth();
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [displayName, setDisplayName] = useState((profile as UserProfile)?.display_name || '');
    const [avatarUrl, setAvatarUrl] = useState((profile as UserProfile)?.avatar_url || '');
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const email = user?.email || '';
    const role = (profile as UserProfile)?.role || 'viewer';
    const plan = (profile as UserProfile)?.plan || 'free';

    const handleSave = async () => {
        if (!user?.uid) return;
        setSaving(true);
        await setDoc(doc(db, 'user_profiles', user.uid), {
            display_name: displayName,
            avatar_url: avatarUrl,
            updated_at: new Date(),
        }, { merge: true });
        await refreshProfile();
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.uid) return;

        setUploading(true);
        try {
            // Resize image before upload
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.src = URL.createObjectURL(file);
            await new Promise(r => { img.onload = r; });

            const size = 256;
            canvas.width = size;
            canvas.height = size;
            const scale = Math.max(size / img.width, size / img.height);
            const x = (size - img.width * scale) / 2;
            const y = (size - img.height * scale) / 2;
            ctx?.drawImage(img, x, y, img.width * scale, img.height * scale);

            const blob = await new Promise<Blob>((resolve) => {
                canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.85);
            });

            const storageRef = ref(storage, `avatars/${user.uid}.jpg`);
            await uploadBytes(storageRef, blob);
            const url = await getDownloadURL(storageRef);
            setAvatarUrl(url);

            // Save immediately
            await setDoc(doc(db, 'user_profiles', user.uid), { avatar_url: url, updated_at: new Date() }, { merge: true });
            await refreshProfile();
        } catch (err) {
            console.error('Avatar upload error:', err);
        }
        setUploading(false);
    };

    const initials = displayName ? displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : email.charAt(0).toUpperCase();

    return (
        <div className="max-w-lg mx-auto py-8 px-4">
            <h1 className="text-2xl font-black tracking-tight mb-8">Mi Perfil</h1>

            {/* Avatar */}
            <div className="flex flex-col items-center mb-8">
                <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-28 h-28 rounded-2xl object-cover border-2 border-card-border" />
                    ) : (
                        <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center text-3xl font-black text-white">
                            {initials}
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
                    </div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <p className="text-[11px] text-muted mt-2">Click para cambiar foto</p>
            </div>

            {/* Fields */}
            <div className="space-y-5">
                <div>
                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" /> Nombre
                    </label>
                    <input
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        className="w-full bg-card border border-card-border rounded-xl px-4 py-3 text-sm outline-none focus:border-accent/30 transition-all text-foreground"
                        placeholder="Tu nombre completo"
                    />
                </div>

                <div>
                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" /> Email
                    </label>
                    <div className="w-full bg-card border border-card-border rounded-xl px-4 py-3 text-sm text-muted">
                        {email}
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" /> Rol
                    </label>
                    <div className="bg-card border border-card-border rounded-xl px-4 py-3 text-sm capitalize text-foreground">
                        {role}
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-white font-bold rounded-xl hover:bg-accent/90 transition-all disabled:opacity-50 text-sm"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {saved ? 'Guardado' : 'Guardar Cambios'}
                </button>
            </div>
        </div>
    );
}
