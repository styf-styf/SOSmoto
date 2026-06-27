'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) {
      setLoading(false);
      setError('No se pudo iniciar sesión: ' + (signInError?.message ?? 'credenciales inválidas'));
      return;
    }

    const { data: userRow } = await supabase.from('users').select('role').eq('id', data.user.id).maybeSingle();
    if (!userRow || userRow.role !== 'admin') {
      await supabase.auth.signOut({ scope: 'local' });
      setLoading(false);
      setError('Esta cuenta no tiene permisos de administrador.');
      return;
    }

    router.push('/usuarios');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-lg font-bold">SOSmoto · Admin</h1>
        <label className="mb-1 block text-sm font-medium text-gray-700">Correo electrónico</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Ingresando…' : 'Iniciar sesión'}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
