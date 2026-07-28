'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Sidebar({ navItems }: { navItems: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {navItems.map((item) => {
        // /negocios vive fuera de /usuarios (rutas hermanas), pero son la
        // misma sección para el usuario (pestañas Usuarios/Negocios de la
        // misma pantalla) -- se resalta igual el link de "Usuarios".
        const active =
          pathname === item.href ||
          pathname.startsWith(`${item.href}/`) ||
          (item.href === '/usuarios' && (pathname === '/negocios' || pathname.startsWith('/negocios/')));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? 'rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary'
                : 'rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100'
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
