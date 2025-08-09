// pages/api/stripe/webhook.js
import Stripe from 'stripe';
import { buffer } from 'micro';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // server-side key (RLS-bypass)
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object; // CheckoutSession
        const userId = session?.metadata?.user_id;
        if (userId) {
          console.log(`✅ Setting premium for user ${userId}`);
          await admin.from('profiles').update({ premium: true }).eq('id', userId);
        } else {
          console.warn('No user_id in checkout.session.completed metadata');
        }
        break;
      }
      case 'customer.subscription.deleted': {
        // Achtung: bei subscription events ist metadata u.U. nicht mehr vorhanden.
        // Wenn du absolute Sicherheit willst, verknüpfe Stripe Customer <-> User in der DB.
        const sub = event.data.object;
        const userId = sub?.metadata?.user_id;
        if (userId) {
          console.log(`⚠️ Removing premium for user ${userId}`);
          await admin.from('profiles').update({ premium: false }).eq('id', userId);
        } else {
          console.warn('No user_id in customer.subscription.deleted metadata');
        }
        break;
      }
      case 'customer.subscription.updated': {
        // optional: anhand status premium setzen/entziehen
        // const sub = event.data.object;
        // const userId = sub?.metadata?.user_id;
        // const active = sub?.status === 'active' || sub?.status === 'trialing';
        // if (userId) await admin.from('profiles').update({ premium: active }).eq('id', userId);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (e) {
    console.error('DB update error:', e);
    return res.status(500).json({ ok: false });
  }

  res.status(200).json({ received: true });
}
