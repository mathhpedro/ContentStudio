import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { hasSupabase } from './supabaseClient';
import {
  bootstrap, fetchPosts, fetchStyle, savePosts, saveStyle, subscribePosts, deletePosts,
  signOut, onAuthChange, enterWithCode, NOT_GATED, type SessionInfo,
} from './backend';
import type { Post } from './data';

const root = ReactDOM.createRoot(document.getElementById('root')!);

// ---------- Local mode (no Supabase configured) ----------
if (!hasSupabase) {
  root.render(<React.StrictMode><App /></React.StrictMode>);
} else {
  root.render(<React.StrictMode><Root /></React.StrictMode>);
}

// ---------- Access gate (shared team code, no email) ----------
function CodeGate({ onEntered }: { onEntered: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const input: React.CSSProperties = {
    width: '100%', borderRadius: '12px', padding: '13px 15px', background: '#0E0F13',
    border: '1px solid #232529', color: '#E9EBEF', fontSize: '14px', outline: 'none',
    fontFamily: "'Hanken Grotesk',sans-serif", boxSizing: 'border-box',
  };
  const btn: React.CSSProperties = {
    width: '100%', borderRadius: '12px', padding: '13px', marginTop: '12px', border: 'none',
    background: '#E9EBEF', color: '#0A0B0D', fontFamily: "'Sora',sans-serif", fontWeight: 600,
    fontSize: '14px', cursor: 'pointer', opacity: busy ? 0.6 : 1,
  };

  async function enter() {
    setErr(''); setBusy(true);
    try { await enterWithCode(code); onEntered(); }
    catch (e: any) { setErr(e.message || String(e)); setBusy(false); }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#08090B',
      fontFamily: "'Hanken Grotesk',sans-serif", color: '#E9EBEF', padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: '380px', borderRadius: '20px', padding: '30px',
        background: 'rgba(22,24,29,0.66)', backdropFilter: 'blur(30px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.10)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 16px 50px rgba(0,0,0,0.55)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '18px', letterSpacing: '0.17em' }}>PRAGMA</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '9px', letterSpacing: '0.14em', color: '#6B7079', textTransform: 'uppercase' }}>Content Studio</span>
        </div>
        <h1 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '22px', letterSpacing: '-0.02em', margin: '12px 0 6px' }}>
          Enter access code
        </h1>
        <p style={{ fontSize: '13.5px', color: '#969BA4', lineHeight: 1.5, marginTop: 0, marginBottom: '18px' }}>
          This studio is shared with your team. Enter the access code to continue.
        </p>
        <input style={input} type="password" placeholder="Access code" value={code} autoFocus
          onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && code && enter()} />
        <button style={btn} disabled={busy || !code} onClick={enter}>{busy ? 'Checking…' : 'Enter studio'}</button>
        {err ? <div style={{ marginTop: '12px', fontSize: '12.5px', color: '#C2453E' }}>{err}</div> : null}
      </div>
    </div>
  );
}

// ---------- Splash ----------
function Splash({ text }: { text: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#08090B', color: '#969BA4', fontFamily: "'Sora',sans-serif", fontSize: '14px' }}>
      {text}
    </div>
  );
}

// ---------- Root gate ----------
function Root() {
  const [phase, setPhase] = useState<'loading' | 'gate' | 'ready' | 'error'>('loading');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [style, setStyle] = useState<string | undefined>(undefined);
  const [errMsg, setErrMsg] = useState('');

  async function loadAll() {
    try {
      const s = await bootstrap();
      const [p, st] = await Promise.all([fetchPosts(s.workspaceId), fetchStyle(s.workspaceId)]);
      setSession(s); setPosts(p); setStyle(st == null ? undefined : st); setPhase('ready');
    } catch (e: any) {
      if ((e.message || '') === NOT_GATED) { setPhase('gate'); return; }
      setErrMsg(e.message || String(e)); setPhase('error');
    }
  }

  useEffect(() => {
    loadAll();
    const off = onAuthChange((signedIn) => { if (!signedIn) { setSession(null); setPhase('gate'); } });
    return off;
  }, []);

  if (phase === 'loading') return <Splash text="Loading…" />;
  if (phase === 'gate') return <CodeGate onEntered={() => { setPhase('loading'); loadAll(); }} />;
  if (phase === 'error') return <Splash text={'Something went wrong: ' + errMsg} />;

  const ws = session!.workspaceId;
  const persistence = {
    savePosts: (p: Post[]) => savePosts(ws, p),
    saveStyle: (s: string) => saveStyle(ws, s),
    loadPosts: () => fetchPosts(ws),
    subscribe: (cb: () => void) => subscribePosts(ws, cb),
    deletePosts: (ids: string[]) => deletePosts(ws, ids),
  };
  const sessionProp = {
    email: session!.email, role: session!.role, workspaceId: ws,
    signOut: () => { signOut().then(() => location.reload()); },
    joinWorkspace: (_id: string) => Promise.resolve(),
  };
  return <App key={ws} persistence={persistence} session={sessionProp} initialPosts={posts} initialStyle={style} />;
}
