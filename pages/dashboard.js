// pages/dashboard.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- Optional: Reel-URL (dein bestehendes Feature bleibt erhalten) ---
  const [reelUrl, setReelUrl] = useState('');
  const [reelBusy, setReelBusy] = useState(false);
  const [reelError, setReelError] = useState('');
  const [reelInfo, setReelInfo] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        // nicht eingeloggt → zurück zur Startseite/Sign-In
        router.replace('/');
        return;
      }
      setUser(data.user);

      // Premium-Status laden
      const { data: prof, error } = await supabase
        .from('profiles')
        .select('premium')
        .eq('id', data.user.id)
        .single();

      if (!error) setIsPremium(!!prof?.premium);

      setLoading(false);

      // Realtime-Subscription: wenn Webhook premium toggled
      const channel = supabase
        .channel('profiles-realtime')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${data.user.id}` },
          (payload) => {
            const next = !!payload.new?.premium;
            setIsPremium(next);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    })();
  }, [router]);

  // Stripe Checkout (Upgrade)
  async function onUpgrade() {
    try {
      const { data } = await supabase.auth.getUser();
      const user_id = data?.user?.id;
      if (!user_id) return alert('Bitte einloggen.');
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ user_id })
      });
      const out = await res.json();
      if (out?.url) window.location.href = out.url;
      else alert('Checkout konnte nicht gestartet werden.');
    } catch {
      alert('Fehler beim Öffnen des Checkouts.');
    }
  }

  // Stripe Portal (Abo verwalten)
  async function onManageSubscription() {
    try {
      const { data } = await supabase.auth.getUser();
      const user_id = data?.user?.id;
      if (!user_id) return alert('Bitte einloggen.');

      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ user_id })
      });
      const out = await res.json();
      if (out?.url) window.location.href = out.url;
      else alert('Kundenportal konnte nicht geöffnet werden.');
    } catch {
      alert('Kundenportal konnte nicht geöffnet werden.');
    }
  }

  // Inspiration öffnen (nur Premium)
  function openInspiration() {
    router.push('/inspiration');
  }

  // --- Optional: Reel-URL Demo-Handler (passe /api/route später an deine bestehende Route an) ---
  async function handleReelAnalyze() {
    setReelError('');
    setReelBusy(true);
    setReelInfo(null);
    try {
      if (!reelUrl.trim()) {
        setReelError('Bitte einen gültigen Instagram Reel-Link einfügen.');
        return;
      }
      // HINWEIS:
      // Ersetze '/api/reels/analyze' durch deine existierende API-Route,
      // falls sie anders heißt. Dieser Block ist nur ein Platzhalter,
      // damit die UI nicht bricht.
      const res = await fetch('/api/reels/analyze', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ url: reelUrl })
      });
      if (!res.ok) {
        const t = await res.text();
        setReelError(`Fehler beim Analysieren: ${t.slice(0, 200)}`);
        return;
      }
      const out = await res.json();
      setReelInfo(out || { ok: true });
    } catch (e) {
      setReelError('Netzwerk-/Serverfehler beim Analysieren.');
    } finally {
      setReelBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="header">
          <img src="/logo.svg" alt="logo" />
          <h1 style={{ marginLeft: 12 }}>Dashboard</h1>
        </div>
        <div className="card">
          <div className="muted">Lade dein Profil…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <img src="/logo.svg" alt="logo" />
        <h1 style={{ marginLeft: 12 }}>Dashboard</h1>
        <div style={{ marginLeft: 'auto' }} className="muted">
          {isPremium ? 'Premium' : 'Free'} • {user?.email}
        </div>
      </div>

      {/* Premium-Upsell / Manage */}
      {!isPremium ? (
        <div className="card" style={{ borderColor:'#2563eb' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div className="muted">
              <strong>Premium</strong> schaltet den Inspiration-Modus & Shot-Cards frei – jetzt testen.
            </div>
            <button className="primary" onClick={onUpgrade}>🔓 Jetzt Premium freischalten</button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ borderColor:'#10b981' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div className="muted">Dein Abo ist aktiv.</div>
            <button className="secondary" onClick={onManageSubscription}>Abo verwalten</button>
            <button className="primary" onClick={openInspiration}>💡 Inspiration generieren</button>
          </div>
        </div>
      )}

      {/* Haupt-Feature: Reel → Shotlist */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Reel → Shotlist</h2>
        <div className="toolbar" style={{ gap: 12 }}>
          <input
            type="url"
            placeholder="Instagram Reel-Link einfügen…"
            value={reelUrl}
            onChange={(e)=>setReelUrl(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="primary" onClick={handleReelAnalyze} disabled={reelBusy}>
            {reelBusy ? 'Analysiere…' : 'Shotlist erstellen'}
          </button>
        </div>
        {reelError && <div className="muted" style={{ color:'#e11d48', marginTop: 8 }}>{reelError}</div>}
        {reelInfo && (
          <div className="muted" style={{ marginTop: 8 }}>
            {/* Hier kannst du dein bestehendes Ergebnis-Rendering einfügen */}
            Reel analysiert. (Platzhalter-Result) – integriere hier deine Shotlist-Ausgabe.
          </div>
        )}
      </div>

      <footer>© {new Date().getFullYear()} ReelShotlist</footer>
    </div>
  );
}
