'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    onAuthStateChanged,
    User,
    signOut as firebaseSignOut
} from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { getUserProfile } from '@/lib/firebase/firestore';

export interface UserProfile {
    user_id: string;
    email: string;
    role: 'admin' | 'viewer';
    display_name: string;
    created_at: string;
    stripeCustomerId?: string;
    subscriptionId?: string;
    plan?: string;
    subscriptionStatus?: string;
    currentPeriodEnd?: any;
    team_id?: string;
    allowed_modules?: string[];
    created_by?: string;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    /** team_id for shared data (team_id || user.uid). Use this for ALL data queries. */
    effectiveUid: string | null;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    loading: true,
    effectiveUid: null,
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setUser(user);

            if (user) {
                try {
                    const userProfile = await getUserProfile(user.uid);
                    setProfile(userProfile as UserProfile);
                } catch (error) {
                    console.error('Error fetching user profile:', error);
                    setProfile(null);
                }
            } else {
                setProfile(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    // effectiveUid: for admins = own uid, for viewers = admin's team_id
    const effectiveUid = profile?.team_id || user?.uid || null;

    return (
        <AuthContext.Provider value={{ user, profile, loading, effectiveUid, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};
