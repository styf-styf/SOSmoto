const TABS = [
  { href: '/usuarios', label: 'Usuarios' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/negocios', label: 'Negocios' },
] as const;

export function UsersSectionNav({ active }: { active: (typeof TABS)[number]['href'] }) {
  return (
    <div className="mb-4 flex gap-4 border-b border-gray-200">
      {TABS.map((tab) =>
        tab.href === active ? (
          <span key={tab.href} className="border-b-2 border-primary px-1 pb-2 text-sm font-semibold text-primary">
            {tab.label}
          </span>
        ) : (
          <a key={tab.href} href={tab.href} className="px-1 pb-2 text-sm font-medium text-gray-500">
            {tab.label}
          </a>
        )
      )}
    </div>
  );
}
