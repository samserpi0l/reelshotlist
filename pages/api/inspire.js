// pages/api/inspire.js
import { createClient } from '@supabase/supabase-js';

// ---- Prompt Builder inline ----
function systemPrompt(lang = 'de') {
  const de = `
Du bist ein Regie- und Kameraassistent. Liefere Shotlists als striktes JSON.
Regeln:
- Max 12 Shots, 1–5s Dauer je Shot.
- Präzise, filmisch, knapp.
- Realistische Kameraangaben (Brennweite, Bewegung, Typ).
- Konkretes Licht & Stimmung (z. B. "Golden Hour", "praktische Warmlichter").
- Geschätzte Einstellungen (ISO/Blende/WB/Zeit).
- KEINE Erklärtexte, NUR JSON nach Schema.
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

  const en = `
You are a directing & camera assistant. Output shotlists as strict JSON.
Rules:
- Max 12 shots, 1–5s each.
- Precise, cinematic, concise.
- Realistic camera specs (focal length, movement, type).
- Concrete lighting & mood.
- Include estimated ISO/Aperture/WB/Shutter.
- NO extra text, ONLY JSON per schema.
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

  return lang === 'en' ? en : de;
}
function userPrompt(input, lang='de'){
  const lead = lang === 'en'
    ? 'Create a cinematic shotlist from this description:'
    : 'Erzeuge eine filmische Shotlist basierend auf dieser Beschreibung:';
  return `${lead}\n\n${input}`;
}

// ---- Provider Call Helpers ----
async function callGroq({ apiKey, model, sys, usr }) {
  // Groq nutzt einen OpenAI-kompatiblen Chat-Completions Endpoint
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: usr }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Groq ${resp.status}: ${text.slice(0,500)}`);
  let data; try { data = JSON.parse(text); } catch { throw new Error(`Groq JSON error: ${text.slice(0,500)}`); }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq: empty content');
  return content;
}

async function callOpenRouter({ apiKey, model, sys, usr }) {
  // Falls du OpenRouter testen willst (free models mit :free)
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: usr }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`OpenRouter ${resp.status}: ${text.slice(0,500)}`);
  let data; try { data = JSON.parse(text); } catch { throw new Error(`OpenRouter JSON error: ${text.slice(0,500)}`); }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter: empty content');
  return content;
}

async function callOpenAI({ apiKey, projectId, model, sys, usr }) {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (projectId) headers['OpenAI-Project'] = projectId;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: usr }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${text.slice(0,500)}`);
  let data; try { data = JSON.parse(text); } catch { throw new Error(`OpenAI JSON error: ${text.slice(0,500)}`); }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI: empty content');
  return content;
}

// ---- Next.js API Handler ----
export default async function handler(req, res) {
  // einfache Methoden-Erlaubnis inkl. OPTIONS
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method Not Allowed' });

  const {
    LLM_PROVIDER = 'groq',
    GROQ_API_KEY,
    GROQ_MODEL = 'llama-3.1-8b-instant',
    OPENAI_API_KEY,
    OPENAI_MODEL = 'gpt-4o-mini',
    OPENAI_PROJECT_ID,
    OPENROUTER_API_KEY,
    OPENROUTER_MODEL = 'meta-llama/llama-3.1-8b-instruct:free',
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    ALLOW_FREE_INSPIRATION
  } = process.env;

  const { prompt, lang = 'de', user_id } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ ok:false, error:'Missing prompt' });
  }
  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok:false, error:'Missing Supabase env vars' });
  }

  // Premium-Gate
  if (!ALLOW_FREE_INSPIRATION) {
    if (!user_id) return res.status(400).json({ ok:false, error:'Missing user_id' });
    const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: prof, error: profErr } = await admin
      .from('profiles').select('premium').eq('id', user_id).single();
    if (profErr) return res.status(500).json({ ok:false, error:'Profile check failed', details: profErr.message || profErr });
    if (!prof?.premium) return res.status(402).json({ ok:false, error:'Premium required' });
  }

  const sys = systemPrompt(lang);
  const usr = userPrompt(prompt, lang);

  try {
    let content;
    if (LLM_PROVIDER === 'groq') {
      if (!GROQ_API_KEY) return res.status(500).json({ ok:false, error:'Missing GROQ_API_KEY' });
      content = await callGroq({ apiKey: GROQ_API_KEY, model: GROQ_MODEL, sys, usr });
    } else if (LLM_PROVIDER === 'openrouter') {
      if (!OPENROUTER_API_KEY) return res.status(500).json({ ok:false, error:'Missing OPENROUTER_API_KEY' });
      content = await callOpenRouter({ apiKey: OPENROUTER_API_KEY, model: OPENROUTER_MODEL, sys, usr });
    } else if (LLM_PROVIDER === 'openai') {
      if (!OPENAI_API_KEY) return res.status(500).json({ ok:false, error:'Missing OPENAI_API_KEY' });
      content = await callOpenAI({ apiKey: OPENAI_API_KEY, projectId: OPENAI_PROJECT_ID, model: OPENAI_MODEL, sys, usr });
    } else {
      return res.status(400).json({ ok:false, error:`Unknown LLM_PROVIDER: ${LLM_PROVIDER}` });
    }

    let parsed;
    try { parsed = JSON.parse(content); }
    catch { return res.status(500).json({ ok:false, error:'Model returned non-JSON', details: content.slice(0,500) }); }

    if (!Array.isArray(parsed?.shots)) {
      return res.status(500).json({ ok:false, error:'Model JSON missing "shots"' });
    }

    // sanitisieren
    const shots = parsed.shots.slice(0,12).map((s, i) => ({
      id: Number(s.id ?? i+1),
      name: String(s.name ?? `Shot ${i+1}`),
      description: String(s.description ?? ''),
      duration_sec: Number(s.duration_sec ?? 3),
      camera: {
        focal_mm: Number(s?.camera?.focal_mm ?? 35),
        movement: String(s?.camera?.movement ?? 'static'),
        type: String(s?.camera?.type ?? 'handheld'),
      },
      light: String(s.light ?? ''),
      mood: String(s.mood ?? ''),
      settings: {
        iso: Number(s?.settings?.iso ?? 200),
        aperture: String(s?.settings?.aperture ?? 'f/2.8'),
        wb: String(s?.settings?.wb ?? '5600K'),
        shutter: String(s?.settings?.shutter ?? '1/120'),
      },
      notes: String(s.notes ?? ''),
    }));

    return res.status(200).json({
      ok: true,
      title: String(parsed.title ?? (lang==='en' ? 'Inspiration Shotlist' : 'Inspiration-Shotlist')),
      context: String(parsed.context ?? ''),
      shots
    });

  } catch (e) {
    return res.status(500).json({ ok:false, error:'LLM call failed', details: e.message || String(e) });
  }
}
