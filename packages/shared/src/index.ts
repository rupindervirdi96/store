/**
 * Contracts shared by the API, web storefront, admin dashboard and mobile app.
 * Anything that crosses the network boundary (enums, DTO shapes, socket event
 * names) lives here so every client stays in lockstep with the backend.
 */

export const ROLES = ['customer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ORDER_STATUSES = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Allowed forward transitions. Delivered and Cancelled are terminal. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Preparing', 'Cancelled'],
  Preparing: ['Out for Delivery', 'Cancelled'],
  'Out for Delivery': ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

/** Happy-path progression, used by clients to draw a tracking timeline. */
export const ORDER_PROGRESS: readonly OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Out for Delivery',
  'Delivered',
];

export const PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed', 'Refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SOCKET_EVENTS = {
  /** server -> admins: a new order was placed */
  ORDER_CREATED: 'order:created',
  /** server -> admins + owning customer: status or payment changed */
  ORDER_UPDATED: 'order:updated',
  /** server -> admins: stock level changed (inventory board) */
  PRODUCT_STOCK_CHANGED: 'product:stock',
} as const;

export interface Address {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: Role;
  addresses: Address[];
  createdAt: string;
}

export interface ProductDTO {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  stockQuantity: number;
  images: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemDTO {
  product: string;
  title: string;
  image?: string;
  price: number;
  quantity: number;
}

export interface OrderStatusEventDTO {
  status: OrderStatus;
  at: string;
  note?: string;
}

export interface OrderDTO {
  id: string;
  customer: string | Pick<UserDTO, 'id' | 'name' | 'email'>;
  items: OrderItemDTO[];
  totalAmount: number;
  shippingAddress: Address;
  status: OrderStatus;
  statusHistory: OrderStatusEventDTO[];
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: UserDTO;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreateOrderInput {
  items: { productId: string; quantity: number }[];
  shippingAddress: Address;
}

export interface ServerToClientEvents {
  [SOCKET_EVENTS.ORDER_CREATED]: (order: OrderDTO) => void;
  [SOCKET_EVENTS.ORDER_UPDATED]: (order: OrderDTO) => void;
  [SOCKET_EVENTS.PRODUCT_STOCK_CHANGED]: (p: { id: string; stockQuantity: number }) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ClientToServerEvents {}
