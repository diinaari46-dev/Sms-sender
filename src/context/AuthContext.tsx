import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { normalizeSomaliPhone, extractPhoneFromEmail } from '../lib/phone';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userPhone: string;
  signInWithPhone: (rawPhone: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithPhone: (rawPhone: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updatePassword: (newPass: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const userPhone = user
    ? extractPhoneFromEmail(user.email, (user.user_metadata as any)?.phone)
    : '';

  const signInWithPhone = async (rawPhone: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const norm = normalizeSomaliPhone(rawPhone);
    if (!norm.isValid) {
      return { success: false, error: 'invalid_phone' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: norm.fakeEmail,
        password: pass,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      setSession(data.session);
      setUser(data.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'unknown_error' };
    }
  };

  const signUpWithPhone = async (rawPhone: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const norm = normalizeSomaliPhone(rawPhone);
    if (!norm.isValid) {
      return { success: false, error: 'invalid_phone' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: norm.fakeEmail,
        password: pass,
        options: {
          data: {
            phone: norm.normalized,
            phone_digits: norm.digitsOnly,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.user);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'unknown_error' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const updatePassword = async (newPass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPass,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'unknown_error' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        userPhone,
        signInWithPhone,
        signUpWithPhone,
        signOut,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
