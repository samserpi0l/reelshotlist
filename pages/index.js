import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Home(){
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [msg,setMsg]=useState('');
  async function signIn(e){ e.preventDefault(); setMsg(''); const { error } = await supabase.auth.signInWithPassword({ email, password }); if(error){setMsg(error.message);return;} window.location.href='/dashboard'; }
  async function signUp(e){ e.preventDefault(); setMsg(''); const { error } = await supabase.auth.signUp({ email, password }); if(error){setMsg(error.message);return;} setMsg('Registrierung ok. E-Mail bestätigen, dann einloggen.'); }
  return (<div className="container">
    <div className="header"><img src="/logo.svg" alt="logo"/><span className="badge">Staging</span></div>
    <div className="card"><h2>ReelShotlist – Anmelden</h2>
      <form className="toolbar" onSubmit={signIn}>
        <input type="email" placeholder="E-Mail" value={email} onChange={e=>setEmail(e.target.value)} required/>
        <input type="password" placeholder="Passwort" value={password} onChange={e=>setPassword(e.target.value)} required/>
        <button className="primary" type="submit">Einloggen</button>
        <button type="button" onClick={signUp}>Registrieren</button>
      </form>
      {msg && <div className="muted">{msg}</div>}
    </div>
    <footer>© {new Date().getFullYear()} ReelShotlist</footer>
  </div>);
}
