import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Dashboard(){
  const [user,setUser]=useState(null); const [view,setView]=useState('table'); const [scenes,setScenes]=useState([]); const [reelUrl,setReelUrl]=useState('');
  useEffect(()=>{ supabase.auth.getUser().then(({data})=>{ if(!data?.user){ window.location.href='/'; } else setUser(data.user); }); },[]);
  function demo(){ setScenes([{id:1,name:'Opening',desc:'Establishing',cam:'24mm',dur:'3s',light:'Golden Hour',mood:'cinematisch',iso:'200',f:'f/2.8',wb:'5600K',move:'Push-in'},
                                {id:2,name:'Close',desc:'Close-up',cam:'50mm',dur:'2s',light:'Key left',mood:'intim',iso:'400',f:'f/2.0',wb:'5600K',move:'stativ'}]); }
  async function logout(){ await supabase.auth.signOut(); window.location.href='/'; }
  async function toPremium(){
  // aktuelle Supabase-User-ID holen
  const { data } = await supabase.auth.getUser();
  const user_id = data?.user?.id;
  if(!user_id){ alert('Kein User angemeldet'); return; }

  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ user_id })
  });

  const out = await res.json();
  if (out?.url) {
    window.location.href = out.url;
  } else {
    alert('Checkout konnte nicht erstellt werden. ENV prüfen.');
    console.log(out);
  }
}

  return (<div className="container">
    <div className="header"><img src="/logo.svg" alt="logo"/><span className="badge">Free</span><div style={{marginLeft:'auto'}} className="muted">{user?.email}</div></div>
    <div className="card"><div className="toolbar">
      <input type="text" placeholder="Reel-URL (Demo)" value={reelUrl} onChange={e=>setReelUrl(e.target.value)}/>
      <button className="primary" onClick={demo}>Shotlist erstellen</button>
      <button onClick={()=>setView('table')}>Tabellenansicht</button>
      <button onClick={()=>setView('cards')}>Shot-Cards</button>
      <button onClick={toPremium} style={{marginLeft:'auto'}}>Premium freischalten</button>
      <button onClick={logout}>Logout</button>
    </div></div>
    {view==='table' && (<div className="card"><table className="table"><thead><tr>
      <th>#</th><th>Szene</th><th>Kamera</th><th>Dauer</th><th>Licht</th><th>Stimmung</th><th>ISO</th><th>Blende</th><th>WB</th><th>Bewegung</th>
    </tr></thead><tbody>{scenes.map(s=> <tr key={s.id}><td>{s.id}</td><td>{s.name}<div className="muted">{s.desc}</div></td><td>{s.cam}</td><td>{s.dur}</td><td>{s.light}</td><td>{s.mood}</td><td>{s.iso}</td><td>{s.f}</td><td>{s.wb}</td><td>{s.move}</td></tr>)}</tbody></table></div>)}
    {view==='cards' && (<div className="card"><div className="muted">Shot-Cards sind Premium – jetzt per Stripe Test freischalten.</div></div>)}
    <footer>© {new Date().getFullYear()} ReelShotlist</footer>
  </div>);
}
