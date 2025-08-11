// pages/api/inspire.js
/**
 * POST /api/inspire
 * Body: { user_id?: string, prompt: string, lang?: 'de'|'en' }
 * ENV: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: ALLOW_FREE_INSPIRATION=true  (zum Testen ohne Premium)
 */
import { createClient } from '@supabase/supabase-js';

// ---- Inline Prompt Builders (keine Imports nötig) ----
function buildInspirationSystemPrompt(lang = 'de') {
  const sysDe = `
Du bist ein Regie- und Kameraassistent. Liefere Shotlists als striktes JSON.
Regeln:
- Max 12 Shots.
- Schreibe präzise, filmisch, aber knapp.
- Kameraangaben realistisch (Brennweite, Bewegungen).
- Licht & Stimmung konkret (z. B. "Golden Hour", "Practical lights warm").
- Parameter ISO/Blende/WB als Schätzung.
- Dauer kurz (1–5s) für Reels.
- KEINE zusätzliche Erklärung, NUR JSON.
Schema:
{
  "title": string,
  "context": string,
  "shots": [
    {
      "id": number,
      "name": string,
      "description": string,
      "duration_sec": number,
      "camera": { "focal_mm": number, "movement": string, "type": string },
      "light": string,
      "mood": string,
      "settings": { "iso": number, "aperture": string, "wb": string, "shutter": string },
      "notes": string
    }
  ]
}
  `.trim();

  const sysEn = `
You are a directing & camera assistant. Output shotlists as strict JSON.
Rules:
- Max 12 shots.
- Precise, cinematic but concise.
- Realistic camera data (focal length, movements).
- Concrete lighting & mood.
- Include estimated ISO/Aperture/WB.
- Short durations (1–5s) for reels.
- NO extra text, ONLY JSON.
Schema:
{
  "title": string,
  "context": string,
  "shots": [
    {
      "id": number,
      "name": string,
      "description": string,
      "duration_sec": number,
      "camera": { "focal_mm": number, "movement": string, "type": string },
      "light": string,
      "mood": string,
      "settings": { "iso": number, "aperture": string, "wb": string, "shutter": string },
      "notes": string
    }
  ]
}
  `.trim();

  return lang === 'en' ? sysEn : sysDe;
}

function buildUserPrompt(input, lang = 'de') {
  const guideDe = `
Aufgabe: Erzeuge eine filmische Shotlist basierend auf dieser Beschreibung.
Sprache der Felder: Deutsch.
Wenn nicht genannt, triff sinnvolle Annahmen für Ort, Tageszeit, Licht.
Halte dich an das JSON-Schema.`.trim();

  const guideEn = `
Task: Create a cinematic shotlist from this description.
Language for fields: English.
If not specified, make sensible assumptions for location, time, light.
Follow the JSON schema strictly.`.trim();

  const guide = lang === 'en' ? guideEn : guideDe;
  return `${guide}\n\nInput:\n${input}`;
}
// ------------------------------------------------------

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

  // Premium-Gate (klare Fehlertexte)
  if (!ALLOW_FREE_INSPIRATION) {
    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id (client not logged in?)' });
    }
    const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: prof, error: profErr } = await admin
      .from('profiles')
      .select('premium')
      .eq('id', user_id)
      .single();
    if (profErr) {
      console.error('[inspire] profile check error:', profErr);
      return res.status(500).json({ error: 'Profile check failed', details: profErr.message || profErr });
    }
    if (!prof?.premium) {
      return res.status(402).json({ error: 'Premium required' });
    }
  }

  try {
    const sys = buildInspirationSystemPrompt(lang);
    const userContent = buildUserPrompt(prompt, lang);

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
        response_format: { type: 'json_object' }
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('[inspire] OpenAI non-OK:', resp.status, text);
      return res.status(500).json({ error: 'OpenAI error', details: text });
    }

    // robustes Parsen/Fehler
    let data;
    try {
      data = await resp.json();
    } catch {
      const text = await resp.text();
      console.error('[inspire] JSON parse fail, body:', text);
      return res.status(500).json({ error: 'Invalid JSON from OpenAI', details: text });
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) return res.status(500).json({ error: 'Empty response from model' });

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('[inspire] model content not JSON:', content);
      return res.status(500).json({ error: 'Model returned non-JSON' });
    }

    if (!Array.isArray(parsed?.shots)) {
      return res.status(500).json({ error: 'Model JSON missing "shots" array' });
    }

    // Sanitize & clamp
    const shots = parsed.shots.slice(0, 12).map((s, idx) => ({
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
      shots
    });
  } catch (e) {
    console.error('[inspire] server error:', e);
    return res.status(500).json({ error: 'Server error', details: e?.message || 'unknown' });
  }
}
