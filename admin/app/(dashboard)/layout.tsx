import { redirect } from 'next/navigation';
import { requireAdmin } from '../../lib/requireAdmin';
import { Sidebar } from './Sidebar';
import { SignOutButton } from './SignOutButton';

const navItems = [
  { href: '/usuarios', label: 'Usuarios' },
  { href: '/eliminacion-cuentas', label: 'Eliminación de cuentas' },
  { href: '/kyc', label: 'Verificación (KYC)' },
  { href: '/suscripciones', label: 'Suscripciones' },
  { href: '/promociones', label: 'Promociones' },
  { href: '/campanas', label: 'Publicidad' },
  { href: '/correos', label: 'Correos' },
  { href: '/categorias', label: 'Categorías' },
  { href: '/moderacion', label: 'Moderación' },
  { href: '/auxilio', label: 'Auxilio en carretera' },
  { href: '/metricas', label: 'Métricas' },
  { href: '/configuracion', label: 'Configuración' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 flex-shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white p-4">
        <h1 className="mb-6 text-base font-bold">SOSmoto · Admin</h1>
        <Sidebar navItems={navItems} />
        <div className="border-t border-gray-200 pt-3">
          <p className="mb-2 truncate text-xs text-gray-500">{admin.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
