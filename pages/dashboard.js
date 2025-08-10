// pages/dashboard.js
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('table'); // 'table' | 'cards'
  const [scenes, setScenes] = useState([]);
  const [reelUrl, setReelUrl] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [msg, setMsg] = useState('');

  // URL-Params Helper
  const q = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  // 1) User + Premium beim Laden holen
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data || !data.user) {
        window.location.href = '/';
        return;
      }
      setUser(data.user);
      await refreshPremium(data.user.id);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Nach erfolgreichem Checkout Premium neu laden (?checkout=success)
  useEffect(() => {
    const checkoutSuccess = q.get('checkout') === 'success';
    if (!checkoutSuccess || !user || !user.id) return;
    (async () => {
      await refreshPremium(user.id);
      // Query-Param entfernen
      const url = new URL(window.location.href);
      url.searchParams.delete('checkout');
      window.history.replaceState({}, '', url.toString());
      setMsg('Premium erfolgreich aktiviert.');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, user && user.id]);

  // 3) LIVE-UPDATE via Supabase Realtime (Profil-Änderungen)
  useEffect(() => {
    if (!user || !user.id) return;

    // Realtime muss in Supabase für die Tabelle "profiles" aktiviert sein.
    const channel = supabase
      .channel('profiles-premium-watch')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const newPremium = !!(payload && payload.new && payload.new.premium);
          setIsPremium(newPremium);
          setMsg(newPremium ? 'Premium aktiviert (Live-Update).' : 'Premium entfernt (Live-Update).');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function refreshPremium(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('premium')
      .eq('id', userId)
      .single();
    if (!error && data) {
      setIsPremium(data.premium === true);
    }
  }

  // Demo-Shotlist
  function demoGenerate() {
    setScenes([
      { id: 1, name: 'Opening', desc: 'Establishing', cam: '24mm', dur: '3s', light: 'Golden Hour', mood: 'cinematisch', iso: '200', f: 'f/2.8', wb: '5600K', move: 'Push-in' },
      { id: 2, name: 'Close', desc: 'Close-up', cam: '50mm', dur: '2s', light: 'Key left', mood: 'intim', iso: '400', f: 'f/2.0', wb: '5600K', move: 'Stativ' },
      { id: 3, name: 'Cutaway', desc: 'Detail Hände', cam: '85mm', dur: '1.5s', light: 'Practicals', mood: 'warm', iso: '160', f: 'f/2.0', wb: '3200K', move: 'Micro-Dolly' }
    ]);
    setMsg('Beispiel-Shotlist generiert.');
  }

  async function toPremium() {
    const { data } = await supabase.auth.getUser();
    const user_id = data && data.user && data.user.id;
    if (!user_id) {
      alert('Kein User angemeldet.');
      return;
    }
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id })
    });
    const out = await res.json();
    if (out && out.url) {
      window.location.href = out.url;
    } else {
      alert('Checkout konnte nicht erstellt werden. Bitte ENV in Vercel prüfen.');
      // Optional: console.log(out);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    <div className="container">
      <div className="header">
        <img src="/logo.svg" alt="logo" />
        <span className="badge">{isPremium ? 'Premium' : 'Free'}</span>
        <div style={{ marginLeft: 'auto' }} className="muted">{user ? user.email : ''}</div>
      </div>

      <div className="card">
        <div className="toolbar">
          <input
            type="text"
            placeholder="Reel-URL (Demo – lädt Beispiel-Shotlist)"
            value={reelUrl}
            onChange={(e) => setReelUrl(e.target.value)}
          />
          <button className="primary" onClick={demoGenerate}>Shotlist erstellen</button>
          <button onClick={() => setView('table')}>Tabellenansicht</button>
          <button onClick={() => setView('cards')}>Shot-Cards</button>
          {!isPremium && (
            <button onClick={toPremium} style={{ marginLeft: 'auto' }}>
              Premium freischalten
            </button>
          )}
          <button onClick={() => user && user.id && refreshPremium(user.id)}>
            Status aktualisieren
          </button>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      {msg ? <div className="muted" style={{ margin: '6px 0 12px' }}>{msg}</div> : null}

      {view === 'table' && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>Szene</th><th>Kamera</th><th>Dauer</th>
                <th>Licht</th><th>Stimmung</th><th>ISO</th><th>Blende</th><th>WB</th><th>Bewegung</th>
              </tr>
            </thead>
            <tbody>
              {scenes.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.name}<div className="muted">{s.desc}</div></td>
                  <td>{s.cam}</td>
                  <td>{s.dur}</td>
                  <td>{s.light}</td>
                  <td>{s.mood}</td>
                  <td>{s.iso}</td>
                  <td>{s.f}</td>
                  <td>{s.wb}</td>
                  <td>{s.move}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'cards' && (
        <div className="card">
          {!isPremium ? (
            <div className="muted">Shot-Cards sind ein Premium-Feature – jetzt per Stripe-Test freischalten.</div>
          ) : (
            <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              {scenes.map((s) => (
                <div className="scene-card" key={s.id}>
                  <h4>#{s.id} — {s.name}</h4>
                  <div className="muted" style={{ marginBottom: 8 }}>{s.desc}</div>
                  <div><strong>Cam:</strong> {s.cam}</div>
                  <div><strong>Dauer:</strong> {s.dur}</div>
                  <div><strong>Licht:</strong> {s.light}</div>
                  <div><strong>Stimmung:</strong> {s.mood}</div>
                  <div><strong>ISO:</strong> {s.iso} — <strong>f:</strong> {s.f} — <strong>WB:</strong> {s.wb}</div>
                  <div><strong>Bewegung:</strong> {s.move}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <footer>© {new Date().getFullYear()} ReelShotlist</footer>
    </div>
  );
}
