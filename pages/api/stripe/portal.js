// pages/api/stripe/portal.js
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL } = process.env;
  const { SUPABASE_SERVICE_ROLE_KEY, APP_BASE_URL } = process.env;

  if (!STRIPE_SECRET_KEY || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // customer_id aus Mapping holen
  const { data: mapRows, error: mapErr } = await admin
    .from('stripe_customers')
    .select('customer_id')
    .eq('user_id', user_id)
    .maybeSingle();

  if (mapErr || !mapRows?.customer_id) {
    return res.status(404).json({ error: 'No Stripe customer for this user' });
  }

  const returnUrl = (APP_BASE_URL || 'http://localhost:3000') + '/dashboard';

  const session = await stripe.billingPortal.sessions.create({
    customer: mapRows.customer_id,
    return_url: returnUrl
  });

  return res.status(200).json({ url: session.url });
}
