// pages/inspiration.js
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Inspiration() {
  const [user, setUser] = useState(null);
  const [lang, setLang] = useState('de'); // 'de' | 'en'
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { title, context, shots[] }
  const [view, setView] = useState('table');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) { window.location.href = '/'; return; }
      setUser(data.user);
    })();
  }, []);

  async function generate() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const body = { prompt, lang };
      if (user?.id) body.user_id = user.id;

      const res = await fetch('/api/inspire', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(body)
      });

      let out;
      try {
        out = await res.json();
      } catch {
        setError(`Serverfehler (${res.status}).`);
        return;
      }

      if (!res.ok || !out?.ok) {
        const msg = out?.error || `Fehler (${res.status})`;
        const det = out?.details ? ` — ${String(out.details).slice(0, 300)}` : '';
        setError(msg + det);
        return;
      }
      setResult(out);
    } catch (e) {
      setError('Netzwerk- oder Serverfehler.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <img src="/logo.svg" alt="logo" />
        <h1 style={{marginLeft:12}}>Inspiration</h1>
        <div style={{ marginLeft: 'auto' }} className="muted">{user?.email}</div>
      </div>

      <div className="card">
        <div className="toolbar" style={{ gap: 12 }}>
          <select value={lang} onChange={e=>setLang(e.target.value)}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
          <textarea
            value={prompt}
            onChange={e=>setPrompt(e.target.value)}
            placeholder={lang === 'en'
              ? 'Describe your idea (e.g., car shoot in Berlin, BMW M4, 50% car / 50% driver, cinematic, moody light)…'
              : 'Beschreibe deine Idee (z. B. Auto-Shooting in Deutschland, BMW M4, 50% Auto / 50% Fahrer, cineastisch, stimmungsvolles Licht)…'}
            rows={4}
            style={{ flex: 1 }}
          />
          <button className="primary" onClick={generate} disabled={loading || !prompt.trim()}>
            {loading ? (lang === 'en' ? 'Generating…' : 'Erzeuge…') : (lang === 'en' ? 'Generate' : 'Erzeugen')}
          </button>
          {result && (
            <>
              <button onClick={()=>setView('table')}>Tabelle</button>
              <button onClick={()=>setView('cards')}>Cards</button>
            </>
          )}
        </div>
      </div>

      {error && <div className="card" style={{ borderColor: '#e11d48' }}>
        <div className="muted">{error}</div>
      </div>}

      {result && (
        <>
          <div className="card">
            <h2 style={{marginTop:0}}>{result.title}</h2>
            {result.context && <div className="muted" style={{marginBottom:8}}>{result.context}</div>}
          </div>

          {view === 'table' && (
            <div className="card">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th><th>{lang==='en'?'Shot':'Szene'}</th><th>{lang==='en'?'Camera':'Kamera'}</th><th>{lang==='en'?'Duration':'Dauer'}</th>
                    <th>Licht</th><th>{lang==='en'?'Mood':'Stimmung'}</th><th>ISO</th><th>{lang==='en'?'Aperture':'Blende'}</th><th>WB</th><th>{lang==='en'?'Movement':'Bewegung'}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.shots.map(s => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td>{s.name}<div className="muted">{s.description}</div></td>
                      <td>{s.camera?.type ?? ''}, {s.camera?.focal_mm ?? ''}mm</td>
                      <td>{s.duration_sec}s</td>
                      <td>{s.light}</td>
                      <td>{s.mood}</td>
                      <td>{s.settings?.iso}</td>
                      <td>{s.settings?.aperture}</td>
                      <td>{s.settings?.wb}</td>
                      <td>{s.camera?.movement}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === 'cards' && (
            <div className="card">
              <div style={{ display:'grid', gap:'12px', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))' }}>
                {result.shots.map(s => (
                  <div className="scene-card" key={s.id}>
                    <h4>#{s.id} — {s.name}</h4>
                    <div className="muted" style={{ marginBottom: 8 }}>{s.description}</div>
                    <div><strong>Cam:</strong> {s.camera?.type ?? ''} • {s.camera?.focal_mm ?? ''}mm • {s.camera?.movement}</div>
                    <div><strong>{lang==='en'?'Duration':'Dauer'}:</strong> {s.duration_sec}s</div>
                    <div><strong>Licht:</strong> {s.light}</div>
                    <div><strong>{lang==='en'?'Mood':'Stimmung'}:</strong> {s.mood}</div>
                    <div><strong>ISO/f/WB:</strong> {s.settings?.iso} / {s.settings?.aperture} / {s.settings?.wb}</div>
                    {s.notes && <div><strong>Notes:</strong> {s.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <footer>© {new Date().getFullYear()} ReelShotlist</footer>
    </div>
  );
}
