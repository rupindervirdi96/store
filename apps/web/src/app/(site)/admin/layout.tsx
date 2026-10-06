'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';

const NAV = [
  { href: '/admin', label: 'Live orders', match: (p: string) => p === '/admin' },
  { href: '/admin/menu', label: 'Menu', match: (p: string) => p.startsWith('/admin/menu') },
  { href: '/admin/categories', label: 'Categories', match: (p: string) => p.startsWith('/admin/categories') },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <RequireAuth role="admin">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Admin</p>
        </div>
        <nav className="-mt-4 flex gap-1 overflow-x-auto border-b border-stone-200">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                n.match(pathname)
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </RequireAuth>
  );
}
