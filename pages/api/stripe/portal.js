// pages/api/stripe/portal.js
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    STRIPE_SECRET_KEY,
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    APP_BASE_URL
  } = process.env;

  if (!STRIPE_SECRET_KEY || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1) Versuche Mapping aus DB
  let customerId = null;
  {
    const { data: mapRow, error: mapErr } = await admin
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (mapErr) {
      console.error('[portal] mapping fetch error:', mapErr);
      return res.status(500).json({ error: 'Mapping fetch error' });
    }
    customerId = mapRow?.customer_id || null;
  }

  // 2) Fallback: Wenn kein Mapping, versuche Customer über E-Mail zu finden und Mapping nachzuziehen
  if (!customerId) {
    try {
      // E-Mail des Users über Admin-API holen
      const { data: userResp, error: adminErr } = await admin.auth.admin.getUserById(user_id);
      if (adminErr || !userResp?.user?.email) {
        return res.status(404).json({ error: 'No mapping and user email not found' });
      }
      const email = userResp.user.email;

      // Stripe-Kunden mit derselben E-Mail suchen
      const customers = await stripe.customers.list({ email, limit: 10 });
      const match = customers.data?.[0]; // nimm den ersten Treffer

      if (!match) {
        return res.status(404).json({ error: 'No Stripe customer for this user (by email)' });
      }

      customerId = match.id;

      // Mapping speichern (upsert)
      const { error: upsertErr } = await admin
        .from('stripe_customers')
        .upsert({ customer_id: customerId, user_id });
      if (upsertErr) {
        console.error('[portal] mapping upsert error:', upsertErr);
      }
    } catch (e) {
      console.error('[portal] fallback error:', e);
      return res.status(500).json({ error: 'Fallback mapping failed' });
    }
  }

  // 3) Portal-Session erstellen
  try {
    const base = APP_BASE_URL || `https://${req.headers.host}`;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}/dashboard`
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('[portal] create session error:', e);
    return res.status(500).json({ error: 'Portal session error' });
  }
}
