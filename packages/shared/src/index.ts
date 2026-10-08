/**
 * Contracts shared by the API, web storefront, admin dashboard and mobile app.
 * Anything that crosses the network boundary (enums, DTO shapes, socket event
 * names) lives here so every client stays in lockstep with the backend.
 */

export * from './address';

/** Store name and tagline shown by every client and in emails. */
export const STORE_BRAND = {
  name: 'Ember & Bun',
  tagline: 'Smashed fresh. Delivered hot.',
} as const;

export const ROLES = ['customer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ORDER_STATUSES = [
  'Awaiting Payment',
  'Pending',
  'Confirmed',
  'Preparing',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Allowed forward transitions. Delivered and Cancelled are terminal.
 * "Awaiting Payment" → "Pending" happens only when Stripe confirms payment;
 * the kitchen never sees unpaid orders.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  'Awaiting Payment': ['Pending', 'Cancelled'],
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

/** All prices are in this currency (ISO 4217). */
export const CURRENCY = 'CAD';

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
  /** Original price when the product is on special offer (always > price). */
  compareAtPrice: number | null;
  category: string;
  stockQuantity: number;
  /** Units sold across non-cancelled orders; drives "most popular". */
  soldCount: number;
  /** Absolute URLs, or site-relative paths ("/images/...") served by the web app. */
  images: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDTO {
  id: string;
  name: string;
  image: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Public listing: active products. Admin listing: all products. */
  productCount: number;
}

export interface MediaUploadDTO {
  id: string;
  /** Absolute URL to display the image. Send it back as-is in product/category images. */
  url: string;
  width: number;
  height: number;
  size: number;
}

export interface GoogleReviewDTO {
  authorName: string;
  authorUri?: string;
  authorPhotoUri?: string;
  rating: number;
  text: string;
  relativeTime: string;
  publishTime?: string;
}

export type ReviewsDTO =
  | { configured: false }
  | {
      configured: true;
      placeName: string;
      rating: number | null;
      totalReviews: number;
      mapsUri?: string;
      writeReviewUri: string;
      reviews: GoogleReviewDTO[];
    };

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
  /** While "Awaiting Payment": when the Stripe checkout link stops working. */
  paymentExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: UserDTO;
}

/** Digits in the email verification code sent on sign-up. */
export const OTP_LENGTH = 6;

/**
 * POST /auth/register and /auth/register/resend: a code was emailed. The
 * account is created by POST /auth/register/verify ({ email, code }).
 */
export interface VerificationSentResponse {
  email: string;
  /** When the emailed code stops working. */
  expiresAt: string;
  /** Earliest time a new code can be requested. */
  resendAvailableAt: string;
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
  /** Where Stripe should send the customer back to. Defaults to the website. */
  returnTo?: 'web' | 'app';
}

/** POST /orders: the order (Awaiting Payment) plus the Stripe Checkout page to send the customer to. */
export interface CheckoutResponse {
  order: OrderDTO;
  checkoutUrl: string;
}

export interface ServerToClientEvents {
  [SOCKET_EVENTS.ORDER_CREATED]: (order: OrderDTO) => void;
  [SOCKET_EVENTS.ORDER_UPDATED]: (order: OrderDTO) => void;
  [SOCKET_EVENTS.PRODUCT_STOCK_CHANGED]: (p: { id: string; stockQuantity: number }) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ClientToServerEvents {}
