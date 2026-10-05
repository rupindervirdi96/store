import type { OrderStatus } from '@store/shared';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export const formatPrice = (n: number) => currency.format(n);
export const formatDateTime = (iso: string) => new Date(iso).toLocaleString();
export const shortId = (id: string) => `#${id.slice(-6).toUpperCase()}`;

export const STATUS_COLORS: Record<OrderStatus, { bg: string; fg: string }> = {
  Pending: { bg: '#fef3c7', fg: '#92400e' },
  Confirmed: { bg: '#e0f2fe', fg: '#075985' },
  Preparing: { bg: '#e0e7ff', fg: '#3730a3' },
  'Out for Delivery': { bg: '#ede9fe', fg: '#5b21b6' },
  Delivered: { bg: '#d1fae5', fg: '#065f46' },
  Cancelled: { bg: '#ffe4e6', fg: '#9f1239' },
};
