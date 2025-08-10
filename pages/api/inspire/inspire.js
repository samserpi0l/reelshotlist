// pages/api/inspire.js
/**
 * POST /api/inspire
 * Body: { user_id: string, prompt: string, lang?: 'de'|'en' }
 * Requires: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Premium-Gate: profiles.premium muss true sein (oder setze ALLOW_FREE_INSPIRATION=true für Tests)
 */
import { createClient } from '@supabase/supabase-js';
import { buildInspirationSystemPrompt, buildUserPrompt } from '../../lib/inspirationPrompt';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    OPENAI_API_KEY,
    OPENAI_MODEL = 'gpt-4o-mini',
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    ALLOW_FREE_INSPIRATION
  } = process.env;

  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }

  const { user_id, prompt, lang = 'de' } = req.body || {};
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Missing prompt' });

  // optional: user_id prüfen und Premium gate
  if (!ALLOW_FREE_INSPIRATION) {
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
    const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: prof, error: profErr } = await admin
      .from('profiles')
      .select('premium')
      .eq('id', user_id)
      .single();
    if (profErr) return res.status(500).json({ error: 'Profile check failed', details: profErr });
    if (!prof?.premium) return res.status(402).json({ error: 'Premium required' });
  }

  // OpenAI call
  try {
    const sys = buildInspirationSystemPrompt(lang);
    const userContent = buildUserPrompt(prompt, lang);

    // Minimaler fetch gegen OpenAI Chat Completions
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userContent }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' } // zwingt JSON-Ausgabe
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(500).json({ error: 'OpenAI error', details: text });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return res.status(500).json({ error: 'Empty response from model' });

    // JSON parsen & minimal validieren
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({ error: 'Invalid JSON from model' });
    }

    if (!Array.isArray(parsed?.shots)) {
      return res.status(500).json({ error: 'Model JSON missing "shots" array' });
    }

    // Clamp & Sanitize
    parsed.shots = parsed.shots.slice(0, 12).map((s, idx) => ({
      id: Number(s.id ?? idx + 1),
      name: String(s.name ?? `Shot ${idx + 1}`),
      description: String(s.description ?? ''),
      duration_sec: Number(s.duration_sec ?? 3),
      camera: {
        focal_mm: Number(s?.camera?.focal_mm ?? 35),
        movement: String(s?.camera?.movement ?? 'static'),
        type: String(s?.camera?.type ?? 'handheld')
      },
      light: String(s.light ?? ''),
      mood: String(s.mood ?? ''),
      settings: {
        iso: Number(s?.settings?.iso ?? 200),
        aperture: String(s?.settings?.aperture ?? 'f/2.8'),
        wb: String(s?.settings?.wb ?? '5600K'),
        shutter: String(s?.settings?.shutter ?? '1/120')
      },
      notes: String(s.notes ?? '')
    }));

    return res.status(200).json({
      ok: true,
      title: String(parsed.title ?? (lang === 'en' ? 'Inspiration Shotlist' : 'Inspiration-Shotlist')),
      context: String(parsed.context ?? ''),
      shots: parsed.shots
    });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: e?.message || 'unknown' });
  }
}
