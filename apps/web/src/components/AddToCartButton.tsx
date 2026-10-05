'use client';

import { useState } from 'react';
import type { ProductDTO } from '@store/shared';
import { useCart } from '@/store/cart';

export function AddToCartButton({ product, compact }: { product: ProductDTO; compact?: boolean }) {
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);
  const outOfStock = product.stockQuantity <= 0;

  return (
    <button
      className={compact ? 'btn-secondary px-3 py-1.5' : 'btn-primary w-full py-3'}
      disabled={outOfStock}
      onClick={() => {
        add(product);
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
    >
      {outOfStock ? 'Sold out' : added ? 'Added ✓' : compact ? 'Add' : 'Add to cart'}
    </button>
  );
}
