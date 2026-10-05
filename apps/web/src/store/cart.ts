'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ProductDTO } from '@store/shared';

export interface CartItem {
  productId: string;
  title: string;
  price: number;
  image?: string;
  quantity: number;
  /** Stock at the time it was added; the API re-validates at checkout. */
  maxQuantity: number;
}

interface CartState {
  items: CartItem[];
  add: (p: ProductDTO, qty?: number) => void;
  setQuantity: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const clampQty = (qty: number, max: number) => Math.max(1, Math.min(qty, max, 99));

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (p, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.productId === p.id);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.productId === p.id
                  ? { ...i, quantity: clampQty(i.quantity + qty, p.stockQuantity), maxQuantity: p.stockQuantity }
                  : i,
              ),
            };
          }
          return {
            items: [
              ...s.items,
              {
                productId: p.id,
                title: p.title,
                price: p.price,
                image: p.images[0],
                quantity: clampQty(qty, p.stockQuantity),
                maxQuantity: p.stockQuantity,
              },
            ],
          };
        }),
      setQuantity: (productId, qty) =>
        set((s) => ({
          items: s.items.map((i) => (i.productId === productId ? { ...i, quantity: clampQty(qty, i.maxQuantity) } : i)),
        })),
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'store-cart', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0);
export const cartTotal = (items: CartItem[]) =>
  Math.round(items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100) / 100;
