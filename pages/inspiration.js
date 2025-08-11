// pages/inspiration.js
import { useState } from 'react';
import { useUser } from '@supabase/auth-helpers-react';

export default function Inspiration() {
  const user = useUser();
  const [prompt, setPrompt] = useState('');
  const [shots, setShots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    if (!prompt.trim()) {
      setError('Bitte eine Beschreibung eingeben.');
      return;
    }
    setError('');
    setLoading(true);
    setShots([]);

    try {
      const res = await fetch('/api/inspire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          prompt,
          lang: 'de'
        })
      });

      const out = await res.json();

      if (!res.ok || !out?.ok) {
        const msg = out?.error || `Fehler (${res.status})`;
        const det = out?.details ? ` — ${String(out.details).slice(0, 300)}` : '';
        setError(msg + det);
        return;
      }

      setShots(out.shots || []);
    } catch (err) {
      console.error(err);
      setError('Netzwerk- oder Serverfehler.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Inspiration-Modus</h1>
      <p>Beschreibe deine gewünschte Szene und erhalte eine KI-generierte Shotlist.</p>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
        placeholder="Beschreibe hier dein Video..."
      />

      <button
        onClick={generate}
        disabled={loading}
        style={{
          padding: '10px 20px',
          backgroundColor: '#0070f3',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        {loading ? 'Erzeuge...' : 'Erzeugen'}
      </button>

      {error && (
        <div style={{ color: 'red', marginBottom: '20px' }}>
          <strong>Fehler:</strong> {error}
        </div>
      )}

      {shots.length > 0 && (
        <div>
          <h2>Deine Shotlist</h2>
          <ul>
            {shots.map((s) => (
              <li key={s.id} style={{ marginBottom: '10px' }}>
                <strong>{s.name}</strong>: {s.description}
                <br />
                <em>
                  {s.duration_sec}s | {s.camera.focal_mm}mm {s.camera.type} ({s.camera.movement})
                </em>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
