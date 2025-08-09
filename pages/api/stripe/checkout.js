import Stripe from 'stripe';

export default async function handler(req, res){
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY;
  const base = process.env.APP_BASE_URL || 'http://localhost:3000';

  // ⬇️ User-ID kommt vom Client
  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/dashboard?checkout=success`,
      cancel_url: `${base}/dashboard?checkout=cancel`,
      // ⬇️ WICHTIG: User-ID an Stripe hängen
      metadata: { user_id }
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('Stripe error', e);
    return res.status(500).json({ error: 'Stripe error' });
  }
}
