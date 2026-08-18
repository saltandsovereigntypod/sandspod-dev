import { useMemo, useRef, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { useSanctuary } from './context/SanctuaryContext.jsx';
import { supabase } from './lib/supabase.js';

const catalog = [
  { id: 'white-candle', label: 'White Candle', type: 'candle', symbol: '🕯' },
  { id: 'black-candle', label: 'Black Candle', type: 'candle', symbol: '🕯' },
  { id: 'rosemary', label: 'Rosemary', type: 'herb', symbol: '🌿' },
  { id: 'lavender', label: 'Lavender', type: 'herb', symbol: '🌿' },
  { id: 'amethyst', label: 'Amethyst', type: 'crystal', symbol: '◆' },
  { id: 'clear-quartz', label: 'Clear Quartz', type: 'crystal', symbol: '◇' },
  { id: 'key', label: 'Skeleton Key', type: 'tool', symbol: '⚿' },
  { id: 'offering-bowl', label: 'Offering Bowl', type: 'vessel', symbol: '◡' }
];

function Shell({ children }) {
  const { user } = useAuth();
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">S&S</span><div><strong>Salt & Sovereignty</strong><small>The Sanctuary</small></div></div>
      <nav>
        {[
          ['/', 'Sanctuary'], ['/altar', 'Altar'], ['/grimoire', 'Grimoire'], ['/library', 'Living Library'], ['/rituals', 'Rituals'], ['/account', 'Account & Data']
        ].map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
      </nav>
      <div className="sidebar-note">{user ? `Signed in as ${user.email}` : 'Guest practice is stored on this device.'}</div>
    </aside>
    <main className="main-view">{children}</main>
  </div>;
}

function PageHead({ eyebrow, title, children }) {
  return <header className="page-head"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children && <p>{children}</p>}</header>;
}

function Dashboard() {
  const { altar, grimoire, rituals } = useSanctuary();
  return <><PageHead eyebrow="The Sanctuary" title="Welcome to your crossroads.">A private place for practice, reflection, ritual, and the things you choose to carry with you.</PageHead>
    <section className="card-grid">
      <NavLink className="feature-card" to="/altar"><span>Altar</span><strong>{altar.objects?.length || 0} objects placed</strong><p>Build, save, and return to your ritual space.</p></NavLink>
      <NavLink className="feature-card" to="/grimoire"><span>Grimoire</span><strong>{grimoire.length} local drafts</strong><p>Write without turning your practice into a productivity app.</p></NavLink>
      <NavLink className="feature-card" to="/rituals"><span>Rituals</span><strong>{rituals.length} rituals</strong><p>Plan, begin, complete, and archive your workings.</p></NavLink>
      <NavLink className="feature-card" to="/library"><span>Living Library</span><strong>Shared correspondences</strong><p>One canonical source for objects used across the Sanctuary.</p></NavLink>
    </section></>;
}

function Altar() {
  const { altar, setAltar } = useSanctuary();
  const { user } = useAuth();
  const stageRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('');
  const [drag, setDrag] = useState(null);
  const objects = altar.objects || [];

  const add = (item) => setAltar({ ...altar, objects: [...objects, {
    instanceId: crypto.randomUUID(), entityId: item.id, label: item.label, type: item.type, symbol: item.symbol,
    leftPercent: .5, topPercent: .5, sizePercent: .09, rotation: 0, flipped: false, locked: false, lit: false, zIndex: objects.length + 10
  }]});

  const patch = (id, change) => setAltar({ ...altar, objects: objects.map(o => o.instanceId === id ? { ...o, ...change } : o) });
  const remove = (id) => { setAltar({ ...altar, objects: objects.filter(o => o.instanceId !== id) }); setSelected(null); };

  const onPointerMove = (event) => {
    if (!drag || !stageRef.current) return;
    const target = objects.find(o => o.instanceId === drag);
    if (target?.locked) return;
    const rect = stageRef.current.getBoundingClientRect();
    patch(drag, { leftPercent: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), topPercent: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)) });
  };

  const saveCloud = async () => {
    if (!user) return alert('Sign in from Account & Data to save this altar to your Sanctuary account.');
    const payload = { name: altar.name || 'Working Altar', savedAt: new Date().toISOString(), objects };
    const { error } = await supabase.from('saved_altars').insert({ user_id: user.id, name: payload.name, altar_data: payload });
    if (error) alert(error.message); else alert('Altar saved to your Sanctuary account.');
  };

  return <><PageHead eyebrow="The Sanctuary" title="The Altar">A responsive ritual canvas. Placement is stored as altar-relative coordinates, so objects remain where they belong across screen sizes.</PageHead>
    <div className="workspace-layout">
      <aside className="tool-panel"><h2>The Cabinet</h2><input className="field" placeholder="Search objects" value={filter} onChange={e => setFilter(e.target.value)} />
        <div className="catalog">{catalog.filter(i => i.label.toLowerCase().includes(filter.toLowerCase())).map(item => <button key={item.id} onClick={() => add(item)}><span>{item.symbol}</span>{item.label}</button>)}</div>
      </aside>
      <section className="altar-area">
        <div className="altar-actions"><input className="title-field" value={altar.name || ''} onChange={e => setAltar({ ...altar, name: e.target.value })}/><button onClick={saveCloud}>Save to Account</button><button onClick={() => setAltar({ name: 'Working Altar', objects: [] })}>Clear</button></div>
        <div ref={stageRef} className="altar-stage" onPointerMove={onPointerMove} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
          {objects.length === 0 && <div className="empty-state">The altar is empty. Choose what belongs here.</div>}
          {objects.map(o => <button key={o.instanceId} className={`altar-object ${selected === o.instanceId ? 'selected' : ''}`} style={{ left: `${o.leftPercent * 100}%`, top: `${o.topPercent * 100}%`, transform: `translate(-50%,-50%) scale(${Math.max(.5, o.sizePercent / .09)}) rotate(${o.rotation}deg) scaleX(${o.flipped ? -1 : 1})`, zIndex: o.zIndex }} onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setSelected(o.instanceId); setDrag(o.instanceId); }} title={o.label}><span>{o.symbol}</span><small>{o.label}</small></button>)}
        </div>
        {selected && (() => { const o = objects.find(x => x.instanceId === selected); return o ? <div className="selection-bar"><strong>{o.label}</strong><button onClick={() => patch(o.instanceId, { rotation: o.rotation + 15 })}>Rotate</button><button onClick={() => patch(o.instanceId, { flipped: !o.flipped })}>Flip</button><button onClick={() => patch(o.instanceId, { locked: !o.locked })}>{o.locked ? 'Unlock' : 'Lock'}</button>{o.type === 'candle' && <button onClick={() => patch(o.instanceId, { lit: !o.lit })}>{o.lit ? 'Extinguish' : 'Light'}</button>}<button onClick={() => remove(o.instanceId)}>Remove</button></div> : null; })()}
      </section>
    </div></>;
}

function Grimoire() {
  const { grimoire, setGrimoire } = useSanctuary();
  const [activeId, setActiveId] = useState(grimoire[0]?.id || null);
  const active = grimoire.find(p => p.id === activeId);
  const create = () => { const page = { id: crypto.randomUUID(), title: 'Untitled Page', content: '', updatedAt: new Date().toISOString() }; setGrimoire([...grimoire, page]); setActiveId(page.id); };
  const patch = (change) => setGrimoire(grimoire.map(p => p.id === activeId ? { ...p, ...change, updatedAt: new Date().toISOString() } : p));
  return <><PageHead eyebrow="Personal Book of Shadows" title="The Grimoire">Your private writing space, designed as a book rather than a dashboard.</PageHead>
    <div className="book-layout"><aside className="book-shelf"><button className="primary" onClick={create}>+ New Page</button>{grimoire.map(p => <button className={p.id === activeId ? 'active' : ''} key={p.id} onClick={() => setActiveId(p.id)}>{p.title}</button>)}</aside>
      <article className="book-page">{active ? <><input className="book-title" value={active.title} onChange={e => patch({ title: e.target.value })}/><div className="book-divider">✦ ☽ ✦ ☾ ✦</div><textarea value={active.content} onChange={e => patch({ content: e.target.value })} placeholder="Write what belongs here..." /></> : <div className="empty-state">Open a page, or create the first page in this book.</div>}</article></div></>;
}

function Library() {
  const groups = useMemo(() => Object.groupBy(catalog, x => x.type), []);
  return <><PageHead eyebrow="Canonical Knowledge" title="The Living Library">The same living objects can be referenced by the altar, grimoire, rituals, and future native apps.</PageHead>
    <div className="library-grid">{Object.entries(groups).map(([type, items]) => <section className="library-group" key={type}><h2>{type[0].toUpperCase() + type.slice(1)}</h2>{items.map(item => <div className="library-row" key={item.id}><span>{item.symbol}</span><div><strong>{item.label}</strong><small>{item.id}</small></div></div>)}</section>)}</div></>;
}

function Rituals() {
  const { rituals, setRituals } = useSanctuary();
  const create = () => setRituals([{ id: crypto.randomUUID(), title: 'Untitled Ritual', state: 'draft', intention: '', createdAt: new Date().toISOString() }, ...rituals]);
  const patch = (id, change) => setRituals(rituals.map(r => r.id === id ? { ...r, ...change } : r));
  return <><PageHead eyebrow="Ritual Practice" title="Rituals">A lifecycle-first ritual space. Drafts become planned workings, active ritual space, completed records, or archived history.</PageHead><button className="primary" onClick={create}>+ Create Ritual</button>
    <div className="ritual-list">{rituals.map(r => <article className="ritual-card" key={r.id}><input value={r.title} onChange={e => patch(r.id, { title: e.target.value })}/><textarea placeholder="Intention" value={r.intention} onChange={e => patch(r.id, { intention: e.target.value })}/><select value={r.state} onChange={e => patch(r.id, { state: e.target.value })}><option>draft</option><option>planned</option><option>active</option><option>paused</option><option>completed</option><option>abandoned</option><option>archived</option></select><span className={`state state-${r.state}`}>{r.state}</span></article>)}</div></>;
}

function Account() {
  const { user, signIn, signUp, signOut } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [status, setStatus] = useState('');
  const act = async (fn) => { const { error } = await fn(email, password); setStatus(error ? error.message : 'Done.'); };
  return <><PageHead eyebrow="Account & Data" title="Your Sanctuary belongs to you.">Authentication is connected directly to the existing development Supabase project. Guest practice remains possible.</PageHead>
    <section className="account-card">{user ? <><h2>Signed in</h2><p>{user.email}</p><button onClick={signOut}>Sign out</button><hr/><h3>Data controls</h3><p>Cloud altar saves continue using the existing <code>saved_altars</code> table. Existing account deletion and backup systems remain untouched until React feature parity is verified.</p></> : <><h2>Enter your Sanctuary</h2><label>Email<input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)}/></label><label>Password<input className="field" type="password" value={password} onChange={e => setPassword(e.target.value)}/></label><div className="button-row"><button className="primary" onClick={() => act(signIn)}>Sign in</button><button onClick={() => act(signUp)}>Create account</button></div><p>{status}</p></>}</section></>;
}

export default function App() {
  return <Shell><Routes><Route path="/" element={<Dashboard/>}/><Route path="/altar" element={<Altar/>}/><Route path="/grimoire" element={<Grimoire/>}/><Route path="/library" element={<Library/>}/><Route path="/rituals" element={<Rituals/>}/><Route path="/account" element={<Account/>}/></Routes></Shell>;
}
