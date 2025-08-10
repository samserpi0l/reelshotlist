import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { user_id, value } = req.query; // /api/debug/setPremium?user_id=<uuid>&value=true
  if (!user_id) return res.status(400).json({ error: 'user_id missing' });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { error } = await admin
    .from('profiles')
    .update({ premium: String(value) === 'true' })
    .eq('id', user_id);

  if (error) return res.status(500).json({ ok: false, error });
  return res.status(200).json({ ok: true });
}
