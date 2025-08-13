// pages/inspiration.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Inspiration() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [lang, setLang] = useState('de'); // 'de' | 'en'
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { title, context, shots[] }
  const [view, setView] = useState('table');
  const [error, setError] = useState('');
  const [needsPremium, setNeedsPremium] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) { router.replace('/'); return; }
      setUser(data.user);

      const { data: prof } = await supabase
        .from('profiles')
        .select('premium')
        .eq('id', data.user.id)
        .single();
      setIsPremium(!!prof?.premium);
    })();
  }, [router]);

  async function toPremium() {
    try {
      const { data } = await supabase.auth.getUser();
      const user_id = data?.user?.id;
      if (!user_id) return alert('Bitte einloggen.');
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id })
      });
      const out = await res.json();
      if (out?.url) window.location.href = out.url;
      else alert('Checkout konnte nicht gestartet werden.');
    } catch (e) {
      alert('Fehler beim Öffnen des Checkouts.');
    }
  }

  async function generate() {
    setLoading(true);
    setError('');
    setNeedsPremium(false);
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

      if (res.status === 402 || out?.error === 'Premium required') {
        setNeedsPremium(true);
        setError('');
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

  async function exportPdf() {
    try {
      if (!result || !user?.id) return;
      const res = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          lang,
          title: result.title,
          context: result.context,
          shots: result.shots
        })
      });
      if (!res.ok) {
        const txt = await res.text();
        alert('PDF Export fehlgeschlagen: ' + txt.slice(0, 300));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0,10);
      a.download = `shotlist-${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('PDF Export Fehler.');
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div
          style={{ display:'flex', alignItems:'center', cursor:'pointer' }}
          onClick={() => router.push('/')}
        >
          <img src="/logo.svg" alt="logo" />
          <h1 style={{marginLeft:12}}>Inspiration</h1>
        </div>
        <div style={{ marginLeft: 'auto' }} className="muted">
          {isPremium ? 'Premium' : 'Free'} • {user?.email}
        </div>
      </div>

      {!isPremium && !needsPremium && (
        <div className="card" style={{ borderColor:'#2563eb' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div className="muted">
              Der Inspiration-Modus ist ein <strong>Premium-Feature</strong>. Du kannst ihn mit einem Klick freischalten.
            </div>
            <button className="primary" onClick={toPremium}>Jetzt Premium testen</button>
          </div>
        </div>
      )}

      {needsPremium && (
        <div className="card" style={{ borderColor:'#f59e0b', background:'#fff8eb' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div>
              <strong>Premium erforderlich</strong> – Bitte upgrade, um Inspiration-Shotlists zu generieren.
            </div>
              <button className="primary" onClick={toPremium}>Premium freischalten</button>
          </div>
        </div>
      )}

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
              {isPremium && (
                <button onClick={exportPdf} className="secondary">
                  Als PDF speichern
                </button>
              )}
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
