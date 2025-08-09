# ReelShotlist – Staging (Vercel Upload)

## Deploy (ohne Git)
1. ZIP entpacken.
2. Vercel → Add New Project → Import from your computer → Ordner wählen.
3. Environment Variables setzen (Preview + Production):
   - APP_BASE_URL=https://reelshotlist.vercel.app
   - NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=YOUR_STRIPE_PUBLISHABLE_KEY
   - NEXT_PUBLIC_STRIPE_PRICE_MONTHLY=YOUR_STRIPE_PRICE_ID   (z. B. price_XXXX)
   - STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY
   - STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SECRET
   - optional: OPENAI_API_KEY=YOUR_OPENAI_KEY
4. Deploy klicken.

## Stripe Webhook
URL: https://reelshotlist.vercel.app/api/stripe/webhook (später: https://app.reelshotlist.com/api/stripe/webhook)
Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted

## Lokal
npm install
npm run dev
