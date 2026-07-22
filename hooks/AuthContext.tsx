import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import type { User } from '../types/database';

// Marca liviana, propia de la app -- no es la sesión real (esa vive en el
// storage interno de supabase-js). Sirve para distinguir "nunca hubo sesión
// en este dispositivo" de "hubo sesión, ahora getSession() dice null". Ver
// el porqué en el efecto de abajo.
const HAD_SESSION_KEY = 'auth-had-session';

interface AuthContextValue {
  session: Session | null;
  profile: User | null;
  loading: boolean;
  // true cuando getSession() devuelve/rechaza sin sesión PERO este
  // dispositivo sí tuvo una antes -- el access token expiró y no se pudo
  // renovar por falta de red (getSession() intenta renovarlo internamente
  // si está vencido, y sin internet esa renovación falla). No es un cierre
  // de sesión real, así que no debe tratarse igual (ver app/index.tsx).
  sessionAmbiguous: boolean;
  retrySession: () => Promise<void>;
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
  const [sessionAmbiguous, setSessionAmbiguous] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSession(data.session);
        setSessionAmbiguous(false);
        AsyncStorage.setItem(HAD_SESSION_KEY, '1').catch(() => {});
      } else {
        // getSession() puede devolver session:null tanto si de verdad no hay
        // sesión como si el access token expiró y el intento de renovarlo
        // (que getSession() hace internamente cuando está vencido) falló por
        // falta de red -- en ambos casos el resultado es el mismo objeto
        // {session: null}, sin distinción. Si este dispositivo sí tuvo una
        // sesión antes, se asume que es el segundo caso.
        const hadSession = await AsyncStorage.getItem(HAD_SESSION_KEY).catch(() => null);
        setSession(null);
        setSessionAmbiguous(hadSession === '1');
      }
    } catch (err) {
      console.error('getSession rejected', err);
      const hadSession = await AsyncStorage.getItem(HAD_SESSION_KEY).catch(() => null);
      setSession(null);
      setSessionAmbiguous(hadSession === '1');
    } finally {
      setSessionLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setSessionLoaded(true);
      if (newSession) {
        setSessionAmbiguous(false);
        AsyncStorage.setItem(HAD_SESSION_KEY, '1').catch(() => {});
      } else if (event === 'SIGNED_OUT') {
        // Cierre de sesión real y explícito (el propio signOut(), o el token
        // fue revocado del lado del servidor) -- ahí sí se limpia la marca,
        // a diferencia de un simple fallo de red.
        setSessionAmbiguous(false);
        AsyncStorage.removeItem(HAD_SESSION_KEY).catch(() => {});
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadSession]);

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
    <AuthContext.Provider
      value={{ session, profile, loading, sessionAmbiguous, retrySession: loadSession, profileFetchError, refreshProfile }}
    >
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
