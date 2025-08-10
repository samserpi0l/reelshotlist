// pages/api/debug/setPremium.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const { user_id, value } = req.query; // /api/debug/setPremium?user_id=<uuid>&value=true
    if (!user_id) return res.status(400).json({ error: 'user_id missing' });

    // ENV-Check
    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        error: 'Missing env vars',
        have: {
          NEXT_PUBLIC_SUPABASE_URL: !!NEXT_PUBLIC_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY,
        },
      });
    }

    const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await admin
      .from('profiles')
      .update({ premium: String(value) === 'true' })
      .eq('id', user_id);

    if (error) {
      return res.status(500).json({ ok: false, supabase_error: error });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'unknown error' });
  }
}
