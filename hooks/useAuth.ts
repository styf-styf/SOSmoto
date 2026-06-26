import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import type { User } from '../types/database';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setSessionLoaded(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionLoaded) return;

    if (!session?.user) {
      setProfile(null);
      return;
    }

    let isCurrent = true;
    setProfileLoading(true);

    supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!isCurrent) return;
        if (error) {
          console.error('profile fetch error', error);
          setProfile(null);
        } else {
          setProfile(data as User);
        }
        setProfileLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [sessionLoaded, session?.user?.id]);

  const loading = !sessionLoaded || profileLoading;

  return { session, profile, loading };
}
