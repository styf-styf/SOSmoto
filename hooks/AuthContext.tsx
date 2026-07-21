import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import type { User } from '../types/database';

interface AuthContextValue {
  session: Session | null;
  profile: User | null;
  loading: boolean;
  // true solo cuando el fetch del perfil rechazó (sin red) -- distinto de un
  // fetch que resolvió con un error real (perfil no encontrado/sin permiso).
  // Deja que las pantallas que deciden "sin sesión -> a login" (app/index.tsx,
  // los resolvers de deep link) no confundan "no hay sesión" con "no se pudo
  // preguntar" -- ver el comentario en el efecto de abajo.
  profileFetchError: boolean;
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
  const [profileFetchError, setProfileFetchError] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(
      ({ data }) => {
        setSession(data.session);
        setSessionLoaded(true);
      },
      (err: unknown) => {
        console.error('getSession rejected', err);
        setSessionLoaded(true);
      }
    );

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
      setProfileFetchError(false);
      setProfileLoading(false);
      return;
    }

    let isCurrent = true;
    setProfileLoading(true);
    setProfileFetchError(false);

    supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(
        ({ data, error }) => {
          if (!isCurrent) return;
          if (error) {
            console.error('profile fetch error', error);
            setProfile(null);
          } else {
            setProfile(data as User);
          }
          setProfileLoading(false);
        },
        (err: unknown) => {
          // Si el thenable de Supabase llega a rechazar en vez de resolver
          // {error} (poco común, pero no imposible con fallas de red de bajo
          // nivel) -- sin este handler, profileLoading se quedaba en true
          // para siempre y toda la app mostraba el spinner de carga sin fin.
          // A diferencia de un error resuelto (el servidor sí respondió: no
          // hay perfil, no hay permiso), un rechazo significa que ni siquiera
          // se pudo contactar al servidor -- no sabemos si el perfil existe,
          // así que no se debe tratar igual que "no hay sesión" (ver
          // app/index.tsx, que antes mandaba a login a un usuario logueado
          // solo porque no tenía internet).
          if (!isCurrent) return;
          console.error('profile fetch rejected', err);
          setProfileFetchError(true);
          setProfileLoading(false);
        }
      );

    return () => {
      isCurrent = false;
    };
  }, [sessionLoaded, session?.user?.id]);

  const loading = !sessionLoaded || profileLoading;

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      if (error) {
        console.error('refreshProfile error', error);
        return;
      }
      setProfile(data as User);
      setProfileFetchError(false);
    } catch (err) {
      console.error('refreshProfile rejected', err);
      setProfileFetchError(true);
    }
  }, [session?.user?.id]);

  return (
    <AuthContext.Provider value={{ session, profile, loading, profileFetchError, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
