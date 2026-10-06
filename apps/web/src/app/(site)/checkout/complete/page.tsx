import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Payment' };

type SearchParams = Promise<{ status?: string; app?: string }>;

/**
 * Where Stripe returns customers who paid from the mobile app (shown in the
 * in-app browser, where they aren't signed in). The app itself picks up the
 * result live once the browser is closed.
 */
export default async function CheckoutCompletePage({ searchParams }: { searchParams: SearchParams }) {
  const { status, app } = await searchParams;
  const paid = status === 'paid';
  const fromApp = app === '1';

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div
        className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full text-3xl ${
          paid ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600'
        }`}
      >
        {paid ? '✓' : '×'}
      </div>
      <h1 className="text-3xl font-bold">{paid ? 'Payment successful' : 'Payment cancelled'}</h1>
      <p className="mt-3 text-stone-600">
        {paid
          ? 'Thanks! Your order is with the kitchen.'
          : 'Nothing was charged. Your cart is still waiting for you.'}
      </p>
      {fromApp ? (
        <p className="mt-6 rounded-xl bg-white p-4 text-sm font-medium shadow-sm ring-1 ring-stone-200">
          Close this window to return to the app{paid ? ' and follow your order live' : ''}.
        </p>
      ) : (
        <Link href={paid ? '/orders' : '/cart'} className="btn-primary mt-6">
          {paid ? 'View my orders' : 'Back to cart'}
        </Link>
      )}
    </div>
  );
}
