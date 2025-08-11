// pages/api/debug/profile.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await admin
      .from('profiles')
      .select('premium')
      .eq('id', user_id)
      .single();

    if (error) return res.status(500).json({ error: 'DB', details: error });
    return res.status(200).json({ premium: !!data?.premium });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'unknown' });
  }
}
