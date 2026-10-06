import { formatPrice } from '@/lib/format';

export const discountPercent = (price: number, compareAtPrice: number | null) =>
  compareAtPrice && compareAtPrice > price ? Math.round((1 - price / compareAtPrice) * 100) : 0;

export function Price({
  price,
  compareAtPrice,
  size = 'md',
}: {
  price: number;
  compareAtPrice: number | null;
  size?: 'md' | 'lg';
}) {
  const onSale = discountPercent(price, compareAtPrice) > 0;
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={`font-display font-bold ${size === 'lg' ? 'text-3xl' : 'text-lg'} ${onSale ? 'text-brand-700' : ''}`}>
        {formatPrice(price)}
      </span>
      {onSale && (
        <span className={`text-stone-400 line-through ${size === 'lg' ? 'text-lg' : 'text-sm'}`}>
          {formatPrice(compareAtPrice!)}
        </span>
      )}
    </span>
  );
}
