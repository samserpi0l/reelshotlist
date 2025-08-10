// pages/api/stripe/webhook.js
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

// eigener Buffer (keine "micro" Abhängigkeit nötig)
function readBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Helper: Premium aus Stripe-Status ableiten
function isPremiumFromStatus(status) {
  // Einfacher Gate: aktiv oder in Probezeit → Premium
  return status === 'active' || status === 'trialing';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const {
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env;

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] Missing Stripe env vars');
    return res.status(500).json({ error: 'Missing Stripe env vars' });
  }
  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[webhook] Missing Supabase env vars');
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

  let event;
  try {
    const buf = await readBuffer(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(buf, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session?.metadata?.user_id || null;
        const customerId = session?.customer || null;

        console.log('[webhook] checkout.session.completed', { userId, customerId });

        // Mapping upsert (falls vorhanden)
        if (customerId && userId) {
          const { error: mapErr } = await admin
            .from('stripe_customers')
            .upsert({ customer_id: customerId, user_id: userId });
          if (mapErr) console.error('[webhook] mapping upsert error:', mapErr);
        }

        if (userId) {
          const { error } = await admin
            .from('profiles')
            .update({ premium: true })
            .eq('id', userId);
          if (error) {
            console.error('[webhook] set premium=true failed:', error);
            return res.status(500).json({ error: 'DB update failed' });
          }
          console.log('[webhook] premium set to TRUE for', userId);
        } else {
          console.warn('[webhook] No user_id in metadata – premium not set');
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const customerId = sub?.customer;
        const status = sub?.status;

        console.log('[webhook] subscription.updated', { customerId, status });

        // user_id über Mapping holen
        if (!customerId) break;
        const { data: mapRows, error: mapErr } = await admin
          .from('stripe_customers')
          .select('user_id')
          .eq('customer_id', customerId)
          .limit(1)
          .maybeSingle();

        if (mapErr) {
          console.error('[webhook] mapping fetch error:', mapErr);
          break;
        }
        const userId = mapRows?.user_id;
        if (!userId) {
          console.warn('[webhook] No user mapping for customer', customerId);
          break;
        }

        const premium = isPremiumFromStatus(status);
        const { error } = await admin
          .from('profiles')
          .update({ premium })
          .eq('id', userId);
        if (error) {
          console.error('[webhook] update premium from status failed:', error);
          return res.status(500).json({ error: 'DB update failed' });
        }
        console.log('[webhook] premium set to', premium, 'for', userId);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId = sub?.customer;
        console.log('[webhook] subscription.deleted', { customerId });
        if (!customerId) break;

        const { data: mapRows, error: mapErr } = await admin
          .from('stripe_customers')
          .select('user_id')
          .eq('customer_id', customerId)
          .limit(1)
          .maybeSingle();

        if (mapErr) {
          console.error('[webhook] mapping fetch error:', mapErr);
          break;
        }
        const userId = mapRows?.user_id;
        if (!userId) {
          console.warn('[webhook] No user mapping for customer', customerId);
          break;
        }

        const { error } = await admin
          .from('profiles')
          .update({ premium: false })
          .eq('id', userId);
        if (error) {
          console.error('[webhook] set premium=false failed:', error);
          return res.status(500).json({ error: 'DB update failed' });
        }
        console.log('[webhook] premium set to FALSE for', userId);
        break;
      }

      default:
        console.log('[webhook] unhandled event:', event.type);
    }
  } catch (e) {
    console.error('[webhook] handler error:', e);
    return res.status(500).json({ error: 'Handler error' });
  }

  return res.status(200).json({ received: true });
}
