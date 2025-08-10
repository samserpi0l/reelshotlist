// lib/inspirationPrompt.js
export function buildInspirationSystemPrompt(lang = 'de') {
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

export function buildUserPrompt(input, lang = 'de') {
  const guideDe = `
Aufgabe: Erzeuge eine filmische Shotlist basierend auf dieser Beschreibung.
Sprache der Felder: Deutsch.
Wenn nicht genannt, triff sinnvolle Annahmen für Ort, Tageszeit, Licht.
Halte dich an das JSON-Schema.`
    .trim();

  const guideEn = `
Task: Create a cinematic shotlist from this description.
Language for fields: English.
If not specified, make sensible assumptions for location, time, light.
Follow the JSON schema strictly.`
    .trim();

  const guide = lang === 'en' ? guideEn : guideDe;

  return `${guide}\n\nInput:\n${input}`;
}
