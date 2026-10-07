# StoreApp — real-time e-commerce monorepo

A Node/Express API (deployed on Render) on MongoDB Atlas, serving three clients: a Next.js storefront, an admin dashboard and an Expo React Native app. Order status changes are pushed to every client over Socket.io in real time.

```
             ┌──────────────── Render ────────────────┐
 Next.js ──► │  Express REST /api/v1  +  Socket.io    │ ──► MongoDB Atlas
 (web+admin) │  JWT auth · Zod · RBAC · transactions  │     (replica set)
 Expo app ──►│  rooms: admins, user:<id>              │
             └──────────────┬─────────────────────────┘
                            └──► Expo Push ──► FCM / APNs
```

## 1. Directory structure

```
store-app/
├── package.json              npm workspaces root + orchestration scripts
├── render.yaml               Render Blueprint for the API
├── packages/
│   └── shared/               @store/shared: enums, DTO types, socket event names,
│       └── src/index.ts      and the order status state machine used by every app
└── apps/
    ├── api/                  @store/api: Express 5 + Socket.io + Mongoose
    │   └── src/
    │       ├── server.ts           http server, socket init, graceful SIGTERM shutdown
    │       ├── app.ts              helmet, CORS, rate limits, /health, routes, errors
    │       ├── routes.ts           mounts modules under /api/v1
    │       ├── config/             env.ts (Zod-validated env), db.ts (Mongoose)
    │       ├── middleware/         auth.ts (JWT + roles), validate.ts, error.ts
    │       ├── realtime/socket.ts  JWT handshake auth + room assignment
    │       ├── modules/
    │       │   ├── auth/           register / login (bcrypt)
    │       │   ├── users/          User model, /users/me, push tokens
    │       │   ├── products/       model · schemas · service · controller · routes
    │       │   ├── orders/         model · schemas · service · controller · routes · events
    │       │   └── notifications/  Expo push (FCM/APNs) sender
    │       └── scripts/seed.ts     sync indexes, create admin, sample catalog
    ├── web/                  @store/web: Next.js 16 App Router + Tailwind v4 + Zustand
    │   └── src/
    │       ├── app/
    │       │   ├── page.tsx              catalog (SSR) with category filter, search, sort
    │       │   ├── products/[id]/        product detail (SSR + metadata)
    │       │   ├── cart/  checkout/      persisted cart → transactional checkout
    │       │   ├── orders/  orders/[id]/ order history + live tracking timeline
    │       │   ├── login/  register/
    │       │   └── admin/                admin-only guard
    │       │       ├── page.tsx          live operations kanban board
    │       │       └── products/         inventory CRUD + live stock levels
    │       ├── store/                    Zustand: cart (localStorage), auth
    │       ├── hooks/useSocketEvent.ts   typed Socket.io subscription hooks
    │       └── lib/                      api client, socket singleton, formatters
    └── mobile/               @store/mobile: Expo SDK 57 + React Navigation 7
        ├── App.tsx                 hydration gate + push registration
        └── src/
            ├── navigation/         native stack + bottom tabs, notification deep links
            ├── screens/            Shop, ProductDetail, Cart, Checkout, Orders,
            │                       OrderTracking, Login/Register, Account
            ├── store/              cart → AsyncStorage, auth → SecureStore
            ├── hooks/              useSocketEvent / useSocketStatus
            └── lib/                api, socket, notifications (Expo push → FCM)
```

## 2. Data model

| Collection | Key fields | Indexes |
|---|---|---|
| **User** | `name`, `email` (unique, lowercased), `passwordHash` (`select:false`), `role` (`customer`/`admin`), `addresses[]`, `pushTokens[]` | `email` unique, `role` |
| **Product** | `title`, `description`, `price`, `category`, `stockQuantity` (≥0), `images[]`, `isActive` | `{isActive, category, createdAt}`, `{isActive, price}`, text index on `title`+`description` |
| **Order** | `customer` → User, `items[]` (**snapshots**: product ref, title, image, price, qty), `totalAmount`, `shippingAddress`, `status`, `statusHistory[]`, `paymentStatus` | `{customer, createdAt}`, `{status, createdAt}` |

Design decisions:
- **Order items are snapshots.** Title and price are copied at purchase time, so later catalog edits never rewrite order history.
- **Prices are never trusted from the client.** The server reads prices and computes the total.
- **Checkout runs in a MongoDB transaction.** Each line does a conditional `$inc` on stock (`stockQuantity >= qty`). If any line fails, every decrement rolls back, so stock can't be oversold.
- **Status changes follow a state machine** (`ORDER_STATUS_TRANSITIONS` in `@store/shared`) and use the current status as an optimistic lock. If two admins click at the same time, one succeeds and the other gets a 409.
- **Cancelling an order restocks its items** in the same transaction.
- **Products are soft-deleted** (`isActive: false`) because past orders still reference them.

## 3. REST API (`/api/v1`)

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public (rate-limited) | Create a customer account → `{ token, user }` |
| POST | `/auth/login` | public (rate-limited) | → `{ token, user }` |
| GET | `/users/me` | auth | Current profile |
| PATCH | `/users/me` | auth | Update name and saved addresses |
| POST / DELETE | `/users/me/push-tokens` | auth | Register or remove a device push token |
| GET | `/products?category&q&sort&page&limit` | public | Paginated active catalog (admins can add `includeInactive=true`) |
| GET | `/products/categories` | public | Distinct active categories |
| GET | `/products/:id` | public | Product detail |
| POST | `/products` | admin | Create a product |
| PATCH | `/products/:id` | admin | Edit fields or toggle `isActive` |
| PATCH | `/products/:id/stock` | admin | `{ delta }` (atomic, never below 0) or `{ set }` |
| DELETE | `/products/:id` | admin | Archive (soft delete) |
| POST | `/orders` | customer | Reserve stock, create the order as `Awaiting Payment` and a Stripe Checkout session → `{ order, checkoutUrl }` |
| GET | `/orders/:id/checkout` | owner | Re-open the Stripe page for an unpaid order (while it hasn't expired) |
| POST | `/payments/webhook` | Stripe (signed) | Payment confirmations, expiries and refunds |
| GET | `/orders/mine` | auth | Own orders, newest first |
| GET | `/orders/:id` | owner or admin | Order detail (404 for other users) |
| POST | `/orders/:id/cancel` | owner | Cancel while still `Pending` |
| GET | `/orders?status&page&limit` | admin | All orders (operations board) |
| PATCH | `/orders/:id/status` | admin | `{ status, note? }`; must be a valid transition |
| PATCH | `/orders/:id/payment` | admin | `{ paymentStatus }` |
| GET | `/categories` | public | Visible categories in menu order (photo, item count). Admins can add `includeInactive=true` |
| POST | `/categories` | admin | `{ name, image? }` |
| PATCH | `/categories/:id` | admin | Rename (moves its items along), photo, visibility |
| PUT | `/categories/order` | admin | `{ ids: [...] }` sets the menu order |
| DELETE | `/categories/:id` | admin | Only when no visible items use it |
| POST | `/media` | admin | Multipart `file` (≤10 MB). Resized to ≤1600px WebP and stored in MongoDB → `{ url }` |
| GET | `/media/:id` | public | Serves an uploaded image (cached for a year, embeddable cross-origin) |
| GET | `/reviews` | public | Google reviews via Places API (when `GOOGLE_PLACES_API_KEY`/`GOOGLE_PLACE_ID` are set) |
| GET | `/health` | public | Render health check (includes DB state) |

Errors always use the shape `{ error: { message, details? } }`, with status codes 400 (validation), 401, 403, 404, 409 (stock or transition conflict) and 429.

## 4. Real-time design

Order status path: `Pending → Confirmed → Preparing → Out for Delivery → Delivered` (or `Cancelled`).

1. A client connects with `io(API_URL, { auth: { token } })`.
2. The server verifies the JWT in `io.use()` and joins the socket to rooms **server-side**: `user:<id>`, plus `admins` for admins. Clients can't choose rooms, so a customer can never subscribe to another customer's orders.
3. After a transaction commits, the order service calls the broadcaster:

```ts
// apps/api/src/modules/orders/order.events.ts
export function broadcastOrderUpdated(order: OrderDTO): void {
  getIO()
    .to([rooms.admins, rooms.user(customerIdOf(order))])   // one emit, de-duplicated
    .emit(SOCKET_EVENTS.ORDER_UPDATED, order);
  void sendPushToUser(customerIdOf(order), { ... });        // for backgrounded apps
}
```

| Event | Sent to | Payload |
|---|---|---|
| `order:created` | admins | `OrderDTO` |
| `order:updated` | admins + the owning customer | `OrderDTO` |
| `product:stock` | admins | `{ id, stockQuantity }` |

On the client, one hook covers the web and mobile apps:

```tsx
useSocketEvent('order:updated', (o) => { if (o.id === id) setOrder(o); });
const live = useSocketStatus(refetch);   // refetches if a reconnect missed events
```

Broadcasts are sent only **after commit**, so clients never see state that was rolled back. Socket.io's `connectionStateRecovery` replays events after short disconnects; longer outages trigger a refetch.

## 5. Getting started

Prerequisites: Node ≥ 20.19 and a MongoDB Atlas cluster. Transactions need a replica set; every Atlas tier, including M0, is one.

```bash
npm install
cp apps/api/.env.example apps/api/.env         # fill MONGODB_URI + JWT_SECRET
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env

npm run build:shared
npm run seed           # indexes + admin account (SEED_ADMIN_*) + sample products
npm run dev:api        # http://localhost:4000
npm run dev:web        # http://localhost:3000  (admin at /admin)
npm run dev:mobile     # Expo dev server
```

Rebuild `@store/shared` (`npm run build:shared`) after editing it.

## 6. Deployment

**API → Render.** Push the repo and create a Blueprint from `render.yaml`, then set:
- `MONGODB_URI`
- `CORS_ORIGINS`: your web origin(s), comma-separated

Render generates `JWT_SECRET` automatically. Run `npm run seed` once against production, for example from a Render Shell. In Atlas Network Access, allow Render's outbound IPs.

- **Web → Vercel or Render.** Use root directory `apps/web` and set `NEXT_PUBLIC_API_URL`. The build command must build shared first: `cd ../.. && npm run build:web`.
- **Mobile → EAS.** Run `eas init` to fill `extra.eas.projectId`, upload FCM V1 credentials (`eas credentials`), and build with `eas build`. Remote push needs a development or production build; it doesn't work in Expo Go.

## Demo mode (`demo` branch)

A showcase version for clients. It runs as a **separate** API with its own database, so the published demo logins never touch real data.

- Demo mode is on when the API has `DEMO_MODE=true`. The website shows the demo banner, guide and hints only when the API reports demo mode (`GET /api/v1/demo`), so the API setting is the only switch.
- On startup, a demo API creates the demo logins and, if its database is empty, the starter menu.
  - Customer: `customer@demo.example.com` / `demo1234`
  - Admin: `admin@demo.example.com` / `demo1234`
- **Reset demo data** (admin area or guide) deletes all orders and sign-ups and restores the menu.
- Payments use Stripe **test** keys; the guide shows the test cards.

## 7. Production hardening checklist

These are deliberately left as next steps:
- **Payments.** Add a Stripe PaymentIntent at checkout and a webhook that calls `updatePaymentStatus`.
- **Token storage.** Add refresh tokens with rotation. On the web, move the JWT to an httpOnly cookie if the API and web share a parent domain. Today it's in localStorage so the browser can reach a cross-origin API.
- **Scaling sockets.** For more than one API instance, add `@socket.io/redis-adapter` so broadcasts reach sockets on every instance.
- **Images.** Upload to S3 or Cloudinary via signed URLs. Today the API stores image URLs only.
- **Operations.** Add structured logging (pino), error tracking (Sentry), and automated tests (Vitest + Supertest + mongodb-memory-server).
