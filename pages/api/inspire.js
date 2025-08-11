// pages/api/inspire.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const { prompt, lang, user_id } = req.body || {};
  if (!prompt || !lang) {
    return res.status(400).json({ ok: false, error: 'Missing prompt or lang' });
  }

  // Premium-Check
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: profile } = await supabase
    .from('profiles')
    .select('premium')
    .eq('id', user_id)
    .single();

  if (!profile?.premium && !process.env.ALLOW_FREE_INSPIRATION) {
    return res.status(403).json({ ok: false, error: 'Not authorized' });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID;

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ ok: false, error: 'Missing OpenAI API Key' });
  }

  // Prompt-Generierung
  const sys = lang === 'en'
    ? 'You are an expert video director. Generate a JSON shotlist based on user input...'
    : 'Du bist ein erfahrener Videoregisseur. Erstelle eine JSON-Shotlist basierend auf der Nutzerbeschreibung...';

  const userContent = `${lang === 'en' ? 'Description' : 'Beschreibung'}: ${prompt}`;

  try {
    const headers = {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    };

    // Falls Project-ID vorhanden, hinzufügen
    if (OPENAI_PROJECT_ID) {
      headers['OpenAI-Project'] = OPENAI_PROJECT_ID;
    }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers,
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
      const errText = await resp.text();
      return res.status(resp.status).json({
        ok: false,
        error: 'OpenAI error',
        details: errText
      });
    }

    const data = await resp.json();
    let parsed;
    try {
      parsed = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'Invalid JSON from OpenAI', details: data });
    }

    return res.status(200).json({ ok: true, ...parsed });

  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error', details: err.message });
  }
}
