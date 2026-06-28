// La lógica real vive en AuthContext.tsx (un solo AuthProvider compartido en
// app/_layout.tsx) -- este archivo se mantiene para no tener que tocar los
// 33 puntos del código que importan `useAuth` desde aquí.
export { useAuth } from './AuthContext';
