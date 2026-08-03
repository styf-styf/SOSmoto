import { createAdminClient } from '../../../lib/supabase/admin';
import type { AdminUserRow } from '../../../lib/types';
import { Paginator } from '../../../components/Paginator';
import { UsersSectionNav } from '../../../components/UsersSectionNav';
import { UserActions } from '../usuarios/UserActions';

const PAGE_SIZE = 25;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const q = searchParams.q?.trim() ?? '';
  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createAdminClient();
  let query = supabase
    .from('users')
    .select('id, email, phone, full_name, role, is_limited, limitation_reason, created_at', { count: 'exact' })
    .eq('role', 'client')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);

  const { data, count, error } = await query;
  const users = (data ?? []) as AdminUserRow[];
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Usuarios</h1>

      <UsersSectionNav active="/clientes" />

      <form method="get" className="mb-4 flex gap-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o email"
          className="w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
          Buscar
        </button>
      </form>

      {error && <p className="text-sm text-red-600">Error cargando clientes: {error.message}</p>}

      <table className="w-full border-collapse overflow-hidden rounded-xl bg-white text-sm shadow-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Teléfono</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Registrado</th>
            <th className="px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-gray-100">
              <td className="px-4 py-3 font-medium">{user.full_name || '(sin nombre)'}</td>
              <td className="px-4 py-3">{user.email}</td>
              <td className="px-4 py-3">{user.phone ?? '—'}</td>
              <td className="px-4 py-3">
                <span className={user.is_limited ? 'text-amber-600' : 'text-green-700'}>
                  {user.is_limited ? 'Limitado' : 'Activo'}
                </span>
                {user.is_limited && user.limitation_reason && (
                  <p className="mt-1 max-w-[220px] text-xs text-gray-500">{user.limitation_reason}</p>
                )}
              </td>
              <td className="px-4 py-3">{new Date(user.created_at).toLocaleDateString('es-EC')}</td>
              <td className="px-4 py-3">
                <UserActions userId={user.id} isLimited={user.is_limited} isAdmin={false} />
              </td>
            </tr>
          ))}
          {users.length === 0 && !error && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                No se encontraron clientes.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Paginator
        page={page}
        totalPages={totalPages}
        buildHref={(p) => `?q=${encodeURIComponent(q)}&page=${p}`}
      />
    </div>
  );
}
