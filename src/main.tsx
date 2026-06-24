import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { hasSupabase } from './supabaseClient';
import {
  bootstrap, fetchPosts, fetchStyle, savePosts, saveStyle, subscribePosts, deletePosts, callImage, uploadFigure, setTextKey,
  signOut, onAuthChange, enterWithCode, switchAccount, NOT_GATED, type SessionInfo,
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
    width: '100%', borderRadius: '3px', padding: '13px 15px', background: '#141209',
    border: '1px solid #2B261C', color: '#F2EEE4', fontSize: '15px', outline: 'none',
    fontFamily: "'JetBrains Mono',monospace", boxSizing: 'border-box',
  };
  const btn: React.CSSProperties = {
    width: '100%', borderRadius: '3px', padding: '14px', marginTop: '12px', border: 'none',
    background: '#C2861E', color: '#0F0E0B', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
    fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', opacity: busy ? 0.6 : 1,
  };

  async function enter() {
    setErr(''); setBusy(true);
    try { await enterWithCode(code); onEntered(); }
    catch (e: any) { setErr(e.message || String(e)); setBusy(false); }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0F0E0B',
      fontFamily: "'Cormorant Garamond',serif", color: '#F2EEE4', padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: '390px', borderRadius: '4px', padding: '34px',
        background: '#15130D', border: '1px solid #2B261C', boxShadow: '0 16px 50px rgba(0,0,0,0.55)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '24px', color: '#F2EEE4' }}>Pragma<span style={{ color: '#C2861E' }}>.</span></span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '9px', letterSpacing: '0.18em', color: '#74695A', textTransform: 'uppercase' }}>Content Studio</span>
        </div>
        <div style={{ height: '1px', background: '#2B261C', margin: '4px 0 18px' }} />
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', letterSpacing: '0.16em', color: '#C2861E', textTransform: 'uppercase', marginBottom: '10px' }}>Access</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '30px', letterSpacing: '-0.01em', margin: '0 0 6px' }}>
          Enter access code
        </h1>
        <p style={{ fontSize: '16px', color: '#A89E8B', lineHeight: 1.5, marginTop: 0, marginBottom: '18px' }}>
          This studio is shared with your team. Enter the access code to continue.
        </p>
        <input style={input} type="password" placeholder="Access code" value={code} autoFocus
          onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && code && enter()} />
        <button style={btn} disabled={busy || !code} onClick={enter}>{busy ? 'Checking…' : 'Enter studio →'}</button>
        {err ? <div style={{ marginTop: '12px', fontSize: '13px', color: '#C2453E', fontFamily: "'JetBrains Mono',monospace" }}>{err}</div> : null}
      </div>
    </div>
  );
}

// ---------- Splash ----------
function Splash({ text }: { text: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0F0E0B', color: '#A89E8B', fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', letterSpacing: '0.08em' }}>
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
    generateImage: (postId: string, prompt: string) => callImage({ prompt, workspaceId: ws, postId }),
    uploadImage: (postId: string, pngBase64: string) => uploadFigure({ pngBase64, workspaceId: ws, postId }),
  };
  const sessionProp = {
    email: session!.email, role: session!.role, workspaceId: ws,
    accounts: session!.accounts, accountId: ws,
    switchAccount: (id: string) => { if (id !== ws) { switchAccount(id); location.reload(); } },
    setTextKey: (key: string) => setTextKey(ws, key),
    signOut: () => { signOut().then(() => location.reload()); },
    joinWorkspace: (_id: string) => Promise.resolve(),
  };
  return <App key={ws} persistence={persistence} session={sessionProp} initialPosts={posts} initialStyle={style} />;
}
