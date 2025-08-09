import Stripe from 'stripe';
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY;
  const secret = process.env.STRIPE_SECRET_KEY;
  const base = process.env.APP_BASE_URL || 'http://localhost:3000';
  if(!priceId || !secret) return res.status(400).json({error:'Missing Stripe env vars'});
  const stripe = new Stripe(secret, { apiVersion:'2024-06-20' });
  const session = await stripe.checkout.sessions.create({
    mode:'subscription',
    line_items:[{ price: priceId, quantity:1 }],
    success_url: `${base}/dashboard?checkout=success`,
    cancel_url: `${base}/dashboard?checkout=cancel`
  });
  return res.status(200).json({ url: session.url });
}
