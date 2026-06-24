import React from 'react';
import { flushSync } from 'react-dom';
import {
  SEM, NOW, rel, lcsDiff, monthAnchor, weekFocus, type Post, type Version,
} from './data';
import {
  MODELS, DEFAULT_MODEL, generateVersions, regenerateVersion, generateWeeklyAgenda, generateTopic, generateBrief, generateImagePrompt, generateChartSpec, generatePosterSpec, generateCarousel,
  type Settings,
} from './anthropic';
import { buildChartSVG, buildPosterSVG, buildSlideSVG, svgToPng } from './chart';
import { loadSettings, saveSettings, loadPosts, savePosts, loadStyle, saveStyle } from './store';
import { hasSupabase } from './supabaseClient';

const h = React.createElement;

function newId() {
  try { return crypto.randomUUID(); } catch { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2); }
}

// Optional collaborative wiring injected by the Supabase Root gate.
export interface Account { id: string; name: string; }
export interface AppSession { email: string; role: string; workspaceId: string; accounts?: Account[]; accountId?: string; switchAccount?: (id: string) => void; signOut: () => void; joinWorkspace: (id: string) => Promise<void>; }
export interface AppPersistence { savePosts: (posts: Post[]) => Promise<void>; saveStyle: (s: string) => Promise<void>; loadPosts: () => Promise<Post[]>; subscribe: (cb: () => void) => () => void; deletePosts?: (ids: string[]) => Promise<void>; generateImage?: (postId: string, prompt: string) => Promise<string>; uploadImage?: (postId: string, pngBase64: string) => Promise<string>; }
export interface AppProps { persistence?: AppPersistence; session?: AppSession; initialPosts?: Post[]; initialStyle?: string; }

// Fluid view morph: use the View Transitions API when available so switching
// between Calendar and Generation crossfades/morphs instead of cutting.
function fluid(apply: () => void) {
  const doc: any = document;
  if (doc.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    doc.startViewTransition(() => flushSync(apply));
  } else {
    apply();
  }
}

export default class App extends React.Component<AppProps, any> {
  _tid: any;
  _unsub: (() => void) | null = null;

  constructor(props: AppProps) {
    super(props);
    const posts = props.initialPosts || loadPosts() || [];
    this.state = {
      theme: 'dark', tab: 'calendar', selectedId: posts[0] ? posts[0].id : null,
      posts, styleProfile: props.initialStyle != null ? props.initialStyle : loadStyle(), settings: loadSettings(),
      editingVer: null, draft: '', modal: null,
      toast: null, styleOpen: false, whyOpen: {}, indL: 0, indW: 0,
      genBusy: false, agendaBusy: false, verBusy: null, briefBusy: null, planBusy: null,
      newPost: { topic: '', angle: '', format: 'opinion', priority: 'Medium', date: '' },
      joinId: '',
      viewYM: (() => { const a = monthAnchor(); return { y: a.y, m: a.m }; })(),
      allFilter: { status: 'All', format: 'All', q: '' },
      refUrl: '',
      imgBusy: false, imgPromptOpen: false, imgPromptDraft: '', carBusy: false, redoBusy: null,
    };
    this._tid = 0;
    this.tabRefs = {};
  }

  // ---------- persistence ----------
  persist(posts?: Post[]) {
    const data = posts || this.state.posts;
    if (this.props.persistence) { this.props.persistence.savePosts(data).catch((e: any) => this.toast('Save failed — ' + (e.message || e))); }
    else savePosts(data);
  }
  get connected() { return hasSupabase ? true : !!(this.state.settings && this.state.settings.apiKey); }
  saveSettings(s: Settings) { saveSettings(s); this.setState({ settings: s }); }

  tabRefs: Record<string, HTMLElement | null>;

  componentDidMount() {
    this.syncTab(); window.addEventListener('resize', this.syncTab);
    // realtime: when a teammate changes posts, reload from the shared store
    if (this.props.persistence) {
      this._unsub = this.props.persistence.subscribe(() => {
        this.props.persistence!.loadPosts().then((posts) => this.setState({ posts })).catch(() => {});
      });
    }
  }
  componentWillUnmount() { window.removeEventListener('resize', this.syncTab); if (this._unsub) this._unsub(); }
  componentDidUpdate(_p: {}, prev: any) {
    if (prev.tab !== this.state.tab || prev.theme !== this.state.theme) this.syncTab();
  }
  syncTab = () => {
    const el = this.tabRefs[this.state.tab];
    if (el && (el.offsetLeft !== this.state.indL || el.offsetWidth !== this.state.indW)) {
      this.setState({ indL: el.offsetLeft, indW: el.offsetWidth });
    }
  };

  // ---------- theme ----------
  get C() {
    const d = this.state.theme === 'dark';
    // Pragma DS — Ink #0F0E0B · Gold #C2861E · Cream #F2EEE4. Predominantly dark.
    return d ? {
      dark: true, bg: '#0F0E0B', panel: '#15130D', card: '#19160F', card2: '#141209', raise: '#1F1B13',
      border: '#2B261C', borderSoft: 'rgba(242,238,228,0.08)',
      text: '#EDE7DA', dim: '#C3BAA9', faint: '#8B8172', heading: '#F6F1E6', accent: '#D29A33',
      primBg: '#C2861E', primFg: '#0F0E0B',
      glass: 'rgba(22,20,14,0.68)', glassBorder: 'rgba(242,238,228,0.10)', glassHi: 'rgba(242,238,228,0.30)',
      shadow: '0 16px 50px rgba(0,0,0,0.55)', input: '#141209',
      surf: 'rgba(21,19,13,0.58)', surf2: 'rgba(28,24,17,0.52)', surfBorder: 'rgba(242,238,228,0.09)',
      surfHi: 'rgba(242,238,228,0.14)', surfShadow: '0 10px 34px rgba(0,0,0,0.42)',
    } : {
      dark: false, bg: '#F2EEE4', panel: '#F7F4EC', card: '#FBF9F3', card2: '#F4F0E6', raise: '#FFFFFF',
      border: '#E1DACA', borderSoft: 'rgba(15,14,11,0.08)',
      text: '#1A1711', dim: '#574F42', faint: '#8A8071', heading: '#0F0E0B', accent: '#A06E18',
      primBg: '#C2861E', primFg: '#0F0E0B',
      glass: 'rgba(247,244,236,0.74)', glassBorder: 'rgba(255,255,255,0.85)', glassHi: 'rgba(255,255,255,0.9)',
      shadow: '0 16px 50px rgba(15,14,11,0.12)', input: '#FFFFFF',
      surf: 'rgba(251,249,243,0.66)', surf2: 'rgba(244,240,230,0.55)', surfBorder: 'rgba(255,255,255,0.7)',
      surfHi: 'rgba(255,255,255,0.95)', surfShadow: '0 10px 34px rgba(15,14,11,0.10)',
    };
  }

  // Reusable liquid-glass surface style. `soft` => lighter tint for nested panels.
  glass(opt: any = {}) {
    const C = this.C;
    const blur = opt.blur || 22;
    return {
      background: opt.soft ? C.surf2 : C.surf,
      backdropFilter: `blur(${blur}px) saturate(165%)`, WebkitBackdropFilter: `blur(${blur}px) saturate(165%)`,
      border: '1px solid ' + C.surfBorder,
      boxShadow: 'inset 0 1px 0 ' + C.surfHi + ', ' + (opt.shadow || C.surfShadow),
    } as any;
  }
  statusMeta(s: string): any {
    const C = this.C;
    const map: any = {
      'Draft': { fg: C.dim, bg: C.dark ? 'rgba(150,155,164,0.12)' : 'rgba(107,112,121,0.10)', dot: C.faint },
      'In Review': { fg: SEM.warning, bg: 'rgba(201,162,75,0.15)', dot: SEM.warning },
      'Approved': { fg: SEM.success, bg: 'rgba(46,139,116,0.16)', dot: SEM.success },
      'Published': { fg: C.dark ? '#0A0B0D' : '#FFFFFF', bg: C.dark ? '#C2861E' : '#0F0E0B', dot: C.accent, solid: true },
    };
    return map[s] || map['Draft'];
  }
  prioMeta(p: string) { return p === 'High' ? { c: SEM.error, l: 'High' } : p === 'Medium' ? { c: SEM.warning, l: 'Medium' } : { c: this.C.faint, l: 'Low' }; }

  // ---------- ui atoms ----------
  Btn(label: any, onClick: any, opt: any = {}) {
    const C = this.C; const v = opt.variant || 'ghost';
    const base: any = {
      display: 'inline-flex', alignItems: 'center', gap: '7px', fontFamily: "'JetBrains Mono',monospace",
      fontWeight: 600, fontSize: opt.sm ? '12px' : '13px', letterSpacing: '0.05em', textTransform: 'uppercase', borderRadius: '3px',
      padding: opt.sm ? '9px 13px' : '12px 18px', border: '1px solid transparent', whiteSpace: 'nowrap', lineHeight: 1
    };
    const styles: any = {
      primary: { background: C.primBg, color: C.primFg, fontWeight: 600 },
      ghost: { background: 'transparent', color: C.text, borderColor: C.border },
      glass: { background: C.glass, color: C.text, borderColor: C.glassBorder, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' },
      soft: { background: C.dark ? 'rgba(242,238,228,0.05)' : 'rgba(15,14,11,0.04)', color: C.text, borderColor: C.borderSoft },
      success: { background: 'rgba(46,139,116,0.16)', color: SEM.success, borderColor: 'rgba(46,139,116,0.4)' },
      danger: { background: 'rgba(194,69,62,0.14)', color: SEM.error, borderColor: 'rgba(194,69,62,0.4)' },
    };
    return h('button', {
      className: 'pcs-btn', onClick, disabled: opt.disabled,
      style: { ...base, ...styles[v], opacity: opt.disabled ? 0.45 : 1, cursor: opt.disabled ? 'not-allowed' : 'pointer', ...(opt.style || {}) }
    },
      opt.icon ? h('span', { style: { fontSize: '16px', lineHeight: 1, fontFamily: 'system-ui' } }, opt.icon) : null, label);
  }
  Pill(label: any, color: any, opt: any = {}) {
    const C = this.C;
    return h('span', {
      style: {
        display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: "'Cormorant Garamond',serif",
        fontSize: opt.fs || '11px', fontWeight: 600, letterSpacing: '0.01em', padding: opt.pad || '4px 9px', borderRadius: '999px',
        background: opt.solid ? (opt.bg || color) : (opt.bg || 'transparent'), color: opt.solid ? (opt.solidFg || (C.dark ? '#0A0B0D' : '#fff')) : (opt.fg || color),
        border: opt.border || 'none', lineHeight: 1, ...(opt.style || {})
      }
    },
      opt.dot ? h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: opt.dot } }) : null, label);
  }
  StatusBadge(s: string) { const m = this.statusMeta(s); return m.solid ? this.Pill(s, m.fg, { solid: true, bg: m.bg, solidFg: m.fg }) : this.Pill(s, m.fg, { bg: m.bg, fg: m.fg, dot: m.dot }); }
  // Small ↻ that replaces a topic with a fresh, trending one.
  RedoBtn(id: string, opt: any = {}) {
    const C = this.C; const busy = this.state.redoBusy === id; const s = opt.sm ? 20 : 24;
    return h('button', {
      key: 'redo', className: 'pcs-btn', title: 'Refresh this topic (trending)', disabled: busy,
      onClick: (e: any) => { e.stopPropagation(); this.redoTopic(id); },
      style: {
        width: s + 'px', height: s + 'px', borderRadius: '8px', border: '1px solid ' + C.border, flexShrink: 0,
        background: C.dark ? 'rgba(194,134,30,0.10)' : 'rgba(194,134,30,0.08)', color: C.accent,
        fontSize: opt.sm ? '11.5px' : '13px', lineHeight: 1, display: 'grid', placeItems: 'center', opacity: busy ? 0.5 : 1,
        animation: busy ? 'pcsPulse 1s ease-in-out infinite' : 'none',
      },
    }, busy ? '·' : '↻');
  }
  // Small × that opens the delete-confirm modal. Stops propagation so it doesn't open the post.
  DeleteBtn(id: string, opt: any = {}) {
    const C = this.C; const s = opt.sm ? 24 : 28;
    return h('button', {
      key: 'del', className: 'pcs-btn', title: 'Remove topic',
      onClick: (e: any) => { e.stopPropagation(); this.setState({ modal: { type: 'delete', id } }); },
      style: {
        width: s + 'px', height: s + 'px', borderRadius: '8px', border: '1px solid ' + C.border, flexShrink: 0,
        background: C.dark ? 'rgba(255,255,255,0.05)' : 'rgba(8,9,11,0.04)', color: C.faint,
        fontSize: '14px', lineHeight: 1, display: 'grid', placeItems: 'center', ...(opt.style || {}),
      },
    }, '✕');
  }
  FormatTag(f: string) {
    const C = this.C; return h('span', {
      style: {
        fontFamily: "'JetBrains Mono',monospace", fontSize: '11.5px', fontWeight: 500,
        letterSpacing: '0.06em', textTransform: 'uppercase', color: C.faint
      }
    }, f);
  }

  // ---------- helpers ----------
  fmtDay(d: string) { return parseInt(d.split('-')[2], 10); }
  fmtLong(d: string) { const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
  post(id: string): Post | undefined { return this.state.posts.find((p: Post) => p.id === id); }
  activeAccountName(): string { const s = this.props.session; if (!s || !s.accounts) return ''; const a = s.accounts.find((x) => x.id === s.accountId); return a ? a.name : ''; }
  toast(msg: string) { this.setState({ toast: msg }); clearTimeout(this._tid); this._tid = setTimeout(() => this.setState({ toast: null }), 2200); }

  // ---------- actions ----------
  setTheme(t: string) { fluid(() => this.setState({ theme: t })); }
  setTab(t: string) { fluid(() => this.setState({ tab: t })); }
  openPost(id: string) { fluid(() => this.setState({ tab: 'generate', selectedId: id, editingVer: null })); }
  setStatus(id: string, s: string) { const posts = this.state.posts.map((p: Post) => p.id === id ? { ...p, status: s } : p); this.setState({ posts }); this.persist(posts); this.toast('Status → ' + s); }
  setActiveVer(i: number) { const p = this.post(this.state.selectedId)!; p.activeVer = i; this.forceUpdate(); this.persist(); }
  movePost(id: string, date: string) { const posts = this.state.posts.map((p: Post) => p.id === id ? { ...p, date } : p); this.setState({ posts }); this.persist(posts); }
  deletePost(id: string) {
    const posts = this.state.posts.filter((p: Post) => p.id !== id);
    const wasSelected = this.state.selectedId === id;
    const selectedId = wasSelected ? (posts[0] ? posts[0].id : null) : this.state.selectedId;
    const tab = (wasSelected && this.state.tab === 'generate') ? 'calendar' : this.state.tab;
    this.setState({ posts, selectedId, tab, modal: null });
    this.persist(posts);
    // Collab mode: savePosts only upserts, so removed rows need an explicit delete.
    if (this.props.persistence && this.props.persistence.deletePosts) this.props.persistence.deletePosts([id]).catch(() => {});
    this.toast('Topic removed');
  }
  shiftMonth(delta: number) { const { y, m } = this.state.viewYM; const d = new Date(y, m + delta, 1); fluid(() => this.setState({ viewYM: { y: d.getFullYear(), m: d.getMonth() } })); }
  goToday() { const a = monthAnchor(); fluid(() => this.setState({ viewYM: { y: a.y, m: a.m } })); }

  // ---------- backup / export / import ----------
  exportData() {
    const payload = {
      app: 'pragma-content-studio', version: 1, exportedAt: NOW(),
      posts: this.state.posts, style: this.state.styleProfile,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = 'pragma-content-studio-' + stamp + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.toast('Backup downloaded ⤓');
  }
  importData(file: File, mode: 'replace' | 'merge') {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || '{}'));
        const incoming: Post[] = Array.isArray(data.posts) ? data.posts : [];
        if (!incoming.length && typeof data.style !== 'string') { this.toast('Nothing to import in that file'); return; }
        let posts: Post[];
        if (mode === 'merge') {
          const byId: Record<string, Post> = {};
          [...this.state.posts, ...incoming].forEach((p) => { if (p && p.id) byId[p.id] = p; });
          posts = Object.keys(byId).map((k) => byId[k]);
        } else {
          posts = incoming;
        }
        const style = typeof data.style === 'string' && data.style.length ? data.style : this.state.styleProfile;
        const selectedId = posts.find((p) => p.id === this.state.selectedId) ? this.state.selectedId : (posts[0] ? posts[0].id : null);
        this.setState({ posts, styleProfile: style, selectedId, modal: null });
        this.persist(posts);
        if (style !== this.state.styleProfile) { if (this.props.persistence) this.props.persistence.saveStyle(style).catch(() => {}); else saveStyle(style); }
        this.toast('Imported ' + incoming.length + ' posts ✓');
      } catch (e: any) { this.toast('Import failed — invalid file'); }
    };
    reader.readAsText(file);
  }
  setStyle(v: string) { this.setState({ styleProfile: v }); }
  saveStyleProfile() {
    if (this.props.persistence) { this.props.persistence.saveStyle(this.state.styleProfile).then(() => this.toast('Writing style saved')).catch((e: any) => this.toast('Save failed — ' + (e.message || e))); }
    else { saveStyle(this.state.styleProfile); this.toast('Writing style saved'); }
  }

  getVersions(post: Post): Version[] { return post.versions || []; }

  startEdit(vi: number) { const p = this.post(this.state.selectedId)!; const v = this.getVersions(p)[vi]; this.setState({ editingVer: vi, draft: v.body }); }
  cancelEdit() { this.setState({ editingVer: null, draft: '' }); }
  saveEdit(vi: number) {
    const p = this.post(this.state.selectedId)!; const vers = this.getVersions(p); const v = vers[vi];
    if (this.state.draft !== v.body) {
      v.history = [{ body: v.body, hook: v.hook, editor: v.editor || 'AI draft', ts: v.ts, label: 'v' + (v.history.length + 1) }, ...v.history];
      v.body = this.state.draft; v.editor = 'You'; v.ts = NOW();
    }
    this.setState({ editingVer: null, draft: '' }); this.persist(); this.toast('Saved — new version logged');
  }
  approve(vi: number) {
    const p = this.post(this.state.selectedId)!; const vers = this.getVersions(p);
    vers.forEach((v, i) => v.approved = (i === vi)); p.activeVer = vi; p.status = 'Approved';
    this.setState({ posts: [...this.state.posts] }); this.persist(); this.toast('Approved ✓');
  }
  revert(vi: number, hi: number) {
    const p = this.post(this.state.selectedId)!; const v = this.getVersions(p)[vi]; const snap = v.history[hi];
    v.history = [{ body: v.body, hook: v.hook, editor: v.editor || 'AI draft', ts: v.ts, label: 'pre-revert' }, ...v.history];
    v.body = snap.body; v.hook = snap.hook!; v.editor = 'You (revert)'; v.ts = NOW();
    this.setState({ modal: null }); this.persist(); this.toast('Reverted to ' + snap.label);
  }
  schedule(vi: number) {
    const p = this.post(this.state.selectedId)!; this.approve(vi); p.scheduledFor = p.date; p.status = 'Approved';
    this.setState({ modal: null, posts: [...this.state.posts] }); this.persist(); this.toast('Scheduled for ' + this.fmtLong(p.date));
  }

  // ---------- Claude-powered actions ----------
  needsConnection(): boolean {
    if (this.connected) return false;
    this.openSettings();
    this.toast('Connect your Claude account first');
    return true;
  }
  async generateForSelected() {
    if (this.needsConnection()) return;
    const p = this.post(this.state.selectedId)!;
    this.setState({ genBusy: true });
    try {
      const vers = await generateVersions(this.state.settings, p, this.state.styleProfile, this.perfSummary(), this.state.refUrl);
      p.versions = vers; p.activeVer = 0;
      this.setState({ posts: [...this.state.posts], genBusy: false }); this.persist();
      this.toast('Generated 3 versions');
    } catch (e: any) { this.setState({ genBusy: false }); this.toast('Generation failed — ' + (e.message || e)); }
  }
  async regenerate(vi: number) {
    if (this.needsConnection()) return;
    const p = this.post(this.state.selectedId)!; const vers = this.getVersions(p); const v = vers[vi];
    if (!v) return;
    this.setState({ verBusy: vi });
    try {
      const alt = await regenerateVersion(this.state.settings, p, this.state.styleProfile, { label: v.label, hook: v.hook }, this.perfSummary(), this.state.refUrl);
      v.history = [{ body: v.body, hook: v.hook, editor: v.editor || 'AI draft', ts: v.ts, label: 'v' + (v.history.length + 1) }, ...v.history];
      v.body = alt.body; v.hook = alt.hook; v.method = alt.method || v.method; v.methodNote = alt.methodNote || v.methodNote; v.why = alt.why || v.why;
      v.editor = 'AI draft'; v.ts = NOW(); v.regenCount = (v.regenCount || 0) + 1;
      this.setState({ verBusy: null }); this.persist(); this.toast('Regenerated — fresh draft');
    } catch (e: any) { this.setState({ verBusy: null }); this.toast('Regenerate failed — ' + (e.message || e)); }
  }
  async runRefreshAgenda() {
    if (this.needsConnection()) return;
    this.setState({ agendaBusy: true });
    try {
      const { y, m } = monthAnchor();
      const monday = this.mondayOfThisWeek();
      const weekLabel = new Date(y, m, monday.getDate()).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      const items = await generateWeeklyAgenda(this.state.settings, this.state.styleProfile, 5, weekLabel + ' (this week)');
      const made: Post[] = items.map((a) => {
        const d = new Date(monday); d.setDate(monday.getDate() + a.dayOffset);
        const date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        return { id: newId(), date, topic: a.topic, angle: a.angle, format: a.format, status: 'Draft', priority: a.priority, change: 'new', scheduledFor: null, versions: null, activeVer: 0 };
      });
      const posts = [...made, ...this.state.posts];
      this.setState({ posts, agendaBusy: false }); this.persist(posts);
      this.toast(made.length + ' topics added for this week');
    } catch (e: any) { this.setState({ agendaBusy: false }); this.toast('Agenda failed — ' + (e.message || e)); }
  }
  // Replace a single topic with a fresh, trending one (keeps its calendar slot).
  async redoTopic(id: string) {
    if (this.needsConnection()) return;
    const p = this.post(id); if (!p) return;
    this.setState({ redoBusy: id });
    try {
      const existing = this.state.posts.map((x: Post) => x.topic).filter(Boolean);
      const t = await generateTopic(this.state.settings, this.state.styleProfile, existing);
      p.topic = t.topic; p.angle = t.angle; p.format = t.format || p.format; p.priority = t.priority || p.priority;
      p.change = 'new'; p.versions = null; p.activeVer = 0; p.status = 'In Review';
      p.image = null; p.images = null; p.imagePrompt = null; (p as any).brief = null;
      this.setState({ redoBusy: null, posts: [...this.state.posts] }); this.persist(); this.toast('Topic refreshed ↻');
    } catch (e: any) { this.setState({ redoBusy: null }); this.toast('Redo failed — ' + (e.message || e)); }
  }
  // End-to-end: fetch this week's agenda, populate the calendar, then draft 3 versions for each.
  async runPlanWeek() {
    if (this.needsConnection()) return;
    this.setState({ planBusy: { done: 0, total: 0 } });
    try {
      const { y, m } = monthAnchor();
      const monday = this.mondayOfThisWeek();
      const weekLabel = new Date(y, m, monday.getDate()).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      const items = await generateWeeklyAgenda(this.state.settings, this.state.styleProfile, 5, weekLabel + ' (this week)');
      const made: Post[] = items.map((a) => {
        const d = new Date(monday); d.setDate(monday.getDate() + a.dayOffset);
        const date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        return { id: newId(), date, topic: a.topic, angle: a.angle, format: a.format, status: 'Draft', priority: a.priority, change: 'new', scheduledFor: null, versions: null, activeVer: 0 };
      });
      let posts = [...made, ...this.state.posts];
      this.setState({ posts, planBusy: { done: 0, total: made.length } }); this.persist(posts);
      // Draft each topic in turn, surfacing progress and persisting as we go.
      const hint = this.perfSummary();
      for (let k = 0; k < made.length; k++) {
        try {
          const vers = await generateVersions(this.state.settings, made[k], this.state.styleProfile, hint);
          const target = this.state.posts.find((p) => p.id === made[k].id);
          if (target) { target.versions = vers; target.activeVer = 0; target.status = 'In Review'; }
        } catch { /* skip a failed topic, keep going */ }
        posts = [...this.state.posts];
        this.setState({ posts, planBusy: { done: k + 1, total: made.length } }); this.persist(posts);
      }
      this.setState({ planBusy: null });
      this.toast('Week planned — ' + made.length + ' topics drafted ✦');
    } catch (e: any) { this.setState({ planBusy: null }); this.toast('Planning failed — ' + (e.message || e)); }
  }
  async genBrief(id: string) {
    if (this.needsConnection()) return;
    const p = this.post(id)!; this.setState({ briefBusy: id });
    try {
      const b = await generateBrief(this.state.settings, p);
      (p as any).brief = b;
      this.setState({ posts: [...this.state.posts], briefBusy: null }); this.persist();
    } catch (e: any) { this.setState({ briefBusy: null }); this.toast('Brief failed — ' + (e.message || e)); }
  }
  mondayOfThisWeek(): Date { const now = new Date(); const d = new Date(now); d.setDate(now.getDate() - ((now.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d; }
  // Snap a date to the nearest weekday (no posts on weekends).
  toWeekday(iso: string): string {
    const d = new Date(iso + 'T00:00:00'); const g = d.getDay();
    if (g === 6) d.setDate(d.getDate() + 2); else if (g === 0) d.setDate(d.getDate() + 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  todayISO(): string { const a = monthAnchor(); return this.toWeekday(a.y + '-' + a.mm + '-' + String(a.today).padStart(2, '0')); }
  openNewPost() { this.setState({ modal: { type: 'newpost' }, newPost: { topic: '', angle: '', format: 'opinion', priority: 'Medium', date: this.todayISO() } }); }
  createPost() {
    const np = this.state.newPost;
    if (!np.topic.trim()) { this.toast('Add a topic'); return; }
    const date = this.toWeekday((np.date && /^\d{4}-\d{2}-\d{2}$/.test(np.date)) ? np.date : this.todayISO());
    const post: Post = { id: newId(), date, topic: np.topic.trim(), angle: np.angle.trim(), format: np.format, status: 'Draft', priority: np.priority, change: 'new', scheduledFor: null, versions: null, activeVer: 0 };
    const posts = [post, ...this.state.posts];
    const [py, pm] = date.split('-');
    this.setState({ posts, modal: null, viewYM: { y: parseInt(py, 10), m: parseInt(pm, 10) - 1 }, newPost: { topic: '', angle: '', format: 'opinion', priority: 'Medium', date: this.todayISO() } });
    this.persist(posts);
    this.openPost(post.id);
  }

  // ---------- publish + analytics ----------
  postText(v: Version) { return ((v.hook || '') + '\n\n' + (v.body || '')).trim(); }
  // ---------- post image / figure ----------
  get canImage(): boolean { return !!(this.props.persistence && this.props.persistence.generateImage); }
  get canFigure(): boolean { return !!(this.props.persistence && this.props.persistence.uploadImage); }
  approvedVersion(p: Post): Version | null { return this.getVersions(p).find((x) => x.approved) || null; }
  // Rich editorial poster: the model designs a layered spec, rendered as a PNG.
  async genFigure() {
    const p = this.post(this.state.selectedId)!; if (!p) return;
    if (!this.canFigure) { this.toast('Figures need the shared studio'); return; }
    const v = this.approvedVersion(p);
    if (!v) { this.toast('Approve a version first'); return; }
    this.setState({ imgBusy: true });
    try {
      const spec = await generatePosterSpec(this.state.settings, p, this.postText(v));
      if (!spec || !(spec.title || spec.stats || spec.bars)) throw new Error('Could not design an image');
      const png = await svgToPng(buildPosterSVG(spec));
      const url = await this.props.persistence!.uploadImage!(p.id, png);
      p.image = url; p.imagePrompt = 'Image — ' + (spec.title || spec.kicker || 'editorial');
      this.setState({ imgBusy: false, imgPromptOpen: false, imgPromptDraft: '', posts: [...this.state.posts] });
      this.persist(); this.toast('Figure generated 📊');
    } catch (e: any) { this.setState({ imgBusy: false }); this.toast('Figure failed — ' + (e.message || e)); }
  }
  async genImage(custom?: string) {
    const p = this.post(this.state.selectedId)!; if (!p) return;
    if (!this.canImage) { this.toast('Image generation needs the shared studio'); return; }
    const v = this.approvedVersion(p);
    if (!v) { this.toast('Approve a version first'); return; }
    this.setState({ imgBusy: true });
    try {
      let prompt = (custom || '').trim();
      if (!prompt) prompt = await generateImagePrompt(this.state.settings, p, this.postText(v));
      const url = await this.props.persistence!.generateImage!(p.id, prompt);
      p.image = url; p.imagePrompt = prompt;
      this.setState({ imgBusy: false, imgPromptOpen: false, imgPromptDraft: '', posts: [...this.state.posts] });
      this.persist(); this.toast('Image generated 🖼️');
    } catch (e: any) { this.setState({ imgBusy: false }); this.toast('Image failed — ' + (e.message || e)); }
  }
  // Carousel: the model designs ≤3 connected slides; we render + upload each.
  async genCarousel() {
    const p = this.post(this.state.selectedId)!; if (!p) return;
    if (!this.canFigure) { this.toast('Carousels need the shared studio'); return; }
    const v = this.approvedVersion(p);
    if (!v) { this.toast('Approve a version first'); return; }
    this.setState({ carBusy: true });
    try {
      const data = await generateCarousel(this.state.settings, p, this.postText(v));
      const slides = (data && Array.isArray(data.slides) ? data.slides : []).slice(0, 3);
      if (!slides.length) throw new Error('Could not design slides');
      const urls: string[] = [];
      for (let i = 0; i < slides.length; i++) {
        const png = await svgToPng(buildSlideSVG(slides[i], i, slides.length));
        urls.push(await this.props.persistence!.uploadImage!(p.id, png));
      }
      p.images = urls;
      this.setState({ carBusy: false, posts: [...this.state.posts] });
      this.persist(); this.toast(urls.length + '-slide carousel generated 🎠');
    } catch (e: any) { this.setState({ carBusy: false }); this.toast('Carousel failed — ' + (e.message || e)); }
  }
  removeCarousel() {
    const p = this.post(this.state.selectedId)!; if (!p) return;
    p.images = null; this.setState({ posts: [...this.state.posts] }); this.persist(); this.toast('Carousel removed');
  }
  removeImage() {
    const p = this.post(this.state.selectedId)!; if (!p) return;
    p.image = null; p.imagePrompt = null;
    this.setState({ posts: [...this.state.posts] }); this.persist(); this.toast('Image removed');
  }
  markPublished(vi: number) {
    const p = this.post(this.state.selectedId)!; const vers = this.getVersions(p);
    vers.forEach((v, k) => v.approved = (k === vi)); p.activeVer = vi; p.status = 'Published'; p.publishedAt = NOW();
    this.setState({ modal: null, posts: [...this.state.posts] }); this.persist(); this.toast('Marked as published 🚀');
  }
  setMetric(id: string, key: 'impressions' | 'reactions' | 'comments', value: number) {
    const posts = this.state.posts.map((p: Post) => p.id === id ? { ...p, metrics: { ...(p.metrics || {}), [key]: value } } : p);
    this.setState({ posts }); this.persist(posts);
  }
  engagement(p: Post) { const m = p.metrics || {}; return (m.reactions || 0) + (m.comments || 0); }
  // A short "what worked" hint fed back into generation prompts.
  perfSummary(): string {
    const withM = this.state.posts.filter((p) => p.metrics && (p.metrics.reactions || p.metrics.comments || p.metrics.impressions));
    if (withM.length < 2) return '';
    const byFmt: Record<string, number[]> = {};
    withM.forEach((p) => { (byFmt[p.format] = byFmt[p.format] || []).push(this.engagement(p)); });
    const fmtAvg = Object.keys(byFmt).map((f) => [f, byFmt[f].reduce((a, b) => a + b, 0) / byFmt[f].length] as [string, number]).sort((a, b) => b[1] - a[1]);
    const topFmts = fmtAvg.slice(0, 2).map((x) => x[0]).join(', ');
    const ranked = [...withM].sort((a, b) => this.engagement(b) - this.engagement(a));
    const topHooks = ranked.slice(0, 2).map((p) => { const v = (p.versions || [])[p.activeVer]; return v && v.hook ? '"' + v.hook.slice(0, 90) + '"' : null; }).filter(Boolean).join('; ');
    let s = '';
    if (topFmts) s += 'best-performing formats: ' + topFmts + '. ';
    if (topHooks) s += 'top hooks: ' + topHooks;
    return s.trim();
  }

  // ---------- render ----------
  render() { return this.renderApp(); }

  renderApp() {
    const C = this.C;
    return h('div', {
      className: 'pcs-scroll', style: {
        minHeight: '100vh', height: '100vh', overflow: 'auto', background: C.bg, color: C.text,
        fontFamily: "'Cormorant Garamond',serif", position: 'relative', transition: 'background .3s ease,color .3s ease'
      }
    },
      // editorial mesh — the signature 32px grid texture, discreet and precise
      h('div', {
        style: {
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: 'linear-gradient(' + (C.dark ? 'rgba(242,238,228,0.022)' : 'rgba(15,14,11,0.03)') + ' 1px, transparent 1px), linear-gradient(90deg, ' + (C.dark ? 'rgba(242,238,228,0.022)' : 'rgba(15,14,11,0.03)') + ' 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }
      }),
      // a single warm gold glow — gold used with parsimony
      h('div', {
        style: {
          position: 'fixed', inset: '-15%', pointerEvents: 'none', zIndex: 0,
          animation: 'pcsDrift 30s ease-in-out infinite',
          background: C.dark
            ? 'radial-gradient(800px 540px at 82% -8%, rgba(194,134,30,0.10), transparent 62%), radial-gradient(620px 520px at 4% 16%, rgba(194,134,30,0.045), transparent 64%)'
            : 'radial-gradient(820px 560px at 84% -10%, rgba(194,134,30,0.12), transparent 62%), radial-gradient(640px 540px at 2% 14%, rgba(194,134,30,0.06), transparent 64%)',
        }
      }),
      h('div', { style: { position: 'relative', zIndex: 1, maxWidth: '1280px', margin: '0 auto', padding: '0 28px 80px' } },
        this.renderHeader(),
        h('div', { key: this.state.tab, style: { viewTransitionName: 'pcs-view', animation: 'pcsViewIn .42s var(--pcs-ease) both' } as any },
          this.state.tab === 'calendar' ? this.renderCalendar()
            : this.state.tab === 'all' ? this.renderAllPosts()
              : this.state.tab === 'topics' ? this.renderTopics()
                : this.state.tab === 'analytics' ? this.renderAnalytics()
                  : this.state.tab === 'accounts' ? this.renderAccounts()
                    : this.renderGenerator()),
      ),
      this.renderModal(),
      this.renderToast(),
    );
  }

  renderToast() {
    if (!this.state.toast) return null; const C = this.C;
    return h('div', {
      style: {
        position: 'fixed', bottom: '26px', left: '50%', transform: 'translateX(-50%)', zIndex: 80,
        background: C.glass, backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        border: '1px solid ' + C.glassBorder, boxShadow: 'inset 0 1px 0 ' + C.glassHi + ', ' + C.shadow, borderRadius: '14px',
        padding: '12px 20px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '15.5px', color: C.text, animation: 'pcsPop .25s ease'
      }
    },
      this.state.toast);
  }

  renderHeader() {
    const C = this.C; const tab = this.state.tab;
    const Tab = (id: string, label: string) => {
      const on = tab === id;
      return h('button', {
        className: 'pcs-btn', onClick: () => this.setTab(id), ref: (el: HTMLElement | null) => { this.tabRefs[id] = el; },
        style: {
          position: 'relative', zIndex: 1, fontFamily: "'JetBrains Mono',monospace", fontWeight: 500,
          fontSize: '13px', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '9px 15px', borderRadius: '3px', border: 'none',
          background: 'transparent', color: on ? C.heading : C.dim
        }
      }, label);
    };
    const ThemeBtn = (t: string, gly: string) => {
      const on = this.state.theme === t;
      return h('button', {
        className: 'pcs-btn', onClick: () => this.setTheme(t), title: t, style: {
          width: '30px', height: '30px', borderRadius: '8px',
          border: 'none', display: 'grid', placeItems: 'center', fontSize: '16px', background: on ? (C.dark ? 'rgba(255,255,255,0.12)' : '#fff') : 'transparent',
          color: on ? C.heading : C.faint, boxShadow: on ? (C.dark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)') : 'none'
        }
      }, gly);
    };
    return h('div', { style: { position: 'sticky', top: 0, zIndex: 40, paddingTop: '16px', marginBottom: '8px' } },
      h('div', {
        style: {
          display: 'flex', alignItems: 'center', gap: '18px', padding: '12px 14px 12px 18px', borderRadius: '18px',
          background: C.glass, backdropFilter: 'blur(28px) saturate(170%)', WebkitBackdropFilter: 'blur(28px) saturate(170%)',
          border: '1px solid ' + C.glassBorder, boxShadow: 'inset 0 1px 0 ' + C.glassHi + ', ' + C.shadow
        }
      },
        // brand — Pragma wordmark
        h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '12px', marginRight: '4px' } },
          h('span', { style: { fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '23px', letterSpacing: '0', color: C.heading, lineHeight: 1 } }, 'Pragma', h('span', { style: { color: C.accent } }, '.')),
          h('span', { style: { width: '1px', height: '16px', background: C.border, alignSelf: 'center' } }),
          h('span', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '10.5px', letterSpacing: '0.16em', color: C.faint, textTransform: 'uppercase' } }, 'Content Studio'),
        ),
        // tabs — sliding liquid-glass indicator behind the active tab
        h('div', { style: { position: 'relative', display: 'flex', gap: '4px', padding: '4px', borderRadius: '12px', background: C.dark ? 'rgba(0,0,0,0.25)' : 'rgba(8,9,11,0.05)' } },
          h('div', {
            className: 'pcs-tab-ind', style: {
              position: 'absolute', top: '4px', bottom: '4px', left: 0, width: (this.state.indW || 0) + 'px',
              transform: 'translateX(' + (this.state.indL || 0) + 'px)', borderRadius: '3px', zIndex: 0,
              background: C.dark ? 'rgba(242,238,228,0.10)' : 'rgba(255,255,255,0.95)',
              boxShadow: 'inset 0 0 0 1px ' + (C.dark ? 'rgba(194,134,30,0.35)' : 'rgba(15,14,11,0.10)'),
            }
          }),
          Tab('calendar', 'Calendar'), Tab('all', 'All Posts'), Tab('topics', 'Topic Briefs'), Tab('generate', 'Generation'), Tab('analytics', 'Analytics'),
          (this.props.session && this.props.session.accounts && this.props.session.accounts.length > 1) ? Tab('accounts', 'Accounts') : null),
        h('div', { style: { flex: 1 } }),
        // connect-to-Claude status / button
        h('button', {
          className: 'pcs-btn', onClick: () => this.openSettings(),
          title: this.connected ? 'Claude connected' : 'Connect your Claude account',
          style: {
            display: 'inline-flex', alignItems: 'center', gap: '7px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 600,
            fontSize: '14.5px', padding: '8px 13px', borderRadius: '10px', marginRight: '8px',
            border: '1px solid ' + (this.connected ? 'rgba(46,139,116,0.4)' : C.border),
            background: this.connected ? 'rgba(46,139,116,0.14)' : (C.dark ? 'rgba(255,255,255,0.06)' : 'rgba(8,9,11,0.05)'),
            color: this.connected ? SEM.success : C.text,
          }
        },
          h('span', { style: { width: '7px', height: '7px', borderRadius: '50%', background: this.connected ? SEM.success : C.faint } }),
          this.props.session ? (this.activeAccountName() || this.props.session.email || 'Shared studio') : (this.connected ? 'Claude connected' : 'Connect Claude')),
        // theme toggle
        h('div', { style: { display: 'flex', gap: '2px', padding: '3px', borderRadius: '10px', background: C.dark ? 'rgba(0,0,0,0.25)' : 'rgba(8,9,11,0.05)' } },
          ThemeBtn('light', '☀'), ThemeBtn('dark', '☽')),
      ),
    );
  }

  renderCalendar() {
    const C = this.C;
    const visible = this.state.posts;
    // Grid is anchored to the month the user is viewing; "today" only lights up in the real current month.
    const { y, m } = this.state.viewYM;
    const anchor = monthAnchor();
    const isCur = y === anchor.y && m === anchor.m;
    const today = isCur ? anchor.today : -1;
    const dim = new Date(y, m + 1, 0).getDate();
    const monthName = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long' });
    // Weekdays only (Mon–Fri) — no posts are published on weekends.
    const cells: (number | null)[] = [];
    for (let d = 1; d <= dim; d++) {
      const wdIdx = (new Date(y, m, d).getDay() + 6) % 7; // 0=Mon … 6=Sun
      if (wdIdx > 4) continue;                              // skip Sat/Sun
      if (cells.length === 0 && wdIdx > 0) for (let k = 0; k < wdIdx; k++) cells.push(null);
      cells.push(d);
    }
    while (cells.length % 5 !== 0) cells.push(null);
    // Only place posts that actually fall in the viewed month/year.
    const monthPosts = visible.filter((p: Post) => { const pp = (p.date || '').split('-'); return parseInt(pp[0], 10) === y && parseInt(pp[1], 10) === m + 1; });
    const byDay: any = {}; monthPosts.forEach((p: Post) => { const dd = this.fmtDay(p.date); (byDay[dd] = byDay[dd] || []).push(p); });
    const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const navBtn = (gly: string, fn: () => void, title: string) => h('button', {
      className: 'pcs-btn', onClick: fn, title,
      style: { width: '32px', height: '32px', borderRadius: '9px', border: '1px solid ' + C.border, background: C.dark ? 'rgba(255,255,255,0.05)' : 'rgba(8,9,11,0.04)', color: C.text, fontSize: '17px', display: 'grid', placeItems: 'center', lineHeight: 1 },
    }, gly);

    return h('div', { style: { animation: 'pcsFade .4s ease', paddingTop: '14px' } },
      // title row
      h('div', { style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '18px' } },
        h('div', {},
          h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', letterSpacing: '0.16em', color: C.faint, textTransform: 'uppercase', marginBottom: '8px' } }, 'Editorial Calendar'),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' } },
            h('h1', { style: { margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '34px', letterSpacing: '-0.03em', color: C.heading } },
              monthName + ' ' + y,
              h('span', { style: { marginLeft: '12px', fontSize: '17px', fontWeight: 500, color: C.dim, letterSpacing: '-0.01em' } }, monthPosts.length + (monthPosts.length === 1 ? ' post' : ' posts')),
            ),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
              navBtn('‹', () => this.shiftMonth(-1), 'Previous month'),
              isCur ? null : this.Btn('Today', () => this.goToday(), { variant: 'soft', sm: true }),
              navBtn('›', () => this.shiftMonth(1), 'Next month')),
          ),
        ),
        h('div', { style: { display: 'flex', gap: '9px', alignItems: 'center' } },
          (() => { const pb = this.state.planBusy; const busy = !!pb || this.state.agendaBusy;
            const label = pb ? (pb.total ? 'Drafting ' + pb.done + '/' + pb.total + '…' : 'Planning…') : 'Plan & draft week';
            return this.Btn(label, () => this.runPlanWeek(), { variant: 'primary', icon: '✦', disabled: busy }); })(),
          this.Btn(this.state.agendaBusy ? 'Generating…' : 'Topics only', () => this.runRefreshAgenda(), { variant: 'soft', icon: '↻', disabled: this.state.agendaBusy || !!this.state.planBusy }),
          this.Btn('New post', () => this.openNewPost(), { variant: 'soft', icon: '+' }),
        ),
      ),
      // this week's focus — the main topics in active rotation
      this.renderWeekFocus(),
      // empty calendar → guide the user straight into the end-to-end flow
      visible.length ? null : h('div', {
        className: 'pcs-glass', style: { borderRadius: '18px', padding: '34px 28px', textAlign: 'center', marginBottom: '18px', ...this.glass({ blur: 24 }) }
      },
        h('div', { style: { fontSize: '28px', marginBottom: '10px', position: 'relative', zIndex: 1 } }, '🗓️'),
        h('h2', { style: { margin: '0 0 6px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', color: C.heading, position: 'relative', zIndex: 1 } }, 'Your week is a blank slate'),
        h('p', { style: { margin: '0 auto 16px', maxWidth: '480px', fontSize: '16px', color: C.dim, lineHeight: 1.55, position: 'relative', zIndex: 1 } },
          this.connected
            ? 'Let Claude propose this week’s editorial agenda and draft three on-brand versions for every topic — then review, publish and track results.'
            : 'Connect your Claude account, then let it propose this week’s agenda and draft every topic for you.'),
        h('div', { style: { display: 'flex', gap: '9px', justifyContent: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1 } },
          this.connected
            ? this.Btn(this.state.planBusy ? 'Working…' : 'Plan & draft week', () => this.runPlanWeek(), { variant: 'primary', icon: '✦', disabled: !!this.state.planBusy })
            : this.Btn('Connect Claude', () => this.openSettings(), { variant: 'primary' }),
          this.Btn('New post', () => this.openNewPost(), { variant: 'soft', icon: '+' })),
      ),
      // sub-header line — only meaningful when there are scheduled posts
      visible.length ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', margin: '2px 2px 14px' } },
        h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '14.5px', color: C.dim } },
          this.StatusBadge('Approved'), this.StatusBadge('Published')),
        h('span', { style: { flex: 1 } }),
        h('span', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', color: C.faint } }, 'Drag a card to reschedule'),
      ) : h('div', { style: { height: '6px' } }),
      // weekday header
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px', marginBottom: '8px' } },
        wd.map((w, i) => h('div', {
          key: w, style: {
            fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '14px', letterSpacing: '0.02em',
            color: i > 4 ? C.faint : C.dim, textAlign: 'left', paddingLeft: '4px'
          }
        }, w))),
      // grid
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px' } },
        cells.map((d, i) => this.renderDayCell(d, byDay[d as any] || [], today, i))),
    );
  }

  renderDayCell(d: number | null, posts: Post[], today: number, key: number) {
    const C = this.C; const isToday = d === today; const weekend = (key % 7) > 4;
    if (d === null) return h('div', { key: key, style: { minHeight: '150px', borderRadius: '14px', border: '1px dashed ' + C.borderSoft, opacity: 0.4 } });
    return h('div', {
      key: key, className: 'pcs-day pcs-int pcs-glass',
      onDragOver: (e: any) => { e.preventDefault(); e.currentTarget.classList.add('pcs-drag-over'); },
      onDragLeave: (e: any) => e.currentTarget.classList.remove('pcs-drag-over'),
      onDrop: (e: any) => { e.preventDefault(); e.currentTarget.classList.remove('pcs-drag-over'); const id = e.dataTransfer.getData('text'); if (id) { const { y, m } = this.state.viewYM; this.movePost(id, y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')); } },
      style: {
        minHeight: '150px', maxHeight: '320px', display: 'flex', flexDirection: 'column', borderRadius: '14px',
        ...this.glass({ blur: 14, soft: weekend }),
        overflow: 'hidden',
        ...(isToday ? {
          background: C.dark ? 'rgba(194,134,30,0.12)' : 'rgba(255,255,255,0.7)',
          border: '1px solid ' + (C.dark ? 'rgba(194,134,30,0.55)' : '#0F0E0B'),
          boxShadow: 'inset 0 1px 0 ' + C.surfHi + ', ' + (C.dark ? '0 0 0 1px rgba(194,134,30,0.35), 0 8px 24px rgba(0,0,0,0.35)' : '0 8px 22px rgba(8,9,11,0.12)'),
        } : {}),
      }
    },
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 11px 6px' } },
        isToday
          ? h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '7px' } },
            h('span', {
              style: {
                width: '24px', height: '24px', borderRadius: '50%', display: 'grid', placeItems: 'center',
                fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: '14px', background: C.dark ? '#E9EBEF' : '#0F0E0B', color: C.dark ? '#0F0E0B' : '#fff'
              }
            }, d),
            h('span', { style: { fontSize: '11px', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.1em', color: C.dark ? C.accent : '#0F0E0B', textTransform: 'uppercase', fontWeight: 600 } }, 'Today'))
          : h('span', { style: { fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, fontSize: '15px', color: weekend ? C.faint : C.dim } }, d),
        posts.length ? h('span', { style: { fontSize: '12.5px', fontFamily: "'JetBrains Mono',monospace", color: C.faint } }, posts.length) : null,
      ),
      h('div', { className: 'pcs-scroll', style: { display: 'flex', flexDirection: 'column', gap: '7px', padding: '2px 8px 9px', overflowY: 'auto', flex: 1 } },
        posts.map((p) => this.renderPostCard(p))),
    );
  }

  renderPostCard(p: Post) {
    const C = this.C; const sm = this.statusMeta(p.status);
    return h('div', {
      key: p.id, className: 'pcs-card pcs-int pcs-glass pcs-sheen', draggable: true,
      onDragStart: (e: any) => { e.dataTransfer.setData('text', p.id); e.dataTransfer.effectAllowed = 'move'; },
      onClick: () => this.openPost(p.id),
      style: {
        cursor: 'pointer', borderRadius: '10px', padding: '10px 11px', position: 'relative',
        background: C.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(8px) saturate(150%)', WebkitBackdropFilter: 'blur(8px) saturate(150%)',
        border: '1px solid ' + C.surfBorder, boxShadow: 'inset 0 1px 0 ' + C.surfHi
      }
    },
      h('span', { className: 'pcs-sheen-bar' }),
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '8px', position: 'relative', zIndex: 1 } },
        this.FormatTag(p.format),
        h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0 } },
          h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: sm.solid ? C.accent : sm.dot } }),
          this.RedoBtn(p.id, { sm: true }),
          this.DeleteBtn(p.id, { sm: true, style: { width: '20px', height: '20px', fontSize: '11.5px' } }))),
      h('div', {
        style: {
          fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '17px', letterSpacing: '-0.005em', color: C.heading,
          lineHeight: 1.28, marginBottom: '10px'
        }
      }, p.topic),
      this.StatusBadge(p.status),
    );
  }

  // ---------- all posts (management view) ----------
  renderAllPosts() {
    const C = this.C;
    const f = this.state.allFilter;
    const statuses = ['All', 'Draft', 'In Review', 'Approved', 'Published'];
    const formats: string[] = ['All', ...Array.from(new Set((this.state.posts as Post[]).map((p) => p.format)))];
    const q = (f.q || '').trim().toLowerCase();
    const rows = this.state.posts
      .filter((p: Post) => f.status === 'All' || p.status === f.status)
      .filter((p: Post) => f.format === 'All' || p.format === f.format)
      .filter((p: Post) => !q || (p.topic + ' ' + p.angle).toLowerCase().includes(q))
      .sort((a: Post, b: Post) => (b.date || '').localeCompare(a.date || ''));
    const setF = (patch: any) => this.setState({ allFilter: { ...f, ...patch } });
    const chip = (label: string, on: boolean, fn: () => void) => h('button', {
      key: label, className: 'pcs-btn', onClick: fn,
      style: {
        fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '14px', padding: '6px 11px', borderRadius: '999px',
        border: '1px solid ' + (on ? (C.dark ? C.accent : '#0F0E0B') : C.border),
        background: on ? (C.dark ? 'rgba(194,134,30,0.16)' : '#0F0E0B') : 'transparent',
        color: on ? (C.dark ? C.heading : '#fff') : C.dim,
      },
    }, label);

    return h('div', { style: { animation: 'pcsFade .4s ease', paddingTop: '14px' } },
      h('div', { style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '18px' } },
        h('div', {},
          h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', letterSpacing: '0.16em', color: C.faint, textTransform: 'uppercase', marginBottom: '8px' } }, 'All Posts'),
          h('h1', { style: { margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '34px', letterSpacing: '-0.03em', color: C.heading } },
            'Every post',
            h('span', { style: { marginLeft: '12px', fontSize: '17px', fontWeight: 500, color: C.dim } }, rows.length + ' of ' + this.state.posts.length))),
        h('div', { style: { display: 'flex', gap: '9px', alignItems: 'center', flexWrap: 'wrap' } },
          this.Btn('Export backup', () => this.exportData(), { variant: 'soft', sm: true, icon: '⤓' }),
          this.Btn('Import', () => this.setState({ modal: { type: 'import' } }), { variant: 'soft', sm: true, icon: '⤒' }),
          this.Btn('New post', () => this.openNewPost(), { variant: 'primary', sm: true, icon: '+' })),
      ),
      // filters
      h('div', { style: { display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' } },
        h('input', {
          type: 'text', value: f.q, placeholder: 'Search topics…',
          onChange: (e: any) => setF({ q: e.target.value }),
          style: { flex: '1 1 220px', minWidth: '180px', padding: '9px 12px', borderRadius: '10px', border: '1px solid ' + C.border, background: C.dark ? 'rgba(0,0,0,0.22)' : '#fff', color: C.text, fontFamily: 'inherit', fontSize: '15.5px', boxSizing: 'border-box' },
        }),
        h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, statuses.map((s) => chip(s, f.status === s, () => setF({ status: s })))),
        formats.length > 2 ? h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, formats.map((ff) => chip(ff === 'All' ? 'All formats' : ff, f.format === ff, () => setF({ format: ff })))) : null,
      ),
      rows.length
        ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, rows.map((p: Post) => this.renderAllRow(p)))
        : h('div', { className: 'pcs-glass', style: { borderRadius: '16px', padding: '40px 24px', textAlign: 'center', ...this.glass({ blur: 22 }) } },
          h('p', { style: { margin: 0, fontSize: '16px', color: C.dim, position: 'relative', zIndex: 1 } },
            this.state.posts.length ? 'No posts match these filters.' : 'No posts yet — plan a week from the calendar or create one.')),
    );
  }

  renderAllRow(p: Post) {
    const C = this.C; const v = (p.versions || [])[p.activeVer || 0];
    const nVers = (p.versions || []).length;
    const eng = p.metrics ? this.engagement(p) : null;
    return h('div', {
      key: p.id, className: 'pcs-card pcs-int pcs-glass', onClick: () => this.openPost(p.id),
      style: { cursor: 'pointer', borderRadius: '14px', padding: '15px 18px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', ...this.glass({ blur: 18 }) },
    },
      h('div', { style: { flex: '1 1 320px', minWidth: 0, position: 'relative', zIndex: 1 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '5px', flexWrap: 'wrap' } },
          this.FormatTag(p.format),
          h('span', { style: { width: '3px', height: '3px', borderRadius: '50%', background: C.faint } }),
          h('span', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: C.faint } }, this.fmtLong(p.date))),
        h('div', { style: { fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '17px', letterSpacing: '-0.01em', color: C.heading, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, p.topic),
        v && v.hook ? h('div', { style: { fontSize: '14.5px', color: C.dim, marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, v.hook) : null),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', position: 'relative', zIndex: 1, flexShrink: 0 } },
        nVers ? h('span', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: C.faint } }, nVers + (nVers === 1 ? ' version' : ' versions')) : h('span', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: C.faint } }, 'no drafts'),
        eng != null ? h('span', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: C.dim } }, '⚡ ' + eng) : null,
        this.StatusBadge(p.status),
        this.DeleteBtn(p.id, { sm: true }),
        h('span', { style: { color: C.faint, fontSize: '17px' } }, '→')),
    );
  }

  // ---------- this week's focus (calendar) ----------
  renderWeekFocus() {
    const C = this.C; const focus = weekFocus(this.state.posts);
    if (!focus.length) return null;
    return h('div', { style: { marginBottom: '20px' } },
      h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', margin: '4px 2px 11px', flexWrap: 'wrap' } },
        h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' } },
          h('h2', { style: { margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '17px', letterSpacing: '-0.02em', color: C.heading } }, 'This week’s focus'),
          h('span', { style: { fontSize: '14.5px', color: C.dim } }, focus.length + ' topics in rotation')),
        this.Btn('Explain these topics', () => this.setTab('topics'), { variant: 'soft', sm: true, icon: '🎓' }),
      ),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(228px,1fr))', gap: '12px' } },
        focus.map((p) => this.renderFocusCard(p))),
    );
  }

  renderFocusCard(p: Post) {
    const C = this.C; const isNew = p.change === 'new';
    const cc = isNew ? (C.dark ? C.accent : '#0F0E0B') : SEM.warning;
    const cbg = isNew ? (C.dark ? 'rgba(194,134,30,0.16)' : 'rgba(8,9,11,0.06)') : 'rgba(201,162,75,0.15)';
    const wd = new Date(p.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    return h('div', {
      key: p.id, className: 'pcs-card pcs-int pcs-glass pcs-sheen', onClick: () => this.openPost(p.id),
      style: {
        cursor: 'pointer', borderRadius: '14px', padding: '13px 14px', position: 'relative',
        background: C.dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(10px) saturate(150%)', WebkitBackdropFilter: 'blur(10px) saturate(150%)',
        border: '1px solid ' + C.surfBorder, boxShadow: 'inset 0 1px 0 ' + C.surfHi
      }
    },
      h('span', { className: 'pcs-sheen-bar' }),
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '9px', position: 'relative', zIndex: 1 } },
        this.FormatTag(p.format),
        h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '7px' } },
          this.Pill(isNew ? 'New' : 'Updated', cc, { bg: cbg, fg: cc, fs: '9.5px', pad: '3px 8px' }),
          this.RedoBtn(p.id),
          this.DeleteBtn(p.id, { sm: true }))),
      h('div', { style: { fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '20px', letterSpacing: '-0.01em', color: C.heading, lineHeight: 1.25, marginBottom: '6px', position: 'relative', zIndex: 1 } }, p.topic),
      h('div', { style: { fontSize: '16px', color: C.dim, lineHeight: 1.5, marginBottom: '11px', position: 'relative', zIndex: 1 } }, p.angle),
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', position: 'relative', zIndex: 1 } },
        this.StatusBadge(p.status),
        h('span', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '11.5px', color: C.faint } }, wd)),
    );
  }

  // ---------- topic briefs (third tab) ----------
  renderTopics() {
    const C = this.C; const focus = weekFocus(this.state.posts);
    return h('div', { style: { animation: 'pcsFade .4s ease', paddingTop: '14px' } },
      h('div', { style: { marginBottom: '20px' } },
        h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', letterSpacing: '0.16em', color: C.faint, textTransform: 'uppercase', marginBottom: '8px' } }, 'Topic Briefs'),
        h('h1', { style: { margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '34px', letterSpacing: '-0.03em', color: C.heading } }, 'This week’s topics, explained'),
        h('p', { style: { margin: '8px 0 0', fontSize: '17px', color: C.dim, lineHeight: 1.55, maxWidth: '680px' } }, 'Plain-language briefs on the themes in active rotation — what each one means, why it matters, and the key points behind it.'),
      ),
      focus.length
        ? h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(420px,1fr))', gap: '16px', alignItems: 'start' } },
          focus.map((p) => this.renderBriefCard(p)))
        : h('div', { style: { padding: '40px', textAlign: 'center', color: C.dim } }, 'No topic briefs for this week yet.'),
    );
  }

  renderBriefCard(p: Post) {
    const C = this.C; const b = (p as any).brief; const isNew = p.change === 'new'; const busy = this.state.briefBusy === p.id;
    const cc = isNew ? (C.dark ? C.accent : '#0F0E0B') : SEM.warning;
    const cbg = isNew ? (C.dark ? 'rgba(194,134,30,0.16)' : 'rgba(8,9,11,0.06)') : 'rgba(201,162,75,0.15)';
    return h('div', { key: p.id, className: 'pcs-glass', style: { borderRadius: '18px', padding: '22px 24px', ...this.glass({ blur: 24 }) } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '13px', flexWrap: 'wrap', position: 'relative', zIndex: 1 } },
        this.FormatTag(p.format),
        h('span', { style: { width: '3px', height: '3px', borderRadius: '50%', background: C.faint } }),
        p.change ? this.Pill(isNew ? 'New' : 'Updated', cc, { bg: cbg, fg: cc, fs: '9.5px', pad: '3px 8px' }) : null,
        h('span', { style: { marginLeft: 'auto' } }, this.StatusBadge(p.status)),
      ),
      h('h2', { style: { margin: '0 0 4px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '21px', letterSpacing: '-0.02em', color: C.heading, lineHeight: 1.2, position: 'relative', zIndex: 1 } }, p.topic),
      h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: C.faint, marginBottom: '14px', position: 'relative', zIndex: 1 } }, p.angle),
      b
        ? h('div', {},
          h('p', { style: { margin: '0 0 14px', fontSize: '16.5px', color: C.text, lineHeight: 1.6, position: 'relative', zIndex: 1 } }, b.summary),
          h('div', { style: { position: 'relative', zIndex: 1, marginBottom: '14px' } },
            h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.faint, marginBottom: '5px' } }, 'Why it matters'),
            h('div', { style: { fontSize: '15.5px', color: C.dim, lineHeight: 1.56 } }, b.why)),
          h('div', { style: { position: 'relative', zIndex: 1, marginBottom: '16px' } },
            h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.faint, marginBottom: '8px' } }, 'Key points'),
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
              (b.points || []).map((pt: string, k: number) => h('div', { key: k, style: { display: 'flex', gap: '9px', alignItems: 'flex-start' } },
                h('span', { style: { flexShrink: 0, marginTop: '1px', width: '18px', height: '18px', borderRadius: '6px', display: 'grid', placeItems: 'center', fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '11.5px', background: C.dark ? 'rgba(194,134,30,0.16)' : '#0F0E0B', color: C.dark ? C.accent : '#fff' } }, k + 1),
                h('span', { style: { fontSize: '15.5px', color: C.text, lineHeight: 1.5 } }, pt))))))
        : h('div', { style: { position: 'relative', zIndex: 1, marginBottom: '16px' } },
          h('p', { style: { margin: '0 0 12px', fontSize: '15.5px', color: C.dim, lineHeight: 1.56 } },
            this.connected ? 'No brief yet — generate a plain-language explainer for this topic.' : 'Connect your Claude account to generate an explainer for this topic.'),
          this.connected
            ? this.Btn(busy ? 'Generating…' : 'Generate brief', () => this.genBrief(p.id), { variant: 'soft', sm: true, icon: '✦', disabled: busy })
            : this.Btn('Connect Claude', () => this.openSettings(), { variant: 'soft', sm: true })),
      h('div', { style: { display: 'flex', gap: '8px', position: 'relative', zIndex: 1 } },
        this.Btn('Open drafts', () => this.openPost(p.id), { variant: 'primary', sm: true, icon: '→' }),
        this.Btn('View in calendar', () => this.setTab('calendar'), { variant: 'ghost', sm: true })),
    );
  }

  // ---------- accounts (switch shared workspace) ----------
  renderAccounts() {
    const C = this.C; const s = this.props.session;
    const accounts = (s && s.accounts) || [];
    const activeId = (s && s.accountId) || '';
    return h('div', { style: { animation: 'pcsFade .4s ease', paddingTop: '14px' } },
      h('div', { style: { marginBottom: '20px' } },
        h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', letterSpacing: '0.16em', color: C.faint, textTransform: 'uppercase', marginBottom: '8px' } }, 'Accounts'),
        h('h1', { style: { margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '34px', letterSpacing: '-0.03em', color: C.heading } }, 'Switch account'),
        h('p', { style: { margin: '8px 0 0', fontSize: '17px', color: C.dim, lineHeight: 1.55, maxWidth: '680px' } },
          'Each account is a separate studio — its own calendar, drafts, history and analytics. Pick whose content you’re working on. Everyone shares the same Claude on the server.'),
      ),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '16px', alignItems: 'start' } },
        accounts.map((a) => {
          const on = a.id === activeId;
          return h('div', {
            key: a.id, className: 'pcs-glass', style: {
              borderRadius: '18px', padding: '24px', ...this.glass({ blur: 24 }),
              border: '1px solid ' + (on ? (C.dark ? C.accent : '#0F0E0B') : C.surfBorder),
            },
          },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', position: 'relative', zIndex: 1 } },
              h('span', {
                style: {
                  width: '44px', height: '44px', borderRadius: '12px', display: 'grid', placeItems: 'center', flexShrink: 0,
                  background: C.dark ? 'rgba(194,134,30,0.16)' : '#0F0E0B', color: C.dark ? C.accent : '#fff',
                  fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '18px',
                },
              }, (a.name || '?').charAt(0).toUpperCase()),
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', { style: { fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em', color: C.heading } }, a.name),
                h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', color: C.faint, marginTop: '2px' } }, on ? 'Active now' : 'Separate calendar & history')),
              on ? this.Pill('Active', SEM.success, { bg: 'rgba(46,139,116,0.16)', fg: SEM.success, dot: SEM.success }) : null),
            on
              ? this.Btn('You’re here', () => {}, { variant: 'soft', sm: true, disabled: true, style: { width: '100%', justifyContent: 'center' } })
              : this.Btn('Switch to ' + a.name, () => { if (s && s.switchAccount) s.switchAccount(a.id); }, { variant: 'primary', sm: true, icon: '→', style: { width: '100%', justifyContent: 'center' } }),
          );
        })),
    );
  }

  // ---------- analytics ----------
  renderAnalytics() {
    const C = this.C;
    const published = this.state.posts
      .filter((p) => p.status === 'Published' || p.publishedAt)
      .sort((a, b) => (b.publishedAt || b.date || '').localeCompare(a.publishedAt || a.date || ''));
    const sum = (k: 'impressions' | 'reactions' | 'comments') => published.reduce((t, p) => t + ((p.metrics || {})[k] || 0), 0);
    const totalImpr = sum('impressions'), totalReact = sum('reactions'), totalComm = sum('comments');
    const totalEng = totalReact + totalComm;
    const engRate = totalImpr > 0 ? ((totalEng / totalImpr) * 100).toFixed(1) + '%' : '—';
    const hint = this.perfSummary();

    return h('div', { style: { animation: 'pcsFade .4s ease', paddingTop: '14px' } },
      h('div', { style: { marginBottom: '20px' } },
        h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', letterSpacing: '0.16em', color: C.faint, textTransform: 'uppercase', marginBottom: '8px' } }, 'Analytics'),
        h('h1', { style: { margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '34px', letterSpacing: '-0.03em', color: C.heading } }, 'Performance & feedback loop'),
        h('p', { style: { margin: '8px 0 0', fontSize: '17px', color: C.dim, lineHeight: 1.55, maxWidth: '700px' } },
          'Log the real numbers from each published post. Claude folds these signals back into the next round of generations — so what works compounds.'),
      ),
      published.length
        ? h('div', {},
          // summary cards
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))', gap: '14px', marginBottom: '18px' } },
            this.statCard('Published', String(published.length), '🚀'),
            this.statCard('Impressions', totalImpr.toLocaleString(), '👁'),
            this.statCard('Reactions', totalReact.toLocaleString(), '👍'),
            this.statCard('Comments', totalComm.toLocaleString(), '💬'),
            this.statCard('Engagement rate', engRate, '⚡'),
          ),
          // what's working
          hint
            ? h('div', { className: 'pcs-glass', style: { borderRadius: '16px', padding: '18px 20px', marginBottom: '18px', ...this.glass({ blur: 22 }) } },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 } },
                h('span', { style: { fontSize: '16px' } }, '✦'),
                h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '11.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.faint } }, 'Fed back into generation')),
              h('p', { style: { margin: '8px 0 0', fontSize: '16px', color: C.text, lineHeight: 1.6, position: 'relative', zIndex: 1, textTransform: 'capitalize' } }, hint + '.'))
            : h('div', { style: { fontSize: '15px', color: C.dim, marginBottom: '18px', padding: '0 2px' } },
              'Log metrics on at least 2 posts to unlock the feedback loop into Claude’s prompts.'),
          // per-post table
          h('h2', { style: { margin: '4px 2px 14px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '19px', letterSpacing: '-0.02em', color: C.heading } }, 'Published posts'),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
            published.map((p) => this.renderAnalyticsRow(p))))
        : h('div', { className: 'pcs-glass', style: { borderRadius: '18px', padding: '46px 28px', textAlign: 'center', ...this.glass({ blur: 24 }) } },
          h('div', { style: { fontSize: '30px', marginBottom: '10px', position: 'relative', zIndex: 1 } }, '📊'),
          h('h2', { style: { margin: '0 0 6px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', color: C.heading, position: 'relative', zIndex: 1 } }, 'Nothing published yet'),
          h('p', { style: { margin: '0 auto', maxWidth: '440px', fontSize: '16px', color: C.dim, lineHeight: 1.55, position: 'relative', zIndex: 1 } },
            'When you publish a post from the generator, it shows up here. Then log its impressions, reactions and comments to start the feedback loop.')),
    );
  }

  statCard(label: string, value: string, icon: string) {
    const C = this.C;
    return h('div', { key: label, className: 'pcs-glass', style: { borderRadius: '15px', padding: '16px 18px', ...this.glass({ blur: 20 }) } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px', position: 'relative', zIndex: 1 } },
        h('span', { style: { fontSize: '16px' } }, icon),
        h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '11.5px', letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint } }, label)),
      h('div', { style: { fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '26px', letterSpacing: '-0.02em', color: C.heading, position: 'relative', zIndex: 1 } }, value));
  }

  renderAnalyticsRow(p: Post) {
    const C = this.C; const v = (p.versions || [])[p.activeVer || 0];
    return h('div', { key: p.id, className: 'pcs-glass', style: { borderRadius: '16px', padding: '18px 20px', ...this.glass({ blur: 22 }) } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px', flexWrap: 'wrap', position: 'relative', zIndex: 1 } },
        this.FormatTag(p.format),
        h('span', { style: { width: '3px', height: '3px', borderRadius: '50%', background: C.faint } }),
        h('span', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: C.faint } }, this.fmtLong(p.publishedAt || p.date)),
        h('span', { style: { marginLeft: 'auto' } }, this.StatusBadge(p.status)),
      ),
      h('h3', { style: { margin: '0 0 3px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '17px', letterSpacing: '-0.02em', color: C.heading, lineHeight: 1.2, position: 'relative', zIndex: 1 } }, p.topic),
      v && v.hook ? h('div', { style: { fontSize: '14.5px', color: C.dim, marginBottom: '14px', lineHeight: 1.5, position: 'relative', zIndex: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as any }, v.hook) : null,
      h('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', position: 'relative', zIndex: 1 } },
        this.metricInput(p, 'impressions', 'Impressions'),
        this.metricInput(p, 'reactions', 'Reactions'),
        this.metricInput(p, 'comments', 'Comments')),
    );
  }

  metricInput(p: Post, key: 'impressions' | 'reactions' | 'comments', label: string) {
    const C = this.C; const cur = (p.metrics || {})[key];
    return h('label', { key, style: { display: 'flex', flexDirection: 'column', gap: '5px' } },
      h('span', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint } }, label),
      h('input', {
        type: 'number', min: 0, value: cur == null ? '' : cur, placeholder: '0',
        onChange: (e: any) => this.setMetric(p.id, key, Math.max(0, parseInt(e.target.value, 10) || 0)),
        style: {
          width: '104px', padding: '8px 10px', borderRadius: '9px', border: '1px solid ' + C.border,
          background: C.dark ? 'rgba(0,0,0,0.22)' : '#fff', color: C.text,
          fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '16px', boxSizing: 'border-box',
        },
      }));
  }

  renderGenerator() {
    const C = this.C; const p = this.post(this.state.selectedId);
    if (!p) return h('div', { style: { padding: '60px', textAlign: 'center', color: C.dim } }, 'Select a post from the calendar.');
    const vers = this.getVersions(p); const pm = this.prioMeta(p.priority);
    const statuses = ['Draft', 'In Review', 'Approved', 'Published'];
    return h('div', { style: { animation: 'pcsFade .4s ease', paddingTop: '14px' } },
      // breadcrumb / back
      h('button', {
        className: 'pcs-btn', onClick: () => this.setTab('calendar'), style: {
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          background: 'transparent', border: 'none', color: C.dim, fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '15px', padding: '4px 0', marginBottom: '14px'
        }
      },
        '←', ' Back to calendar'),
      // post header
      h('div', {
        className: 'pcs-glass',
        style: {
          borderRadius: '18px', padding: '22px 24px', marginBottom: '18px', ...this.glass({ blur: 26 }),
        }
      },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' } },
          this.FormatTag(p.format),
          h('span', { style: { width: '3px', height: '3px', borderRadius: '50%', background: C.faint } }),
          h('span', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: C.faint } }, this.fmtLong(p.date)),
          h('span', { style: { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '9px' } },
            this.StatusBadge(p.status),
            this.Btn('Delete', () => this.setState({ modal: { type: 'delete', id: p.id } }), { variant: 'danger', sm: true, icon: '🗑️' })),
        ),
        h('h1', { style: { margin: '0 0 6px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '30px', letterSpacing: '-0.03em', color: C.heading, lineHeight: 1.12 } }, p.topic),
        h('p', { style: { margin: '0 0 18px', fontSize: '17px', color: C.dim, lineHeight: 1.55, maxWidth: '720px' } }, p.angle),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' } },
          h('div', { style: { display: 'flex', gap: '5px', padding: '4px', borderRadius: '11px', background: C.dark ? 'rgba(0,0,0,0.25)' : 'rgba(8,9,11,0.04)' } },
            statuses.map((s) => {
              const on = p.status === s; const m = this.statusMeta(s);
              return h('button', {
                key: s, className: 'pcs-btn', onClick: () => this.setStatus(p.id, s), style: {
                  border: 'none', borderRadius: '8px',
                  padding: '6px 11px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '14px',
                  background: on ? (m.solid ? m.bg : m.bg) : 'transparent', color: on ? m.fg : C.dim,
                  boxShadow: on && !m.solid ? 'inset 0 0 0 1px ' + m.fg + '55' : 'none'
                }
              }, s);
            })),
          p.scheduledFor ? this.Pill('Scheduled · ' + this.fmtLong(p.scheduledFor), SEM.success, { bg: 'rgba(46,139,116,0.16)', fg: SEM.success, dot: SEM.success }) : null,
        ),
      ),
      // writing style panel
      this.renderStylePanel(),
      // versions header + grid (or empty/generate state)
      vers.length
        ? h('div', {},
          h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', margin: '22px 2px 14px', flexWrap: 'wrap' } },
            h('h2', { style: { margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '19px', letterSpacing: '-0.02em', color: C.heading } },
              vers.length + ' generated versions',
              h('span', { style: { marginLeft: '9px', fontSize: '15px', fontWeight: 500, color: C.dim } }, '— choose one to publish')),
            h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
              this.renderRefUrl(),
              this.renderSearchToggle(),
              this.Btn(this.state.genBusy ? 'Regenerating…' : 'Regenerate all', () => this.generateForSelected(), { variant: 'soft', sm: true, icon: '↻', disabled: this.state.genBusy })),
          ),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(332px,1fr))', gap: '16px', alignItems: 'start' } },
            vers.map((v, i) => this.renderVersion(p, v, i))))
        : this.renderGeneratePanel(),
      // image panel — only once a version is approved
      this.approvedVersion(p) ? this.renderImagePanel(p) : null,
    );
  }

  renderImagePanel(p: Post) {
    const C = this.C; const busy = this.state.imgBusy; const open = this.state.imgPromptOpen;
    const carBusy = this.state.carBusy; const anyBusy = busy || carBusy;
    if (!this.canImage) return null;
    return h('div', {
      className: 'pcs-glass', style: { marginTop: '20px', borderRadius: '18px', padding: '22px 24px', ...this.glass({ blur: 24 }) },
    },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', position: 'relative', zIndex: 1 } },
        h('span', { style: { fontSize: '18px' } }, '🖼️'),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('h2', { style: { margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em', color: C.heading } }, 'Post image'),
          h('div', { style: { fontSize: '14.5px', color: C.dim, marginTop: '2px' } }, 'A rich editorial image, a photo, or a 3-slide carousel — built from the approved post.')),
        anyBusy ? null : h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          this.canFigure ? this.Btn(p.image ? 'New image' : 'Generate image', () => this.genFigure(), { variant: p.image ? 'soft' : 'primary', sm: true, icon: '📊' }) : null,
          this.canFigure ? this.Btn(p.images && p.images.length ? 'New carousel' : 'Carousel', () => this.genCarousel(), { variant: 'soft', sm: true, icon: '🎠' }) : null,
          this.Btn('Photo', () => this.genImage(), { variant: 'soft', sm: true, icon: '📷' }),
          this.Btn('Custom prompt', () => this.setState({ imgPromptOpen: !open, imgPromptDraft: open ? '' : (p.imagePrompt || '') }), { variant: 'soft', sm: true, icon: '✎' }))),
      open ? h('div', { style: { position: 'relative', zIndex: 1, marginBottom: '14px' } },
        h('textarea', {
          value: this.state.imgPromptDraft, autoFocus: true, placeholder: 'Describe the image you want (scene, mood, style)…',
          onChange: (e: any) => this.setState({ imgPromptDraft: e.target.value }),
          style: {
            width: '100%', minHeight: '80px', resize: 'vertical', borderRadius: '12px', padding: '12px 14px',
            background: C.input, border: '1px solid ' + C.border, color: C.text, fontSize: '15.5px', lineHeight: 1.55,
            fontFamily: "'Cormorant Garamond',serif", outline: 'none', boxSizing: 'border-box',
          },
        }),
        h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' } },
          this.Btn('Cancel', () => this.setState({ imgPromptOpen: false, imgPromptDraft: '' }), { variant: 'ghost', sm: true }),
          this.Btn('Generate from prompt', () => this.genImage(this.state.imgPromptDraft), { variant: 'primary', sm: true, icon: '✦', disabled: !this.state.imgPromptDraft.trim() }))) : null,
      busy
        ? h('div', { style: { padding: '40px', textAlign: 'center', color: C.dim, position: 'relative', zIndex: 1 } },
          h('div', { style: { fontSize: '26px', marginBottom: '8px' } }, '✦'), 'Generating image…')
        : (p.image
          ? h('div', { style: { position: 'relative', zIndex: 1 } },
            h('img', { src: p.image, alt: 'Post image', style: { width: '100%', borderRadius: '14px', display: 'block', border: '1px solid ' + C.border } }),
            h('div', { style: { display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' } },
              this.Btn('Download', () => window.open(p.image as string, '_blank', 'noopener'), { variant: 'soft', sm: true, icon: '⤓' }),
              this.Btn('Remove', () => this.removeImage(), { variant: 'danger', sm: true, icon: '🗑️' })),
            p.imagePrompt ? h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', color: C.faint, marginTop: '10px', lineHeight: 1.5 } }, 'Prompt · ' + p.imagePrompt) : null)
          : (open ? null : h('div', { style: { fontSize: '15px', color: C.dim, position: 'relative', zIndex: 1 } }, 'No image yet — generate a figure, a photo, or a carousel from the post.'))),
      // carousel
      carBusy
        ? h('div', { style: { padding: '34px', textAlign: 'center', color: C.dim, position: 'relative', zIndex: 1, marginTop: '14px', borderTop: '1px solid ' + C.borderSoft } },
          h('div', { style: { fontSize: '24px', marginBottom: '8px' } }, '🎠'), 'Designing & rendering the carousel…')
        : (p.images && p.images.length
          ? h('div', { style: { position: 'relative', zIndex: 1, marginTop: '16px', paddingTop: '16px', borderTop: '1px solid ' + C.borderSoft } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' } },
              h('span', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '11.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.faint } }, 'Carousel · ' + p.images.length + ' slides'),
              h('span', { style: { flex: 1 } }),
              this.Btn('Remove', () => this.removeCarousel(), { variant: 'ghost', sm: true, icon: '🗑️' })),
            h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' } },
              (p.images as string[]).map((src, i) => h('a', {
                key: i, href: src, target: '_blank', rel: 'noopener',
                style: { display: 'block', position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid ' + C.border },
              },
                h('img', { src, alt: 'Slide ' + (i + 1), style: { width: '100%', display: 'block' } }),
                h('span', { style: { position: 'absolute', left: '6px', top: '6px', fontFamily: "'JetBrains Mono',monospace", fontSize: '11.5px', color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '2px 6px', borderRadius: '6px' } }, (i + 1) + '/' + p.images!.length)))))
          : null),
    );
  }

  // Optional reference-post URL: Claude fetches it and builds on its substance.
  renderRefUrl(opt: any = {}) {
    const C = this.C; const v = this.state.refUrl || '';
    return h('div', { style: { display: 'flex', alignItems: 'center', gap: '7px', flex: opt.grow ? '1 1 260px' : '0 1 320px', minWidth: '200px' } },
      h('span', { title: 'Base the post on an existing post', style: { fontSize: '16px' } }, '🔗'),
      h('input', {
        type: 'url', value: v, placeholder: 'Reference post URL (optional)', spellCheck: false,
        onChange: (e: any) => this.setState({ refUrl: e.target.value }),
        style: {
          flex: 1, padding: '7px 11px', borderRadius: '10px',
          border: '1px solid ' + (v ? 'rgba(46,139,116,0.4)' : C.border),
          background: v ? 'rgba(46,139,116,0.10)' : (C.dark ? 'rgba(255,255,255,0.05)' : 'rgba(8,9,11,0.04)'),
          color: C.text, fontFamily: "'Cormorant Garamond',serif", fontSize: '14.5px', outline: 'none', boxSizing: 'border-box',
        },
      }),
      v ? h('button', { className: 'pcs-btn', title: 'Clear', onClick: () => this.setState({ refUrl: '' }), style: { border: 'none', background: 'transparent', color: C.faint, fontSize: '16px', lineHeight: 1, padding: '2px 4px' } }, '✕') : null);
  }

  renderSearchToggle() {
    const C = this.C; const on = this.state.settings.webSearch !== false;
    return h('button', {
      className: 'pcs-btn', onClick: () => this.saveSettings({ ...this.state.settings, webSearch: !on }),
      title: on ? 'Web search on — posts grounded in recent sources' : 'Web search off',
      style: {
        display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '14px',
        padding: '7px 11px', borderRadius: '10px', border: '1px solid ' + (on ? 'rgba(46,139,116,0.4)' : C.border),
        background: on ? 'rgba(46,139,116,0.14)' : (C.dark ? 'rgba(255,255,255,0.05)' : 'rgba(8,9,11,0.04)'),
        color: on ? SEM.success : C.dim,
      },
    }, '🔎', 'Web search ' + (on ? 'on' : 'off'));
  }

  renderGeneratePanel() {
    const C = this.C; const busy = this.state.genBusy;
    return h('div', {
      className: 'pcs-glass', style: {
        marginTop: '22px', borderRadius: '18px', padding: '40px 28px', textAlign: 'center', ...this.glass({ blur: 24 }),
      }
    },
      h('div', { style: { fontSize: '30px', marginBottom: '10px' } }, busy ? '✦' : '✎'),
      h('h2', { style: { margin: '0 0 6px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', color: C.heading } },
        busy ? 'Generating with Claude…' : 'No drafts yet'),
      h('p', { style: { margin: '0 auto 18px', maxWidth: '460px', fontSize: '16px', color: C.dim, lineHeight: 1.55 } },
        this.connected
          ? 'Generate three on-brand versions from this topic and your writing style. Optionally paste a reference post to build on.'
          : 'Connect your Claude account to generate three on-brand versions from this topic.'),
      this.connected ? h('div', { style: { display: 'flex', justifyContent: 'center', marginBottom: '14px' } }, this.renderRefUrl({ grow: true })) : null,
      h('div', { style: { display: 'flex', gap: '9px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' } },
        this.connected ? this.renderSearchToggle() : null,
        this.connected
          ? this.Btn(busy ? 'Working…' : 'Generate 3 versions', () => this.generateForSelected(), { variant: 'primary', icon: '✦', disabled: busy })
          : this.Btn('Connect Claude', () => this.openSettings(), { variant: 'primary' })),
    );
  }

  renderStylePanel() {
    const C = this.C; const open = this.state.styleOpen;
    return h('div', { className: 'pcs-glass', style: { borderRadius: '16px', ...this.glass({ blur: 20 }), overflow: 'hidden' } },
      h('button', {
        className: 'pcs-btn', onClick: () => this.setState({ styleOpen: !open }), style: {
          width: '100%', display: 'flex', alignItems: 'center',
          gap: '11px', padding: '14px 18px', background: 'transparent', border: 'none', textAlign: 'left'
        }
      },
        h('span', {
          style: {
            width: '30px', height: '30px', borderRadius: '9px', display: 'grid', placeItems: 'center', flexShrink: 0,
            background: C.dark ? 'rgba(194,134,30,0.14)' : '#0F0E0B', color: C.dark ? C.accent : '#fff', fontSize: '16px'
          }
        }, '✎'),
        h('div', { style: { flex: 1 } },
          h('div', { style: { fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '16px', color: C.heading } }, 'Your writing style'),
          h('div', { style: { fontSize: '14px', color: C.dim, marginTop: '2px' } }, 'Voice + reference examples that feed every generation')),
        h('span', { style: { color: C.faint, fontSize: '15px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' } }, '▼'),
      ),
      open ? h('div', { style: { padding: '0 18px 18px', animation: 'pcsFade .25s ease' } },
        h('textarea', {
          value: this.state.styleProfile, onChange: (e: any) => this.setStyle(e.target.value), spellCheck: false,
          style: {
            width: '100%', minHeight: '120px', resize: 'vertical', borderRadius: '12px', padding: '13px 15px',
            background: C.input, border: '1px solid ' + C.border, color: C.text, fontSize: '15.5px', lineHeight: 1.65,
            fontFamily: "'Cormorant Garamond',serif", outline: 'none'
          }
        }),
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '10px', flexWrap: 'wrap' } },
          h('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap' } },
            ['Harvard methods on', 'No emojis', 'First-person', 'Ends with a question'].map((t) => this.Pill(t, C.dim, {
              bg: C.dark ? 'rgba(255,255,255,0.05)' : 'rgba(8,9,11,0.04)', fg: C.dim, fs: '10.5px',
              style: { fontFamily: "'JetBrains Mono',monospace" }
            }))),
          this.Btn('Save style', () => this.saveStyleProfile(), { variant: 'soft', sm: true, icon: '✓' }),
        ),
      ) : null,
    );
  }

  renderVersion(p: Post, v: Version, i: number) {
    const C = this.C; const editing = this.state.editingVer === i; const active = p.activeVer === i;
    const whyOpen = (this.state.whyOpen || {})[i]; const methodShort = v.method.split('—')[0].trim();
    return h('div', {
      className: 'pcs-ver pcs-int pcs-glass pcs-sheen', style: {
        display: 'flex', flexDirection: 'column', borderRadius: '16px', overflow: 'hidden',
        ...this.glass({ blur: 24 }),
        border: '1px solid ' + (v.approved ? 'rgba(46,139,116,0.5)' : active ? (C.dark ? 'rgba(194,134,30,0.4)' : '#0F0E0B') : C.surfBorder),
        boxShadow: 'inset 0 1px 0 ' + C.surfHi + ', ' + (v.approved ? '0 0 0 1px rgba(46,139,116,0.25), ' + C.surfShadow : C.surfShadow)
      }
    },
      h('span', { className: 'pcs-sheen-bar' }),
      // header
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', padding: '12px 15px', borderBottom: '1px solid ' + C.borderSoft } },
        h('span', {
          style: {
            width: '24px', height: '24px', borderRadius: '7px', display: 'grid', placeItems: 'center',
            fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '14px',
            background: active ? (C.dark ? '#E9EBEF' : '#0F0E0B') : (C.dark ? 'rgba(255,255,255,0.07)' : 'rgba(8,9,11,0.05)'),
            color: active ? (C.dark ? '#0F0E0B' : '#fff') : C.dim
          }
        }, v.label),
        h('span', { style: { fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '15px', color: C.heading } }, 'Version ' + v.label),
        v.approved ? this.Pill('Approved', SEM.success, { bg: 'rgba(46,139,116,0.16)', fg: SEM.success, dot: SEM.success, fs: '10px' }) : null,
        h('span', { style: { flex: 1 } }),
        h('button', {
          className: 'pcs-btn', title: 'Version history', onClick: () => this.setState({ modal: { type: 'history', vi: i, sel: 0 } }),
          style: {
            display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'transparent', border: '1px solid ' + C.border, borderRadius: '8px',
            padding: '4px 8px', color: C.dim, fontSize: '12px', fontFamily: "'JetBrains Mono',monospace"
          }
        },
          '↺ ' + (v.history.length + 1)),
      ),
      // hook + body
      h('div', { style: { padding: '15px 16px 8px', flex: 1 } },
        editing
          ? h('textarea', {
            value: this.state.draft, onChange: (e: any) => this.setState({ draft: e.target.value }), spellCheck: false, autoFocus: true,
            style: {
              width: '100%', minHeight: '300px', resize: 'vertical', borderRadius: '11px', padding: '13px', background: C.input,
              border: '1px solid ' + (C.dark ? C.accent : '#0F0E0B'), color: C.text, fontSize: '16px', lineHeight: 1.68,
              fontFamily: "'Cormorant Garamond',serif", outline: 'none'
            }
          })
          : h('div', {},
            h('div', {
              style: {
                fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '17px', letterSpacing: '-0.01em', lineHeight: 1.36, color: C.heading,
                paddingLeft: '13px', borderLeft: '3px solid ' + (C.dark ? C.accent : '#0F0E0B'), marginBottom: '13px'
              }
            }, v.hook),
            h('div', { style: { fontSize: '15.5px', lineHeight: 1.64, color: C.text, whiteSpace: 'pre-wrap' } }, v.body)),
      ),
      // method disclosure (collapsed by default to keep the card clean)
      h('div', { style: { padding: '4px 16px 0' } },
        h('button', {
          className: 'pcs-btn', onClick: () => this.setState({ whyOpen: { ...(this.state.whyOpen || {}), [i]: !whyOpen } }),
          style: {
            width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 11px', borderRadius: '10px',
            background: C.dark ? 'rgba(255,255,255,0.03)' : C.card2, border: '1px solid ' + C.borderSoft, textAlign: 'left'
          }
        },
          h('span', { style: { fontSize: '13px' } }, '🎓'),
          h('span', { style: { fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '14px', color: C.heading } }, methodShort),
          h('span', { style: { flex: 1 } }),
          h('span', { style: { fontSize: '11.5px', color: C.faint, fontFamily: "'JetBrains Mono',monospace" } }, whyOpen ? 'hide' : 'why it works'),
          h('span', { style: { color: C.faint, fontSize: '10.5px', transform: whyOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' } }, '▼')),
        whyOpen ? h('div', { style: { padding: '11px 12px 2px', animation: 'pcsFade .2s ease' } },
          h('div', { style: { fontSize: '14.5px', color: C.dim, lineHeight: 1.56, marginBottom: '10px' } }, v.methodNote),
          h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.faint, marginBottom: '4px' } }, 'Why it engages'),
          h('div', { style: { fontSize: '14.5px', color: C.dim, lineHeight: 1.56, marginBottom: '8px' } }, v.why),
          h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '11.5px', color: C.faint } }, 'Last edit · ' + (v.editor || 'AI draft') + ' · ' + rel(v.ts))) : null,
      ),
      // controls
      h('div', { style: { display: 'flex', gap: '7px', padding: '13px 15px', borderTop: '1px solid ' + C.borderSoft, flexWrap: 'wrap', marginTop: '10px' } },
        editing
          ? [this.Btn('Save', () => this.saveEdit(i), { variant: 'primary', sm: true, icon: '✓' }),
          this.Btn('Cancel', () => this.cancelEdit(), { variant: 'ghost', sm: true })]
          : [this.Btn('Edit', () => this.startEdit(i), { variant: 'ghost', sm: true, icon: '✎' }),
          this.Btn(this.state.verBusy === i ? 'Regenerating…' : 'Regenerate', () => this.regenerate(i), { variant: 'soft', sm: true, icon: '↻', disabled: this.state.verBusy === i }),
          h('span', { key: 'sp', style: { flex: 1 } }),
          this.Btn('Approve', () => this.approve(i), { variant: v.approved ? 'success' : 'ghost', sm: true, icon: v.approved ? '✓' : null }),
          this.Btn('Publish', () => this.setState({ modal: { type: 'publish', vi: i } }), { variant: 'primary', sm: true, icon: '🚀' })],
      ),
    );
  }

  openSettings() { this.setState({ modal: { type: 'settings' }, settingsDraft: { ...this.state.settings } }); }

  renderSettingsModal(close: () => void) {
    const C = this.C; const d = this.state.settingsDraft || { ...this.state.settings };
    const set = (patch: any) => this.setState({ settingsDraft: { ...d, ...patch } });
    const inputStyle: any = {
      width: '100%', borderRadius: '11px', padding: '11px 13px', background: C.input, border: '1px solid ' + C.border,
      color: C.text, fontSize: '15.5px', fontFamily: "'JetBrains Mono',monospace", outline: 'none',
    };
    // Collaborative mode (Supabase): account + workspace, model; no API key (it's server-side).
    if (hasSupabase && this.props.session) {
      const s = this.props.session;
      const saveModel = () => { this.saveSettings({ apiKey: '', model: d.model || DEFAULT_MODEL }); this.toast('Saved'); };
      return h('div', { style: { padding: '26px' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '6px' } },
          h('span', { style: { fontSize: '20px' } }, '✦'),
          h('h3', { style: { margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', color: C.heading } }, 'Shared studio')),
        h('p', { style: { margin: '0 0 16px', fontSize: '15px', color: C.dim, lineHeight: 1.5 } },
          'You’re in the shared team studio — everyone with the access code sees and edits the same content, live. Generation runs through the team key on the server.'),
        h('label', { style: { display: 'block', fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '14px', color: C.heading, marginBottom: '6px' } }, 'Text model'),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 13px', borderRadius: '11px', background: C.dark ? 'rgba(255,255,255,0.04)' : C.card2, border: '1px solid ' + C.borderSoft } },
          h('span', { style: { fontSize: '15px' } }, '✦'),
          h('span', { style: { fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '15px', color: C.heading } }, 'Gemini 2.5 Flash'),
          h('span', { style: { marginLeft: 'auto', fontFamily: "'JetBrains Mono',monospace", fontSize: '11.5px', color: C.faint } }, 'set by admin')),
        h('div', { style: { display: 'flex', gap: '9px', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' } },
          this.Btn('Leave studio', () => s.signOut(), { variant: 'ghost' }),
          h('div', { style: { display: 'flex', gap: '9px' } },
            this.Btn('Close', close, { variant: 'ghost' }),
            this.Btn('Save', () => { saveModel(); this.setState({ modal: null }); }, { variant: 'primary', icon: '✓' })),
        ),
      );
    }
    return h('div', { style: { padding: '26px' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '6px' } },
        h('span', { style: { fontSize: '20px' } }, '✦'),
        h('h3', { style: { margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', color: C.heading } }, 'Connect your Claude account')),
      h('p', { style: { margin: '0 0 18px', fontSize: '15.5px', color: C.dim, lineHeight: 1.55 } },
        'Paste your Anthropic API key. It is stored only in this browser (localStorage) and used to call Claude directly from this page — it is never sent anywhere else.'),
      h('label', { style: { display: 'block', fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '14px', color: C.heading, marginBottom: '6px' } }, 'Anthropic API key'),
      h('input', { type: 'password', value: d.apiKey, placeholder: 'sk-ant-…', spellCheck: false, autoFocus: true, onChange: (e: any) => set({ apiKey: e.target.value }), style: inputStyle }),
      h('div', { style: { fontSize: '13px', color: C.faint, margin: '6px 0 16px' } },
        'Get a key at console.anthropic.com → API keys.'),
      h('label', { style: { display: 'block', fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '14px', color: C.heading, marginBottom: '6px' } }, 'Model'),
      h('select', { value: d.model, onChange: (e: any) => set({ model: e.target.value }), style: { ...inputStyle, fontFamily: "'Cormorant Garamond',serif" } },
        MODELS.map((mo) => h('option', { key: mo.id, value: mo.id }, mo.label))),
      h('div', { style: { display: 'flex', gap: '9px', justifyContent: 'flex-end', marginTop: '20px' } },
        d.apiKey ? this.Btn('Disconnect', () => { this.saveSettings({ apiKey: '', model: d.model || DEFAULT_MODEL }); this.setState({ modal: null }); this.toast('Disconnected'); }, { variant: 'danger' }) : null,
        this.Btn('Cancel', close, { variant: 'ghost' }),
        this.Btn('Save', () => { this.saveSettings({ apiKey: (d.apiKey || '').trim(), model: d.model || DEFAULT_MODEL }); this.setState({ modal: null }); this.toast((d.apiKey || '').trim() ? 'Claude connected ✓' : 'Saved'); }, { variant: 'primary', icon: '✓' }),
      ),
    );
  }

  renderNewPostModal(close: () => void) {
    const C = this.C; const np = this.state.newPost;
    const set = (patch: any) => this.setState({ newPost: { ...np, ...patch } });
    const formats = ['opinion', 'educational', 'technical', 'case study', 'trend'];
    const prios = ['High', 'Medium', 'Low'];
    const inputStyle: any = {
      width: '100%', borderRadius: '11px', padding: '11px 13px', background: C.input, border: '1px solid ' + C.border,
      color: C.text, fontSize: '15.5px', fontFamily: "'Cormorant Garamond',serif", outline: 'none',
    };
    const label = (t: string) => h('label', { style: { display: 'block', fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: '14px', color: C.heading, margin: '14px 0 6px' } }, t);
    return h('div', { style: { padding: '26px' } },
      h('h3', { style: { margin: '0 0 4px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', color: C.heading } }, 'New post'),
      h('p', { style: { margin: 0, fontSize: '15px', color: C.dim } }, 'Add a topic and pick the day you plan to publish it. Generate drafts from it in Content Generation.'),
      label('Topic'),
      h('input', { value: np.topic, autoFocus: true, placeholder: 'e.g. Raise price to defend margin — or hold to defend volume?', onChange: (e: any) => set({ topic: e.target.value }), style: inputStyle }),
      label('Angle'),
      h('input', { value: np.angle, placeholder: 'One line on the take', onChange: (e: any) => set({ angle: e.target.value }), style: inputStyle }),
      h('div', { style: { display: 'flex', gap: '12px' } },
        h('div', { style: { flex: 1 } }, label('Planned publish date'),
          h('input', { type: 'date', value: np.date || this.todayISO(), onChange: (e: any) => set({ date: e.target.value }), style: { ...inputStyle, fontFamily: "'JetBrains Mono',monospace" } })),
        h('div', { style: { flex: 1 } }, label('Priority'),
          h('select', { value: np.priority, onChange: (e: any) => set({ priority: e.target.value }), style: inputStyle }, prios.map((f) => h('option', { key: f, value: f }, f)))),
      ),
      label('Format'),
      h('select', { value: np.format, onChange: (e: any) => set({ format: e.target.value }), style: inputStyle }, formats.map((f) => h('option', { key: f, value: f }, f))),
      h('div', { style: { display: 'flex', gap: '9px', justifyContent: 'flex-end', marginTop: '22px' } },
        this.Btn('Cancel', close, { variant: 'ghost' }),
        this.Btn('Create post', () => this.createPost(), { variant: 'primary', icon: '+' }),
      ),
    );
  }

  renderImportModal(close: () => void) {
    const C = this.C;
    const pick = (mode: 'replace' | 'merge') => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/json,.json';
      inp.onchange = () => { const file = inp.files && inp.files[0]; if (file) this.importData(file, mode); };
      inp.click();
    };
    return h('div', { style: { padding: '26px' } },
      h('div', { style: { fontSize: '28px', marginBottom: '10px' } }, '⤒'),
      h('h3', { style: { margin: '0 0 6px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', color: C.heading } }, 'Import a backup'),
      h('p', { style: { margin: '0 0 18px', fontSize: '15.5px', color: C.dim, lineHeight: 1.55 } },
        'Restore posts and writing style from a previously exported JSON file. ',
        h('strong', { style: { color: C.text } }, 'Merge'), ' keeps your current posts and adds/updates by id; ',
        h('strong', { style: { color: C.text } }, 'Replace'), ' overwrites everything with the file’s contents.'),
      h('div', { style: { display: 'flex', gap: '9px', justifyContent: 'flex-end', flexWrap: 'wrap' } },
        this.Btn('Cancel', close, { variant: 'ghost' }),
        this.Btn('Merge from file', () => pick('merge'), { variant: 'soft', icon: '⤒' }),
        this.Btn('Replace from file', () => pick('replace'), { variant: 'danger', icon: '⤒' })),
    );
  }

  renderModal() {
    const m = this.state.modal; if (!m) return null; const C = this.C;
    const close = () => this.setState({ modal: null });
    const shell = (width: string, inner: any) => h('div', {
      onClick: close, style: {
        position: 'fixed', inset: 0, zIndex: 70, display: 'grid', placeItems: 'center',
        padding: '28px', background: C.dark ? 'rgba(4,5,7,0.72)' : 'rgba(8,9,11,0.42)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'pcsFade .2s ease'
      }
    },
      h('div', {
        onClick: (e: any) => e.stopPropagation(), className: 'pcs-scroll', style: {
          width: '100%', maxWidth: width, maxHeight: '86vh', overflow: 'auto',
          borderRadius: '20px', background: C.glass, backdropFilter: 'blur(30px) saturate(180%)', WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          border: '1px solid ' + C.glassBorder, boxShadow: 'inset 0 1px 0 ' + C.glassHi + ', ' + C.shadow, animation: 'pcsPop .24s ease'
        }
      }, inner));

    if (m.type === 'settings') return shell('480px', this.renderSettingsModal(close));
    if (m.type === 'newpost') return shell('520px', this.renderNewPostModal(close));
    if (m.type === 'import') return shell('520px', this.renderImportModal(close));
    if (m.type === 'delete') {
      const target = this.post(m.id); const hasDrafts = !!(target && target.versions && target.versions.length);
      return shell('440px', h('div', { style: { padding: '26px' } },
        h('div', { style: { fontSize: '28px', marginBottom: '10px' } }, '🗑️'),
        h('h3', { style: { margin: '0 0 6px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', color: C.heading } }, 'Remove this topic?'),
        h('p', { style: { margin: '0 0 18px', fontSize: '16px', color: C.dim, lineHeight: 1.55 } },
          h('strong', { style: { color: C.text } }, (target && target.topic) || 'This post'),
          ' will be removed from your calendar' + (hasDrafts ? ', along with its generated drafts' : '') + '. This can’t be undone.'),
        h('div', { style: { display: 'flex', gap: '9px', justifyContent: 'flex-end' } },
          this.Btn('Cancel', close, { variant: 'ghost' }),
          this.Btn('Remove topic', () => this.deletePost(m.id), { variant: 'danger', icon: '🗑️' })),
      ));
    }

    const p = this.post(this.state.selectedId)!; const v = this.getVersions(p)[m.vi];

    if (m.type === 'schedule') {
      return shell('440px', h('div', { style: { padding: '26px' } },
        h('div', { style: { fontSize: '30px', marginBottom: '10px' } }, '📅'),
        h('h3', { style: { margin: '0 0 6px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', color: C.heading } }, 'Schedule this post'),
        h('p', { style: { margin: '0 0 18px', fontSize: '16px', color: C.dim, lineHeight: 1.55 } },
          'Version ', h('strong', { style: { color: C.text } }, v.label), ' will be approved and queued for publication on ',
          h('strong', { style: { color: C.text } }, this.fmtLong(p.date)), '.'),
        h('div', { style: { display: 'flex', gap: '9px', justifyContent: 'flex-end' } },
          this.Btn('Cancel', close, { variant: 'ghost' }),
          this.Btn('Confirm schedule', () => this.schedule(m.vi), { variant: 'primary', icon: '✓' })),
      ));
    }

    if (m.type === 'publish') {
      const text = this.postText(v);
      return shell('560px', h('div', { style: { padding: '26px' } },
        h('div', { style: { fontSize: '30px', marginBottom: '10px' } }, '🚀'),
        h('h3', { style: { margin: '0 0 6px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', color: C.heading } }, 'Publish to LinkedIn'),
        h('p', { style: { margin: '0 0 16px', fontSize: '15.5px', color: C.dim, lineHeight: 1.55 } },
          'Copy the post, open LinkedIn to paste and publish, then mark it as published here to track its performance.'),
        (p.images && p.images.length)
          ? h('div', { style: { marginBottom: '14px' } },
            h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '11.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.faint, marginBottom: '6px' } }, 'Carousel — post these ' + p.images.length + ' slides in order'),
            h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' } },
              (p.images as string[]).map((src, i) => h('a', { key: i, href: src, target: '_blank', rel: 'noopener', style: { display: 'block', borderRadius: '10px', overflow: 'hidden', border: '1px solid ' + C.border } },
                h('img', { src, alt: 'Slide ' + (i + 1), style: { width: '100%', display: 'block' } })))))
          : (p.image ? h('div', { style: { marginBottom: '14px' } },
            h('img', { src: p.image, alt: 'Post image', style: { width: '100%', borderRadius: '12px', display: 'block', border: '1px solid ' + C.border } }),
            h('div', { style: { marginTop: '6px' } }, this.Btn('Download image', () => window.open(p.image as string, '_blank', 'noopener'), { variant: 'soft', sm: true, icon: '⤓' }))) : null),
        h('textarea', {
          readOnly: true, value: text, className: 'pcs-scroll',
          onFocus: (e: any) => e.target.select(),
          style: {
            width: '100%', minHeight: '180px', resize: 'vertical', borderRadius: '12px', padding: '13px 14px',
            background: C.dark ? 'rgba(0,0,0,0.22)' : '#fff', border: '1px solid ' + C.border, color: C.text,
            fontSize: '15.5px', lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box', whiteSpace: 'pre-wrap',
          },
        }),
        h('div', { style: { display: 'flex', gap: '9px', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '16px' } },
          this.Btn('Copy text', () => {
            try { navigator.clipboard.writeText(text); this.toast('Post copied 📋'); } catch { this.toast('Copy failed — select and copy manually'); }
          }, { variant: 'ghost', sm: true, icon: '📋' }),
          this.Btn('Open LinkedIn', () => window.open('https://www.linkedin.com/feed/?shareActive=true', '_blank', 'noopener'), { variant: 'ghost', sm: true, icon: '↗' }),
          this.Btn('Mark as published', () => this.markPublished(m.vi), { variant: 'primary', sm: true, icon: '✓' })),
      ));
    }

    // history + compare
    const entries = [{ label: 'Current', body: v.body, hook: v.hook, editor: v.editor || 'AI draft', ts: v.ts, current: true }, ...v.history];
    const sel = Math.min(m.sel || 0, entries.length - 1);
    const selEntry: any = entries[sel];
    // diff: compare selected (older) against current
    const older: any = selEntry.current ? (v.history[0] || selEntry) : selEntry;
    const diff = lcsDiff((older.body || '').split(' '), (v.body || '').split(' '));
    const tok = (arr: any[]) => arr.map((t, k) => h('span', {
      key: k, style: {
        background: t.s === 1 ? 'rgba(46,139,116,0.22)' : t.s === -1 ? 'rgba(194,69,62,0.18)' : 'transparent',
        color: t.s === -1 ? SEM.error : t.s === 1 ? (C.dark ? '#7ee0c4' : SEM.success) : C.text,
        textDecoration: t.s === -1 ? 'line-through' : 'none', borderRadius: '3px'
      }
    }, t.w + ' '));

    return shell('860px', h('div', {},
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '18px 22px', borderBottom: '1px solid ' + C.borderSoft } },
        h('span', { style: { fontSize: '16px' } }, '↺'),
        h('div', { style: { flex: 1 } },
          h('h3', { style: { margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '17px', letterSpacing: '-0.02em', color: C.heading } }, 'Version history — Version ' + v.label),
          h('div', { style: { fontSize: '14px', color: C.dim, marginTop: '2px' } }, (v.history.length + 1) + ' versions · compare and revert')),
        h('button', { className: 'pcs-btn', onClick: close, style: { background: 'transparent', border: 'none', color: C.faint, fontSize: '20px', lineHeight: 1, padding: '2px 6px' } }, '×'),
      ),
      h('div', { style: { display: 'grid', gridTemplateColumns: '232px 1fr' } },
        // timeline
        h('div', { className: 'pcs-scroll', style: { borderRight: '1px solid ' + C.borderSoft, padding: '12px', maxHeight: '62vh', overflow: 'auto' } },
          entries.map((e: any, k) => {
            const on = k === sel;
            return h('button', {
              key: k, className: 'pcs-btn', onClick: () => this.setState({ modal: { ...m, sel: k } }),
              style: {
                width: '100%', textAlign: 'left', border: '1px solid ' + (on ? (C.dark ? C.accent : '#0F0E0B') : 'transparent'), borderRadius: '11px',
                padding: '11px 12px', marginBottom: '6px', background: on ? (C.dark ? 'rgba(194,134,30,0.10)' : 'rgba(8,9,11,0.04)') : 'transparent'
              }
            },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' } },
                h('span', { style: { fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: '14.5px', color: C.heading } }, e.current ? 'Current' : e.label),
                e.current ? this.Pill('live', SEM.success, { bg: 'rgba(46,139,116,0.16)', fg: SEM.success, fs: '9px', pad: '2px 6px' }) : null),
              h('div', { style: { fontSize: '13.5px', color: C.dim, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, e.hook),
              h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: C.faint, marginTop: '5px' } }, e.editor + ' · ' + rel(e.ts)),
            );
          }),
        ),
        // compare pane
        h('div', { style: { padding: '18px 20px' } },
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' } },
            h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: C.faint, letterSpacing: '0.04em' } },
              selEntry.current ? 'Showing latest changes (vs ' + ((v.history[0] || {}).label || 'origin') + ')' : ('Comparing ' + selEntry.label + ' → Current')),
            h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px', color: C.dim } },
              h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } }, h('span', { style: { width: '9px', height: '9px', borderRadius: '2px', background: 'rgba(46,139,116,0.3)' } }), 'added'),
              h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } }, h('span', { style: { width: '9px', height: '9px', borderRadius: '2px', background: 'rgba(194,69,62,0.25)' } }), 'removed')),
          ),
          h('div', {
            style: {
              borderRadius: '12px', padding: '15px 16px', background: C.dark ? 'rgba(0,0,0,0.22)' : '#fff', border: '1px solid ' + C.border,
              fontSize: '15.5px', lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', maxHeight: '40vh', overflow: 'auto'
            }
          },
            h('div', { className: 'pcs-scroll' }, tok(diff.newR))),
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '16px', flexWrap: 'wrap' } },
            h('div', { style: { fontSize: '14px', color: C.dim } }, selEntry.current ? 'This is the live version.' : 'Restore this version as the current draft.'),
            h('div', { style: { display: 'flex', gap: '8px' } },
              this.Btn('Close', close, { variant: 'ghost', sm: true }),
              selEntry.current ? null : this.Btn('Revert to this', () => this.revert(m.vi, sel - 1), { variant: 'primary', sm: true, icon: '↺' })),
          ),
        ),
      ),
    ));
  }
}
