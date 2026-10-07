import { CURRENCY, type OrderStatus } from '@store/shared';

const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: CURRENCY });

export const formatPrice = (n: number) => currency.format(n);
export const shortId = (id: string) => `#${id.slice(-6).toUpperCase()}`;
export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function minutesAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

export const STATUS_COLORS: Record<OrderStatus, { bg: string; fg: string; accent: string }> = {
  'Awaiting Payment': { bg: '#e7e5e4', fg: '#44403c', accent: '#a8a29e' },
  Pending: { bg: '#fef3c7', fg: '#92400e', accent: '#f59e0b' },
  Confirmed: { bg: '#e0f2fe', fg: '#075985', accent: '#0ea5e9' },
  Preparing: { bg: '#e0e7ff', fg: '#3730a3', accent: '#6366f1' },
  'Out for Delivery': { bg: '#ede9fe', fg: '#5b21b6', accent: '#8b5cf6' },
  Delivered: { bg: '#d1fae5', fg: '#065f46', accent: '#10b981' },
  Cancelled: { bg: '#ffe4e6', fg: '#9f1239', accent: '#f43f5e' },
};
