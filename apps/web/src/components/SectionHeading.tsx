import Link from 'next/link';

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
  light = false,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
  light?: boolean;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl space-y-2">
        <p className={`eyebrow ${light ? 'text-brand-400' : ''}`}>{eyebrow}</p>
        <h2 className={`text-3xl font-bold sm:text-4xl ${light ? 'text-white' : ''}`}>{title}</h2>
        {subtitle && <p className={light ? 'text-stone-300' : 'text-stone-600'}>{subtitle}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className={`shrink-0 text-sm font-semibold ${light ? 'text-brand-400 hover:text-brand-200' : 'text-brand-700 hover:text-brand-900'}`}
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}
