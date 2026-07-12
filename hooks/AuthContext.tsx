import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import type { User } from '../types/database';

interface AuthContextValue {
  session: Session | null;
  profile: User | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Una sola suscripción a Supabase + un solo fetch de perfil para toda la app
// -- antes cada pantalla llamaba su propio useAuth() de forma independiente
// (33 instancias), lo que permitía que al cambiar de cuenta (cliente -> taller)
// distintas pantallas resolvieran el nuevo perfil en momentos distintos y se
// vieran datos mezclados de ambas cuentas mientras la navegación se
// reacomodaba. Con un único Provider, todas las pantallas leen exactamente
// el mismo estado al mismo tiempo.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  // Arranca en `true` (no `false`) -- entre el momento en que `sessionLoaded`
  // pasa a `true` y el efecto de abajo (que depende de `sessionLoaded`)
  // alcanza a correr, hay un render intermedio donde `session` ya existe
  // pero `profile` todavía es `null`. Si `profileLoading` arrancara en
  // `false`, ese render intermedio calcula `loading = false` con sesión
  // pero sin perfil -- exactamente la forma que usan las pantallas
  // (`app/index.tsx`, `app/post|ad/[id].tsx`) para decidir "no hay sesión,
  // manda a login". Normalmente ese render intermedio dura tan poco que no
  // se nota, pero al abrir la app en frío directo a una pantalla de deep
  // link se volvió visible (mandaba a login a un usuario que sí tenía
  // sesión activa).
  const [profileLoading, setProfileLoading] = useState(true);

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
      setProfileLoading(false);
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

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const { data, error } = await supabase.from('users').select('*').eq('id', session.user.id).single();
    if (!error && data) setProfile(data as User);
  }, [session?.user?.id]);

  return <AuthContext.Provider value={{ session, profile, loading, refreshProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
