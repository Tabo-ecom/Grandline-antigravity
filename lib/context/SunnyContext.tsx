"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

export interface StoreProfile {
    id: string;
    name: string;
    country: string;
    pixelId: string;
    pageId: string;
    defaultAccountId?: string;
    currency: string;
}

// ExclusionList interface defined elsewhere

export interface ExclusionList {
    id: string;
    name: string;
    locations: string; // Comma separated list of zip codes or names
    country: string;
}

interface SunnyContextType {
    storeProfiles: StoreProfile[];
    selectedStoreId: string | null;
    setSelectedStoreId: (id: string | null) => void;
    activeStore: StoreProfile | null;
    loading: boolean;
    addStoreProfile: (profile: Omit<StoreProfile, 'id'>) => Promise<void>;
    updateStoreProfile: (id: string, profile: Partial<StoreProfile>) => Promise<void>;
    deleteStoreProfile: (id: string) => Promise<void>;
    exclusionLists: ExclusionList[];
    addExclusionList: (list: Omit<ExclusionList, 'id'>) => Promise<void>;
    updateExclusionList: (id: string, list: Partial<ExclusionList>) => Promise<void>;
    deleteExclusionList: (id: string) => Promise<void>;
    namingTemplate: string;
    setNamingTemplate: (template: string) => Promise<void>;
}

const SunnyContext = createContext<SunnyContextType | undefined>(undefined);

export function SunnyProvider({ children }: { children: React.ReactNode }) {
    const { user, effectiveUid } = useAuth();
    const [storeProfiles, setStoreProfiles] = useState<StoreProfile[]>([]);
    const [exclusionLists, setExclusionLists] = useState<ExclusionList[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [namingTemplate, setNamingTemplateState] = useState('[País] - [Estrategia] - [Producto] - [Fecha] - [Buyer]');

    const activeStore = storeProfiles.find(s => s.id === selectedStoreId) || null;

    useEffect(() => {
        if (!effectiveUid) {
            setStoreProfiles([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        // Listen to Store Profiles (use effectiveUid for team data sharing)
        const profilesQuery = query(collection(db, 'sunny_profiles'), where('userId', '==', effectiveUid));
        const unsubscribeProfiles = onSnapshot(profilesQuery, (snapshot) => {
            const profiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreProfile));
            setStoreProfiles(profiles);
            if (profiles.length > 0 && !selectedStoreId) {
                setSelectedStoreId(profiles[0].id);
            }
            setLoading(false);
        }, (error: Error) => {
            console.error("Error listening to store profiles:", error);
            setLoading(false);
        });

        // Listen to Exclusion Lists
        const exclusionsQuery = query(collection(db, 'sunny_exclusions'), where('userId', '==', effectiveUid));
        const unsubscribeExclusions = onSnapshot(exclusionsQuery, (snapshot) => {
            const lists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExclusionList));
            setExclusionLists(lists);
        }, (error: Error) => {
            console.error("Error listening to exclusion lists:", error);
        });

        return () => {
            unsubscribeProfiles();
            unsubscribeExclusions();
        };
    }, [effectiveUid]);

    // Load naming template from Firestore
    useEffect(() => {
        if (!effectiveUid) return;
        const docRef = doc(db, 'sunny_settings', effectiveUid);
        const unsub = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.namingTemplate) setNamingTemplateState(data.namingTemplate);
            }
        });
        return () => unsub();
    }, [effectiveUid]);

    const setNamingTemplate = async (template: string) => {
        setNamingTemplateState(template);
        if (!effectiveUid) return;
        const docRef = doc(db, 'sunny_settings', effectiveUid);
        await setDoc(docRef, { namingTemplate: template }, { merge: true });
    };

    const addStoreProfile = async (profile: Omit<StoreProfile, 'id'>) => {
        if (!effectiveUid) return;
        const newDocRef = doc(collection(db, 'sunny_profiles'));
        await setDoc(newDocRef, { ...profile, userId: effectiveUid, createdAt: Date.now() });
    };

    const updateStoreProfile = async (id: string, profile: Partial<StoreProfile>) => {
        const docRef = doc(db, 'sunny_profiles', id);
        await setDoc(docRef, profile, { merge: true });
    };

    const deleteStoreProfile = async (id: string) => {
        await deleteDoc(doc(db, 'sunny_profiles', id));
        if (selectedStoreId === id) setSelectedStoreId(null);
    };

    return (
        <SunnyContext.Provider value={{
            storeProfiles,
            selectedStoreId,
            setSelectedStoreId,
            activeStore,
            loading,
            addStoreProfile,
            updateStoreProfile,
            deleteStoreProfile,
            exclusionLists,
            addExclusionList: async (list) => {
                if (!user) return;
                const newDocRef = doc(collection(db, 'sunny_exclusions'));
                await setDoc(newDocRef, { ...list, userId: user.uid, createdAt: Date.now() });
            },
            updateExclusionList: async (id, list) => {
                const docRef = doc(db, 'sunny_exclusions', id);
                await setDoc(docRef, list, { merge: true });
            },
            deleteExclusionList: async (id) => {
                await deleteDoc(doc(db, 'sunny_exclusions', id));
            },
            namingTemplate,
            setNamingTemplate,
        }}>
            {children}
        </SunnyContext.Provider>
    );
}

export function useSunny() {
    const context = useContext(SunnyContext);
    if (context === undefined) {
        throw new Error('useSunny must be used within a SunnyProvider');
    }
    return context;
}
