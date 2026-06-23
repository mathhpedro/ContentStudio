import React from 'react';
import { flushSync } from 'react-dom';
import {
  SEM, DEFAULT_STYLE, AUTHORED, makePosts, makeVersions, regen,
  NOW, rel, lcsDiff, type Post, type Version,
} from './data';

const h = React.createElement;

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

export default class App extends React.Component<{}, any> {
  _tid: any;

  constructor(props: {}) {
    super(props);
    this.state = {
      theme: 'dark', tab: 'calendar', selectedId: 'p15', refreshOpen: true,
      posts: makePosts(), styleProfile: DEFAULT_STYLE, editingVer: null, draft: '', modal: null,
      toast: null, styleOpen: false, whyOpen: {}, indL: 0, indW: 0,
    };
    this._tid = 0;
    this.tabRefs = {};
  }

  tabRefs: Record<string, HTMLElement | null>;

  componentDidMount() { this.syncTab(); window.addEventListener('resize', this.syncTab); }
  componentWillUnmount() { window.removeEventListener('resize', this.syncTab); }
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
    return d ? {
      dark: true, bg: '#08090B', panel: '#0C0D11', card: '#121317', card2: '#16181D', raise: '#1B1D23',
      border: '#232529', borderSoft: 'rgba(255,255,255,0.07)',
      text: '#E9EBEF', dim: '#969BA4', faint: '#6B7079', heading: '#FFFFFF', accent: '#B8BCC4',
      primBg: '#E9EBEF', primFg: '#0A0B0D',
      glass: 'rgba(22,24,29,0.66)', glassBorder: 'rgba(255,255,255,0.10)', glassHi: 'rgba(255,255,255,0.45)',
      shadow: '0 16px 50px rgba(0,0,0,0.55)', input: '#0E0F13',
      // liquid-glass surface tokens (translucent panels that refract the drifting background)
      surf: 'rgba(20,22,27,0.55)', surf2: 'rgba(27,29,35,0.5)', surfBorder: 'rgba(255,255,255,0.09)',
      surfHi: 'rgba(255,255,255,0.16)', surfShadow: '0 10px 34px rgba(0,0,0,0.42)',
    } : {
      dark: false, bg: '#EDEEF1', panel: '#F5F6F8', card: '#FFFFFF', card2: '#FBFBFD', raise: '#FFFFFF',
      border: '#E1E3E8', borderSoft: 'rgba(8,9,11,0.07)',
      text: '#16181D', dim: '#6B7079', faint: '#969BA4', heading: '#08090B', accent: '#45484E',
      primBg: '#121317', primFg: '#FFFFFF',
      glass: 'rgba(255,255,255,0.7)', glassBorder: 'rgba(255,255,255,0.85)', glassHi: 'rgba(255,255,255,0.9)',
      shadow: '0 16px 50px rgba(8,9,11,0.14)', input: '#FFFFFF',
      // liquid-glass surface tokens (light)
      surf: 'rgba(255,255,255,0.62)', surf2: 'rgba(255,255,255,0.5)', surfBorder: 'rgba(255,255,255,0.7)',
      surfHi: 'rgba(255,255,255,0.95)', surfShadow: '0 10px 34px rgba(8,9,11,0.10)',
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
      'Published': { fg: C.dark ? '#0A0B0D' : '#FFFFFF', bg: C.dark ? '#B8BCC4' : '#16181D', dot: C.accent, solid: true },
    };
    return map[s] || map['Draft'];
  }
  prioMeta(p: string) { return p === 'High' ? { c: SEM.error, l: 'High' } : p === 'Medium' ? { c: SEM.warning, l: 'Medium' } : { c: this.C.faint, l: 'Low' }; }

  // ---------- ui atoms ----------
  Btn(label: any, onClick: any, opt: any = {}) {
    const C = this.C; const v = opt.variant || 'ghost';
    const base: any = {
      display: 'inline-flex', alignItems: 'center', gap: '7px', fontFamily: "'Sora',sans-serif",
      fontWeight: 600, fontSize: opt.sm ? '12.5px' : '13.5px', letterSpacing: '-0.01em', borderRadius: opt.sm ? '10px' : '12px',
      padding: opt.sm ? '7px 12px' : '10px 16px', border: '1px solid transparent', whiteSpace: 'nowrap', lineHeight: 1
    };
    const styles: any = {
      primary: { background: C.primBg, color: C.primFg, boxShadow: C.dark ? 'inset 0 1px 0 rgba(255,255,255,0.5)' : '0 1px 2px rgba(0,0,0,0.2)' },
      ghost: { background: 'transparent', color: C.text, borderColor: C.border },
      glass: { background: C.glass, color: C.text, borderColor: C.glassBorder, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' },
      soft: { background: C.dark ? 'rgba(255,255,255,0.06)' : 'rgba(8,9,11,0.05)', color: C.text, borderColor: C.borderSoft },
      success: { background: 'rgba(46,139,116,0.16)', color: SEM.success, borderColor: 'rgba(46,139,116,0.4)' },
      danger: { background: 'rgba(194,69,62,0.14)', color: SEM.error, borderColor: 'rgba(194,69,62,0.4)' },
    };
    return h('button', {
      className: 'pcs-btn', onClick, disabled: opt.disabled,
      style: { ...base, ...styles[v], opacity: opt.disabled ? 0.45 : 1, cursor: opt.disabled ? 'not-allowed' : 'pointer', ...(opt.style || {}) }
    },
      opt.icon ? h('span', { style: { fontSize: '14px', lineHeight: 1, fontFamily: 'system-ui' } }, opt.icon) : null, label);
  }
  Pill(label: any, color: any, opt: any = {}) {
    const C = this.C;
    return h('span', {
      style: {
        display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: "'Sora',sans-serif",
        fontSize: opt.fs || '11px', fontWeight: 600, letterSpacing: '0.01em', padding: opt.pad || '4px 9px', borderRadius: '999px',
        background: opt.solid ? (opt.bg || color) : (opt.bg || 'transparent'), color: opt.solid ? (opt.solidFg || (C.dark ? '#0A0B0D' : '#fff')) : (opt.fg || color),
        border: opt.border || 'none', lineHeight: 1, ...(opt.style || {})
      }
    },
      opt.dot ? h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: opt.dot } }) : null, label);
  }
  StatusBadge(s: string) { const m = this.statusMeta(s); return m.solid ? this.Pill(s, m.fg, { solid: true, bg: m.bg, solidFg: m.fg }) : this.Pill(s, m.fg, { bg: m.bg, fg: m.fg, dot: m.dot }); }
  FormatTag(f: string) {
    const C = this.C; return h('span', {
      style: {
        fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', fontWeight: 500,
        letterSpacing: '0.06em', textTransform: 'uppercase', color: C.faint
      }
    }, f);
  }

  // ---------- helpers ----------
  fmtDay(d: string) { return parseInt(d.split('-')[2], 10); }
  fmtLong(d: string) { const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
  post(id: string): Post | undefined { return this.state.posts.find((p: Post) => p.id === id); }
  weekPosts() { return this.state.posts.filter((p: Post) => ['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26'].includes(p.date) && p.change); }
  getVersions(post: Post): Version[] {
    if (post.versions) return post.versions;
    const v = AUTHORED[post.id] || makeVersions(post);
    post.versions = v; return v;
  }
  toast(msg: string) { this.setState({ toast: msg }); clearTimeout(this._tid); this._tid = setTimeout(() => this.setState({ toast: null }), 2200); }

  // ---------- actions ----------
  setTheme(t: string) { fluid(() => this.setState({ theme: t })); }
  setTab(t: string) { fluid(() => this.setState({ tab: t })); }
  openPost(id: string) { fluid(() => this.setState({ tab: 'generate', selectedId: id, editingVer: null })); }
  setStatus(id: string, s: string) { const posts = this.state.posts.map((p: Post) => p.id === id ? { ...p, status: s } : p); this.setState({ posts }); this.toast('Status → ' + s); }
  setActiveVer(i: number) { const p = this.post(this.state.selectedId)!; p.activeVer = i; this.forceUpdate(); }
  movePost(id: string, date: string) { const posts = this.state.posts.map((p: Post) => p.id === id ? { ...p, date } : p); this.setState({ posts }); }
  setStyle(v: string) { this.setState({ styleProfile: v }); }

  startEdit(vi: number) { const p = this.post(this.state.selectedId)!; const v = this.getVersions(p)[vi]; this.setState({ editingVer: vi, draft: v.body }); }
  cancelEdit() { this.setState({ editingVer: null, draft: '' }); }
  saveEdit(vi: number) {
    const p = this.post(this.state.selectedId)!; const vers = this.getVersions(p); const v = vers[vi];
    if (this.state.draft !== v.body) {
      v.history = [{ body: v.body, hook: v.hook, editor: v.editor || 'Pragma AI', ts: v.ts, label: 'v' + (v.history.length + 1) }, ...v.history];
      v.body = this.state.draft; v.editor = 'You'; v.ts = NOW();
    }
    this.setState({ editingVer: null, draft: '' }); this.toast('Saved — new version logged');
  }
  regenerate(vi: number) {
    const p = this.post(this.state.selectedId)!; const vers = this.getVersions(p); const v = vers[vi];
    v.history = [{ body: v.body, hook: v.hook, editor: v.editor || 'Pragma AI', ts: v.ts, label: 'v' + (v.history.length + 1) }, ...v.history];
    const alt = regen(p, vi, v.regenCount || 0); v.body = alt.body; v.hook = alt.hook; v.editor = 'Pragma AI'; v.ts = NOW(); v.regenCount = (v.regenCount || 0) + 1;
    this.forceUpdate(); this.toast('Regenerated — fresh draft');
  }
  approve(vi: number) {
    const p = this.post(this.state.selectedId)!; const vers = this.getVersions(p);
    vers.forEach((v, i) => v.approved = (i === vi)); p.activeVer = vi; p.status = 'Approved';
    this.setState({ posts: [...this.state.posts] }); this.toast('Approved ✓');
  }
  revert(vi: number, hi: number) {
    const p = this.post(this.state.selectedId)!; const v = this.getVersions(p)[vi]; const snap = v.history[hi];
    v.history = [{ body: v.body, hook: v.hook, editor: v.editor || 'Pragma AI', ts: v.ts, label: 'pre-revert' }, ...v.history];
    v.body = snap.body; v.hook = snap.hook!; v.editor = 'You (revert)'; v.ts = NOW();
    this.setState({ modal: null }); this.toast('Reverted to ' + snap.label);
  }
  schedule(vi: number) {
    const p = this.post(this.state.selectedId)!; this.approve(vi); p.scheduledFor = p.date; p.status = 'Approved';
    this.setState({ modal: null, posts: [...this.state.posts] }); this.toast('Scheduled for ' + this.fmtLong(p.date));
  }

  // ---------- render ----------
  render() { return this.renderApp(); }

  renderApp() {
    const C = this.C;
    return h('div', {
      className: 'pcs-scroll', style: {
        minHeight: '100vh', height: '100vh', overflow: 'auto', background: C.bg, color: C.text,
        fontFamily: "'Hanken Grotesk',sans-serif", position: 'relative', transition: 'background .3s ease,color .3s ease'
      }
    },
      // ambient liquid field — slowly drifting gradients that the glass surfaces refract
      h('div', {
        style: {
          position: 'fixed', inset: '-15%', pointerEvents: 'none', zIndex: 0,
          animation: 'pcsDrift 26s ease-in-out infinite',
          background: C.dark
            ? 'radial-gradient(760px 520px at 78% -6%, rgba(184,188,196,0.12), transparent 60%), radial-gradient(620px 520px at 8% 18%, rgba(120,150,170,0.10), transparent 62%), radial-gradient(700px 600px at 60% 108%, rgba(150,130,180,0.10), transparent 60%)'
            : 'radial-gradient(760px 520px at 80% -8%, rgba(120,140,180,0.18), transparent 60%), radial-gradient(640px 540px at 4% 14%, rgba(150,180,200,0.20), transparent 62%), radial-gradient(700px 600px at 64% 110%, rgba(190,170,210,0.18), transparent 60%)',
        }
      }),
      h('div', { style: { position: 'relative', zIndex: 1, maxWidth: '1280px', margin: '0 auto', padding: '0 28px 80px' } },
        this.renderHeader(),
        h('div', { key: this.state.tab, style: { viewTransitionName: 'pcs-view', animation: 'pcsViewIn .42s var(--pcs-ease) both' } as any },
          this.state.tab === 'calendar' ? this.renderCalendar() : this.renderGenerator()),
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
        padding: '12px 20px', fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: '13.5px', color: C.text, animation: 'pcsPop .25s ease'
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
          position: 'relative', zIndex: 1, fontFamily: "'Sora',sans-serif", fontWeight: 600,
          fontSize: '13.5px', letterSpacing: '-0.01em', padding: '9px 17px', borderRadius: '10px', border: 'none',
          background: 'transparent', color: on ? C.heading : C.dim
        }
      }, label);
    };
    const ThemeBtn = (t: string, gly: string) => {
      const on = this.state.theme === t;
      return h('button', {
        className: 'pcs-btn', onClick: () => this.setTheme(t), title: t, style: {
          width: '30px', height: '30px', borderRadius: '8px',
          border: 'none', display: 'grid', placeItems: 'center', fontSize: '14px', background: on ? (C.dark ? 'rgba(255,255,255,0.12)' : '#fff') : 'transparent',
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
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginRight: '4px' } },
          h('span', { style: { fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '19px', letterSpacing: '0.17em', color: C.heading, lineHeight: 1 } }, 'PRAGMA'),
          h('span', { style: { width: '1px', height: '18px', background: C.border } }),
          h('span', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '9.5px', letterSpacing: '0.14em', color: C.faint, textTransform: 'uppercase' } }, 'Content Studio'),
        ),
        // tabs — sliding liquid-glass indicator behind the active tab
        h('div', { style: { position: 'relative', display: 'flex', gap: '4px', padding: '4px', borderRadius: '12px', background: C.dark ? 'rgba(0,0,0,0.25)' : 'rgba(8,9,11,0.05)' } },
          h('div', {
            className: 'pcs-tab-ind', style: {
              position: 'absolute', top: '4px', bottom: '4px', left: 0, width: (this.state.indW || 0) + 'px',
              transform: 'translateX(' + (this.state.indL || 0) + 'px)', borderRadius: '10px', zIndex: 0,
              background: C.dark ? 'rgba(255,255,255,0.12)' : '#FFFFFF',
              boxShadow: (C.dark ? 'inset 0 1px 0 rgba(255,255,255,0.35)' : '0 1px 3px rgba(8,9,11,0.14)') + ', 0 4px 14px rgba(0,0,0,0.18)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            }
          }),
          Tab('calendar', 'Post Calendar'), Tab('generate', 'Content Generation')),
        h('div', { style: { flex: 1 } }),
        // theme toggle
        h('div', { style: { display: 'flex', gap: '2px', padding: '3px', borderRadius: '10px', background: C.dark ? 'rgba(0,0,0,0.25)' : 'rgba(8,9,11,0.05)' } },
          ThemeBtn('light', '☀'), ThemeBtn('dark', '☽')),
      ),
    );
  }

  renderCalendar() {
    const C = this.C;
    const changed = this.state.posts.filter((p: Post) => p.change);
    const visible = this.state.posts.filter((p: Post) => p.status === 'Approved' || p.status === 'Published');
    const dim = 30; const first = 1; // June 1 2026 = Monday
    const cells: (number | null)[] = []; for (let i = 0; i < first - 1; i++) cells.push(null); for (let d = 1; d <= dim; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const today = 22;
    const byDay: any = {}; visible.forEach((p: Post) => { const dd = this.fmtDay(p.date); (byDay[dd] = byDay[dd] || []).push(p); });
    const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return h('div', { style: { animation: 'pcsFade .4s ease', paddingTop: '14px' } },
      // title row
      h('div', { style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '18px' } },
        h('div', {},
          h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', letterSpacing: '0.16em', color: C.faint, textTransform: 'uppercase', marginBottom: '8px' } }, 'Editorial Calendar'),
          h('h1', { style: { margin: 0, fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '34px', letterSpacing: '-0.03em', color: C.heading } },
            'June 2026',
            h('span', { style: { marginLeft: '12px', fontSize: '17px', fontWeight: 500, color: C.dim, letterSpacing: '-0.01em' } }, visible.length + ' scheduled'),
          ),
        ),
        h('div', { style: { display: 'flex', gap: '9px', alignItems: 'center' } },
          this.Btn('Refresh topics', () => this.runRefresh(), { variant: 'soft', icon: '↻' }),
          this.Btn('New post', () => this.toast('New post — pick a day'), { variant: 'primary', icon: '+' }),
        ),
      ),
      // weekly refresh panel
      this.renderRefreshPanel(changed),
      // sub-header line
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', margin: '2px 2px 14px' } },
        h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: C.dim } },
          this.StatusBadge('Approved'), this.StatusBadge('Published')),
        h('span', { style: { flex: 1 } }),
        h('span', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '10.5px', color: C.faint } }, 'Drag a card to reschedule'),
      ),
      // weekday header
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '10px', marginBottom: '8px' } },
        wd.map((w, i) => h('div', {
          key: w, style: {
            fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: '12px', letterSpacing: '0.02em',
            color: i > 4 ? C.faint : C.dim, textAlign: 'left', paddingLeft: '4px'
          }
        }, w))),
      // grid
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '10px' } },
        cells.map((d, i) => this.renderDayCell(d, byDay[d as any] || [], today, i))),
    );
  }

  renderRefreshPanel(changed: Post[]) {
    const C = this.C;
    if (!this.state.refreshOpen) return null;
    const newc = changed.filter((p) => p.change === 'new').length, upc = changed.filter((p) => p.change === 'updated').length;
    const firstNew = changed.find((p) => p.change === 'new') || changed[0];
    return h('div', {
      className: 'pcs-glass pcs-sheen',
      style: {
        display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 15px', borderRadius: '14px', marginBottom: '16px',
        ...this.glass(), animation: 'pcsFade .4s ease'
      }
    },
      h('span', { className: 'pcs-sheen-bar' }),
      h('span', {
        style: {
          width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0, display: 'grid', placeItems: 'center',
          background: C.dark ? 'rgba(184,188,196,0.16)' : '#16181D', color: C.dark ? C.accent : '#fff', fontSize: '13px',
          animation: 'pcsPulse 2.6s ease-in-out infinite'
        }
      }, '↻'),
      h('div', { style: { fontSize: '12.5px', color: C.dim, lineHeight: 1.45, flex: 1 } },
        h('strong', { style: { color: C.heading, fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: '13px' } }, 'Weekly refresh'),
        h('span', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: C.faint } }, '  · Jun 22'),
        '   —   ' + newc + ' new topics and ' + upc + ' sharpened angles added to your backlog.'),
      firstNew ? this.Btn('Review drafts', () => this.openPost(firstNew.id), { variant: 'soft', sm: true }) : null,
      h('button', {
        className: 'pcs-btn', onClick: () => this.setState({ refreshOpen: false }), style: {
          background: 'transparent', border: 'none',
          color: C.faint, fontSize: '16px', lineHeight: 1, padding: '2px 4px'
        }
      }, '×'),
    );
  }

  renderDayCell(d: number | null, posts: Post[], today: number, key: number) {
    const C = this.C; const isToday = d === today; const weekend = (key % 7) > 4;
    if (d === null) return h('div', { key: key, style: { minHeight: '150px', borderRadius: '14px', border: '1px dashed ' + C.borderSoft, opacity: 0.4 } });
    return h('div', {
      key: key, className: 'pcs-day pcs-int pcs-glass',
      onDragOver: (e: any) => { e.preventDefault(); e.currentTarget.classList.add('pcs-drag-over'); },
      onDragLeave: (e: any) => e.currentTarget.classList.remove('pcs-drag-over'),
      onDrop: (e: any) => { e.preventDefault(); e.currentTarget.classList.remove('pcs-drag-over'); const id = e.dataTransfer.getData('text'); if (id) this.movePost(id, '2026-06-' + String(d).padStart(2, '0')); },
      style: {
        minHeight: '150px', maxHeight: '320px', display: 'flex', flexDirection: 'column', borderRadius: '14px',
        ...this.glass({ blur: 14, soft: weekend }),
        overflow: 'hidden',
        ...(isToday ? {
          background: C.dark ? 'rgba(184,188,196,0.12)' : 'rgba(255,255,255,0.7)',
          border: '1px solid ' + (C.dark ? 'rgba(184,188,196,0.55)' : '#16181D'),
          boxShadow: 'inset 0 1px 0 ' + C.surfHi + ', ' + (C.dark ? '0 0 0 1px rgba(184,188,196,0.35), 0 8px 24px rgba(0,0,0,0.35)' : '0 8px 22px rgba(8,9,11,0.12)'),
        } : {}),
      }
    },
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 11px 6px' } },
        isToday
          ? h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '7px' } },
            h('span', {
              style: {
                width: '22px', height: '22px', borderRadius: '50%', display: 'grid', placeItems: 'center',
                fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '12px', background: C.dark ? '#E9EBEF' : '#16181D', color: C.dark ? '#08090B' : '#fff'
              }
            }, d),
            h('span', { style: { fontSize: '8.5px', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.1em', color: C.dark ? C.accent : '#16181D', textTransform: 'uppercase', fontWeight: 600 } }, 'Today'))
          : h('span', { style: { fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: '13px', color: weekend ? C.faint : C.dim } }, d),
        posts.length ? h('span', { style: { fontSize: '10px', fontFamily: "'JetBrains Mono',monospace", color: C.faint } }, posts.length) : null,
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
        h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: sm.solid ? C.accent : sm.dot, flexShrink: 0 } })),
      h('div', {
        style: {
          fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: '12.5px', letterSpacing: '-0.01em', color: C.heading,
          lineHeight: 1.32, marginBottom: '10px'
        }
      }, p.topic),
      this.StatusBadge(p.status),
    );
  }

  runRefresh() { this.setState({ refreshOpen: true }); this.toast('Topics refreshed for this week'); }

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
          background: 'transparent', border: 'none', color: C.dim, fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: '13px', padding: '4px 0', marginBottom: '14px'
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
          h('span', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: C.faint } }, this.fmtLong(p.date)),
          h('span', { style: { marginLeft: 'auto' } }, this.StatusBadge(p.status)),
        ),
        h('h1', { style: { margin: '0 0 6px', fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '30px', letterSpacing: '-0.03em', color: C.heading, lineHeight: 1.12 } }, p.topic),
        h('p', { style: { margin: '0 0 18px', fontSize: '15px', color: C.dim, lineHeight: 1.55, maxWidth: '720px' } }, p.angle),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' } },
          h('div', { style: { display: 'flex', gap: '5px', padding: '4px', borderRadius: '11px', background: C.dark ? 'rgba(0,0,0,0.25)' : 'rgba(8,9,11,0.04)' } },
            statuses.map((s) => {
              const on = p.status === s; const m = this.statusMeta(s);
              return h('button', {
                key: s, className: 'pcs-btn', onClick: () => this.setStatus(p.id, s), style: {
                  border: 'none', borderRadius: '8px',
                  padding: '6px 11px', fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: '12px',
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
      // versions header
      h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', margin: '22px 2px 14px', flexWrap: 'wrap' } },
        h('h2', { style: { margin: 0, fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '19px', letterSpacing: '-0.02em', color: C.heading } },
          '3 generated versions',
          h('span', { style: { marginLeft: '9px', fontSize: '13px', fontWeight: 500, color: C.dim } }, '— choose one to publish')),
        this.Btn('Regenerate all', () => { vers.forEach((v, i) => this.regenerate(i)); }, { variant: 'soft', sm: true, icon: '↻' }),
      ),
      // version grid
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(332px,1fr))', gap: '16px', alignItems: 'start' } },
        vers.map((v, i) => this.renderVersion(p, v, i))),
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
            background: C.dark ? 'rgba(184,188,196,0.14)' : '#16181D', color: C.dark ? C.accent : '#fff', fontSize: '14px'
          }
        }, '✎'),
        h('div', { style: { flex: 1 } },
          h('div', { style: { fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: '14px', color: C.heading } }, 'Your writing style'),
          h('div', { style: { fontSize: '12px', color: C.dim, marginTop: '2px' } }, 'Voice + reference examples that feed every generation')),
        h('span', { style: { color: C.faint, fontSize: '13px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' } }, '▼'),
      ),
      open ? h('div', { style: { padding: '0 18px 18px', animation: 'pcsFade .25s ease' } },
        h('textarea', {
          value: this.state.styleProfile, onChange: (e: any) => this.setStyle(e.target.value), spellCheck: false,
          style: {
            width: '100%', minHeight: '120px', resize: 'vertical', borderRadius: '12px', padding: '13px 15px',
            background: C.input, border: '1px solid ' + C.border, color: C.text, fontSize: '13.5px', lineHeight: 1.65,
            fontFamily: "'Hanken Grotesk',sans-serif", outline: 'none'
          }
        }),
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '10px', flexWrap: 'wrap' } },
          h('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap' } },
            ['Harvard methods on', 'No emojis', 'First-person', 'Ends with a question'].map((t) => this.Pill(t, C.dim, {
              bg: C.dark ? 'rgba(255,255,255,0.05)' : 'rgba(8,9,11,0.04)', fg: C.dim, fs: '10.5px',
              style: { fontFamily: "'JetBrains Mono',monospace" }
            }))),
          this.Btn('Save style', () => this.toast('Style profile saved'), { variant: 'soft', sm: true }),
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
        border: '1px solid ' + (v.approved ? 'rgba(46,139,116,0.5)' : active ? (C.dark ? 'rgba(184,188,196,0.4)' : '#16181D') : C.surfBorder),
        boxShadow: 'inset 0 1px 0 ' + C.surfHi + ', ' + (v.approved ? '0 0 0 1px rgba(46,139,116,0.25), ' + C.surfShadow : C.surfShadow)
      }
    },
      h('span', { className: 'pcs-sheen-bar' }),
      // header
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', padding: '12px 15px', borderBottom: '1px solid ' + C.borderSoft } },
        h('span', {
          style: {
            width: '24px', height: '24px', borderRadius: '7px', display: 'grid', placeItems: 'center',
            fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '12px',
            background: active ? (C.dark ? '#E9EBEF' : '#16181D') : (C.dark ? 'rgba(255,255,255,0.07)' : 'rgba(8,9,11,0.05)'),
            color: active ? (C.dark ? '#08090B' : '#fff') : C.dim
          }
        }, v.label),
        h('span', { style: { fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: '13px', color: C.heading } }, 'Version ' + v.label),
        v.approved ? this.Pill('Approved', SEM.success, { bg: 'rgba(46,139,116,0.16)', fg: SEM.success, dot: SEM.success, fs: '10px' }) : null,
        h('span', { style: { flex: 1 } }),
        h('button', {
          className: 'pcs-btn', title: 'Version history', onClick: () => this.setState({ modal: { type: 'history', vi: i, sel: 0 } }),
          style: {
            display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'transparent', border: '1px solid ' + C.border, borderRadius: '8px',
            padding: '4px 8px', color: C.dim, fontSize: '10.5px', fontFamily: "'JetBrains Mono',monospace"
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
              border: '1px solid ' + (C.dark ? C.accent : '#16181D'), color: C.text, fontSize: '14px', lineHeight: 1.68,
              fontFamily: "'Hanken Grotesk',sans-serif", outline: 'none'
            }
          })
          : h('div', {},
            h('div', {
              style: {
                fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: '15px', letterSpacing: '-0.01em', lineHeight: 1.36, color: C.heading,
                paddingLeft: '13px', borderLeft: '3px solid ' + (C.dark ? C.accent : '#16181D'), marginBottom: '13px'
              }
            }, v.hook),
            h('div', { style: { fontSize: '13.5px', lineHeight: 1.64, color: C.text, whiteSpace: 'pre-wrap' } }, v.body)),
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
          h('span', { style: { fontSize: '11px' } }, '🎓'),
          h('span', { style: { fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: '12px', color: C.heading } }, methodShort),
          h('span', { style: { flex: 1 } }),
          h('span', { style: { fontSize: '10px', color: C.faint, fontFamily: "'JetBrains Mono',monospace" } }, whyOpen ? 'hide' : 'why it works'),
          h('span', { style: { color: C.faint, fontSize: '9px', transform: whyOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' } }, '▼')),
        whyOpen ? h('div', { style: { padding: '11px 12px 2px', animation: 'pcsFade .2s ease' } },
          h('div', { style: { fontSize: '12.5px', color: C.dim, lineHeight: 1.56, marginBottom: '10px' } }, v.methodNote),
          h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '9.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.faint, marginBottom: '4px' } }, 'Why it engages'),
          h('div', { style: { fontSize: '12.5px', color: C.dim, lineHeight: 1.56, marginBottom: '8px' } }, v.why),
          h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: C.faint } }, 'Last edit · ' + (v.editor || 'Pragma AI') + ' · ' + rel(v.ts))) : null,
      ),
      // controls
      h('div', { style: { display: 'flex', gap: '7px', padding: '13px 15px', borderTop: '1px solid ' + C.borderSoft, flexWrap: 'wrap', marginTop: '10px' } },
        editing
          ? [this.Btn('Save', () => this.saveEdit(i), { variant: 'primary', sm: true, icon: '✓' }),
          this.Btn('Cancel', () => this.cancelEdit(), { variant: 'ghost', sm: true })]
          : [this.Btn('Edit', () => this.startEdit(i), { variant: 'ghost', sm: true, icon: '✎' }),
          this.Btn('Regenerate', () => this.regenerate(i), { variant: 'soft', sm: true, icon: '↻' }),
          h('span', { key: 'sp', style: { flex: 1 } }),
          this.Btn('Approve', () => this.approve(i), { variant: v.approved ? 'success' : 'ghost', sm: true, icon: v.approved ? '✓' : null }),
          this.Btn('Schedule', () => this.setState({ modal: { type: 'schedule', vi: i } }), { variant: 'primary', sm: true, icon: '📅' })],
      ),
    );
  }

  renderModal() {
    const m = this.state.modal; if (!m) return null; const C = this.C;
    const p = this.post(this.state.selectedId)!; const v = this.getVersions(p)[m.vi];
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

    if (m.type === 'schedule') {
      return shell('440px', h('div', { style: { padding: '26px' } },
        h('div', { style: { fontSize: '30px', marginBottom: '10px' } }, '📅'),
        h('h3', { style: { margin: '0 0 6px', fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', color: C.heading } }, 'Schedule this post'),
        h('p', { style: { margin: '0 0 18px', fontSize: '14px', color: C.dim, lineHeight: 1.55 } },
          'Version ', h('strong', { style: { color: C.text } }, v.label), ' will be approved and queued for publication on ',
          h('strong', { style: { color: C.text } }, this.fmtLong(p.date)), '.'),
        h('div', { style: { display: 'flex', gap: '9px', justifyContent: 'flex-end' } },
          this.Btn('Cancel', close, { variant: 'ghost' }),
          this.Btn('Confirm schedule', () => this.schedule(m.vi), { variant: 'primary', icon: '✓' })),
      ));
    }

    // history + compare
    const entries = [{ label: 'Current', body: v.body, hook: v.hook, editor: v.editor || 'Pragma AI', ts: v.ts, current: true }, ...v.history];
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
          h('h3', { style: { margin: 0, fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '17px', letterSpacing: '-0.02em', color: C.heading } }, 'Version history — Version ' + v.label),
          h('div', { style: { fontSize: '12px', color: C.dim, marginTop: '2px' } }, (v.history.length + 1) + ' versions · compare and revert')),
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
                width: '100%', textAlign: 'left', border: '1px solid ' + (on ? (C.dark ? C.accent : '#16181D') : 'transparent'), borderRadius: '11px',
                padding: '11px 12px', marginBottom: '6px', background: on ? (C.dark ? 'rgba(184,188,196,0.10)' : 'rgba(8,9,11,0.04)') : 'transparent'
              }
            },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' } },
                h('span', { style: { fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '12.5px', color: C.heading } }, e.current ? 'Current' : e.label),
                e.current ? this.Pill('live', SEM.success, { bg: 'rgba(46,139,116,0.16)', fg: SEM.success, fs: '9px', pad: '2px 6px' }) : null),
              h('div', { style: { fontSize: '11.5px', color: C.dim, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, e.hook),
              h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '9.5px', color: C.faint, marginTop: '5px' } }, e.editor + ' · ' + rel(e.ts)),
            );
          }),
        ),
        // compare pane
        h('div', { style: { padding: '18px 20px' } },
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' } },
            h('div', { style: { fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: C.faint, letterSpacing: '0.04em' } },
              selEntry.current ? 'Showing latest changes (vs ' + ((v.history[0] || {}).label || 'origin') + ')' : ('Comparing ' + selEntry.label + ' → Current')),
            h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', fontSize: '11px', color: C.dim } },
              h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } }, h('span', { style: { width: '9px', height: '9px', borderRadius: '2px', background: 'rgba(46,139,116,0.3)' } }), 'added'),
              h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } }, h('span', { style: { width: '9px', height: '9px', borderRadius: '2px', background: 'rgba(194,69,62,0.25)' } }), 'removed')),
          ),
          h('div', {
            style: {
              borderRadius: '12px', padding: '15px 16px', background: C.dark ? 'rgba(0,0,0,0.22)' : '#fff', border: '1px solid ' + C.border,
              fontSize: '13.5px', lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', maxHeight: '40vh', overflow: 'auto'
            }
          },
            h('div', { className: 'pcs-scroll' }, tok(diff.newR))),
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '16px', flexWrap: 'wrap' } },
            h('div', { style: { fontSize: '12px', color: C.dim } }, selEntry.current ? 'This is the live version.' : 'Restore this version as the current draft.'),
            h('div', { style: { display: 'flex', gap: '8px' } },
              this.Btn('Close', close, { variant: 'ghost', sm: true }),
              selEntry.current ? null : this.Btn('Revert to this', () => this.revert(m.vi, sel - 1), { variant: 'primary', sm: true, icon: '↺' })),
          ),
        ),
      ),
    ));
  }
}
