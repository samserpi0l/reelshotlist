// pages/api/stripe/webhook.js
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Next muss den Raw-Body lassen, sonst schlägt die Signatur fehl
export const config = { api: { bodyParser: false } };

// Eigene buffer-Funktion (keine Abhängigkeit zu "micro" nötig)
function readBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // --- Hard checks auf ENV, damit wir klare Fehler bekommen ---
  const {
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env;

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('Missing Stripe env vars');
    return res.status(500).json({ error: 'Missing Stripe env vars' });
  }
  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase env vars');
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

  let event;
  try {
    const buf = await readBuffer(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(buf, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Admin-Client mit Service Role (RLS bypass)
  const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object; // Stripe.Checkout.Session
        const userId = session?.metadata?.user_id;
        console.log('[webhook] checkout.session.completed user_id =', userId);

        if (!userId) {
          console.warn('[webhook] missing user_id in metadata');
          break;
        }

        const { error } = await admin
          .from('profiles')
          .update({ premium: true })
          .eq('id', userId);

        if (error) {
          console.error('[webhook] supabase update error:', error);
          return res.status(500).json({ error: 'DB update failed' });
        }

        console.log('[webhook] premium set to TRUE for', userId);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub?.metadata?.user_id; // kann oft fehlen!
        console.log('[webhook] subscription.deleted user_id =', userId);

        if (!userId) {
          console.warn('[webhook] no user_id on subscription.deleted (consider mapping stripe_customer <-> user)');
          break;
        }

        const { error } = await admin
          .from('profiles')
          .update({ premium: false })
          .eq('id', userId);

        if (error) {
          console.error('[webhook] supabase update error:', error);
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
