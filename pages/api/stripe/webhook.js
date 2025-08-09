import Stripe from 'stripe';
export const config = { api: { bodyParser: false } };
function buffer(readable){ return new Promise((resolve,reject)=>{ const chunks=[]; readable.on('data',c=>chunks.push(c)); readable.on('end',()=>resolve(Buffer.concat(chunks))); readable.on('error',reject); }); }
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).end();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion:'2024-06-20' });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try{
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(buf, sig, secret);
  }catch(err){ console.error('Webhook verify failed', err.message); return res.status(400).send(`Webhook Error: ${err.message}`); }
  console.log('Stripe event:', event.type);
  // TODO: Mark user as premium in DB (requires linking stripe customer to supabase user)
  return res.json({ received: true });
}
