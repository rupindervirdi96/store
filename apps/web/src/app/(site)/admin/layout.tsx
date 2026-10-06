'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';

const NAV = [
  { href: '/admin', label: 'Live orders' },
  { href: '/admin/products', label: 'Inventory' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <RequireAuth role="admin">
      <div className="space-y-6">
        <nav className="flex gap-1 border-b border-stone-200">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                pathname === n.href
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
