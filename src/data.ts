// Data + content-generation logic, ported from the Pragma Content Studio design.

export const SEM = { success: '#2E8B74', warning: '#C9A24B', error: '#C2453E' };

export interface VersionHistoryEntry {
  label: string;
  body: string;
  hook?: string;
  editor?: string;
  ts?: string | null;
}

export interface Version {
  label: string;
  approved: boolean;
  editor: string;
  ts: string | null;
  hook: string;
  method: string;
  methodNote: string;
  why: string;
  body: string;
  history: VersionHistoryEntry[];
  regenCount?: number;
}

export interface Post {
  id: string;
  date: string;
  topic: string;
  angle: string;
  format: string;
  status: string;
  priority: string;
  change: string | null;
  scheduledFor: string | null;
  versions: Version[] | null;
  activeVer: number;
  brief?: { summary: string; why: string; points: string[] };
  publishedAt?: string | null;
  metrics?: { impressions?: number; reactions?: number; comments?: number };
}

// Current month anchor — the calendar always shows "today" in the present month/year.
export function monthAnchor() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  return { y, m, mm: String(m + 1).padStart(2, '0'), dim: new Date(y, m + 1, 0).getDate(), today: now.getDate() };
}

// The calendar starts empty — no fabricated posts. Real posts get added here.
export function makePosts(): Post[] {
  return [];
}

export function NOW() { return new Date().toISOString(); }

export function rel(ts: string | null | undefined) {
  if (!ts) return 'just now';
  const d = new Date(ts), now = new Date(); let s = Math.floor((+now - +d) / 1000);
  if (s < 0) s = 0;
  if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'; const days = Math.floor(s / 86400);
  if (days < 7) return days + 'd ago';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function lcsDiff(a: string[], b: string[]) {
  const m = a.length, n = b.length; const dp = Array.from({ length: m + 1 }, () => new Int16Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const oldR: { w: string; s: number }[] = [], newR: { w: string; s: number }[] = []; let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { oldR.push({ w: a[i], s: 0 }); newR.push({ w: b[j], s: 0 }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { oldR.push({ w: a[i], s: -1 }); i++; }
    else { newR.push({ w: b[j], s: 1 }); j++; }
  }
  while (i < m) { oldR.push({ w: a[i], s: -1 }); i++; } while (j < n) { newR.push({ w: b[j], s: 1 }); j++; }
  return { oldR, newR };
}

export const DEFAULT_STYLE = "Direct, confident, technical-but-accessible. Short punchy sentences mixed with one longer line for rhythm. I open with a contrarian claim or a number, never a greeting. No emojis, no hashtags-as-filler, no ‘in today’s fast-paced world’. I use concrete proof (figures, named workflows) and I always end by asking the reader a sharp question. I write like I talk: plainly, with a point of view.";

export const AUTHORED: Record<string, Version[]> = {
  p15: [
    {
      label: 'A', approved: false, editor: 'Pragma AI', ts: '2026-06-22T06:01:00',
      hook: 'Your AI doesn’t have a performance problem. It has an ownership problem.',
      method: 'Pyramid Principle — answer first',
      methodNote: 'Opens with the single controlling idea (ownership, not accuracy), then stacks evidence beneath it. The reader gets the thesis in line one and stays for proof, not suspense.',
      why: 'Reframes a problem everyone is tired of hearing about into one nobody is naming. The closing question is specific and slightly provocative — it hands commenters a side to take.',
      body: '91% of enterprises run AI somewhere. Almost none can tell you who is accountable when it’s wrong.\n\nThat’s the real gap. Not accuracy. Not compute. Ownership.\n\nA model that drafts a contract clause looks brilliant in a demo. In production, someone has to own the clause it got wrong — the exception it routed to the wrong desk, the number it quietly hallucinated into a board deck. When no one owns that, the system never leaves the pilot. It can’t. Nobody signs off on something they’re not accountable for.\n\nThe teams seeing real return did one unglamorous thing first: they named an owner for every AI output before they shipped it. Not a committee. A person.\n\nSo here’s the question worth arguing about: in your org, who gets the call when the model is confidently wrong — and do they have the authority to fix the workflow, or only to apologize for it?',
      history: [
        {
          label: 'v2', editor: 'Pragma AI', ts: '2026-06-22T06:00:00', hook: 'Enterprises don’t have an AI accuracy problem. They have an accountability vacuum.',
          body: '91% of companies use AI. Few can name who owns the output when it fails.\n\nThat’s the gap that keeps pilots from becoming production. Until a single person owns what the model produces, no one will stake the workflow on it.\n\nWho owns the wrong answer in your org?'
        },
        {
          label: 'v1', editor: 'Pragma AI', ts: '2026-06-22T05:58:00', hook: 'Who owns it when the AI is wrong?',
          body: 'Most AI projects stall on one question nobody planned for: accountability. The model works; the org chart doesn’t. Name an owner before you ship.'
        },
      ]
    },
    {
      label: 'B', approved: false, editor: 'Pragma AI', ts: '2026-06-22T06:01:00',
      hook: 'A bank paused a $9M AI rollout over one unanswered email.',
      method: 'Storytelling — situation, complication, resolution',
      methodNote: 'A concrete scene (bank, risk officer, one email) carries an abstract governance point. The complication–resolution arc makes the lesson feel earned, not asserted.',
      why: 'Narrative tension plus a specific dollar figure pull readers in; the relatable stall invites them to share their own war stories — high comment intent.',
      body: 'The model worked. Accuracy was past target. The pilot deck was glowing.\n\nThen a risk officer asked one question in a thread: “When this flags the wrong transaction, whose name is on the decision?”\n\nSilence. The data team owned the model. Ops owned the workflow. Compliance owned the policy. Nobody owned the output. So the rollout stopped — not because the AI failed, but because the org couldn’t say who was accountable for it.\n\nThat email cost more than any bug. And it’s the most common way enterprise AI dies: not in the model, in the org chart.\n\nThe fix wasn’t more testing. It was naming one human owner for each AI-driven decision, with the authority to change the workflow when the model slips. Boring. Decisive. The rollout shipped six weeks later.\n\nHave you seen a project stall on this exact question — ownership, not accuracy?',
      history: []
    },
    {
      label: 'C', approved: false, editor: 'Pragma AI', ts: '2026-06-22T06:01:00',
      hook: '4 questions that decide whether your AI ever reaches production:',
      method: 'Proof & specificity — numbered claims',
      methodNote: 'Each point pairs a sharp claim with a disqualifying test, teaching a usable checklist instead of vague advice. The 6%/91% figures anchor credibility.',
      why: 'Numbered structure is highly saveable and shareable; the diagnostic framing makes readers self-assess, and the closing question turns that into a comment.',
      body: 'Most pilots don’t fail technically. They fail these four:\n\n1. Who owns the output? If the answer is “the model” or “the team,” you don’t have an owner — you have a diffusion of blame.\n\n2. What workflow actually changed? Adding a tool isn’t transformation. If the steps, handoffs, and exception path look identical, the AI is decoration.\n\n3. What happens when it’s confidently wrong? Production AI needs a defined failure path, not a confidence score nobody reads.\n\n4. How does it improve next quarter — without a new project? If getting better means re-procuring, you bought a feature, not a system.\n\nThe 6% of companies seeing real AI ROI can answer all four in a sentence each. The other 91% can’t answer the first.\n\nWhich of the four is hardest in your org right now?',
      history: []
    },
  ],
};

export function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function makeVersions(post: Post): Version[] {
  const t = post.topic.toLowerCase();
  const a = post.angle;
  const v1: Version = {
    label: 'A', approved: false, editor: 'Pragma AI', ts: NOW(),
    hook: `Everyone’s talking about ${t}. Almost no one is operating it.`,
    method: 'Pyramid Principle — answer first',
    methodNote: 'Leads with the controlling idea, then layers the evidence beneath it. Readers get the payoff in line one and stay for the proof.',
    why: 'A confident, slightly contrarian opener creates tension against a familiar topic; the closing question lowers the cost of commenting to a single reply.',
    body: `${a}.\n\nThat one line is where most AI strategies quietly break. The idea is sound — the execution never leaves the slide deck.\n\nThe gap isn’t intelligence. It’s accountability and workflow. A capability that lives in a demo is a feature. One wired into how the work actually gets done — with an owner and a feedback loop — is an operating change. Only the second kind shows up on the P&L.\n\nIf you’re betting on ${t}, start with the unglamorous question: what changes the day this ships, and who owns the result when it’s wrong?\n\nWhere is your team on this right now?`,
    history: [],
  };
  const v2: Version = {
    label: 'B', approved: false, editor: 'Pragma AI', ts: NOW(),
    hook: `I watched a sharp team lose a quarter to ${t} — and it had nothing to do with the model.`,
    method: 'Storytelling — situation, complication, resolution',
    methodNote: 'A concrete scene carries the abstract point. The complication–resolution arc makes the lesson land as something witnessed, not lectured.',
    why: 'Narrative specifics create curiosity; the resolution gives a takeaway readers can apply, and the implicit “seen this too?” invites stories in the comments.',
    body: `It started well. The pilot hit its numbers and the demo got applause.\n\nThen reality: ${a.toLowerCase()}. The model was fine — the workflow around it never changed, and no one owned the output when it slipped. So the project sat in “almost shipped” for ten weeks.\n\nThe fix wasn’t a better model. It was naming an owner, redrawing one workflow, and building a loop so the system improved every week instead of decaying.\n\nThat’s the difference between AI that demos and AI that operates.\n\nHave you watched a project stall in exactly this place?`,
    history: [],
  };
  const v3: Version = {
    label: 'C', approved: false, editor: 'Pragma AI', ts: NOW(),
    hook: `3 things most teams get wrong about ${t}:`,
    method: 'Proof & specificity — numbered claims',
    methodNote: 'Each item pairs a claim with a concrete test, so it reads as a usable checklist rather than opinion. Numbered structure is easy to skim and save.',
    why: 'Listicles are highly shareable and saveable; the diagnostic framing prompts self-assessment, and the final question converts that into engagement.',
    body: `Most of the failure modes aren’t technical. They’re these:\n\n1. Treating it as a tool, not a workflow change. If the handoffs look identical afterward, nothing actually moved.\n\n2. No owner for the output. “The team” owning it means no one does — and no one will ship what they can’t answer for.\n\n3. No loop. If it can’t get better next quarter without a new project, you bought a feature, not a system.\n\nThe teams that win on ${t} fix all three before they scale. Most fix none.\n\nWhich of the three is hardest where you work?`,
    history: [],
  };
  return [v1, v2, v3];
}

export function regen(post: Post, vi: number, count: number) {
  const t = post.topic.toLowerCase();
  const banks = [
    [{
      hook: `The real bottleneck on ${t} isn’t the model — it’s the org chart.`,
      body: `We keep tuning models when the thing that’s actually stuck is accountability.\n\n${post.angle}. Until one person owns the output and can change the workflow, ${t} stays a pilot.\n\nName the owner first. The rest is engineering.\n\nWho owns it in your shop?`
    },
    {
      hook: `${cap(t)}: a feature in the demo, an operating change in production.`,
      body: `The demo is easy. Production is where ${t} either earns its place or becomes decoration.\n\n${post.angle}. The teams that win wire it into the workflow and put a loop behind it.\n\nWhat would change the day it ships for you?`
    }],
    [{
      hook: `A $4M initiative on ${t} died in a Slack thread. Here’s the line that killed it.`,
      body: `“Who owns this when it’s wrong?”\n\nNo answer. ${post.angle}. The model was never the issue — the missing owner was.\n\nThey shipped six weeks later, once a single name was on the decision.\n\nSeen this exact stall?`
    },
    {
      hook: `The week after the demo is where ${t} actually gets decided.`,
      body: `Applause on Friday. Silence by Wednesday. ${post.angle}.\n\nThe teams that make ${t} stick treat the week after the demo as the real start — owner, workflow, loop.\n\nWhat happens in your org the week after?`
    }],
    [{
      hook: `Stop scaling ${t} until you can answer these in one sentence each.`,
      body: `1. What workflow changed?\n2. Who owns the output?\n3. How does it improve without a new project?\n\n${post.angle}. The 6% answer all three. The 91% can’t answer the first.\n\nWhich one is hardest for you?`
    },
    {
      hook: `${cap(t)}, minus the hype: three tests it has to pass.`,
      body: `Ownership. Workflow. Loop.\n\nIf ${t} fails any one of them, it won’t reach production — no matter how good the model looks. ${post.angle}.\n\nWhich test is your team failing right now?`
    }],
  ];
  const set = banks[vi % 3];
  return set[count % set.length];
}

// ===== topic briefs =====
// Plain-language explainers for the topics in active rotation this week.
// Keyed by post id (see the rows order in makePosts).
export interface TopicBrief {
  summary: string;
  why: string;
  points: string[];
}

export const TOPIC_BRIEFS: Record<string, TopicBrief> = {
  p15: {
    summary: 'Most enterprise AI does not stall on accuracy — it stalls because no single person owns the output once it reaches production.',
    why: 'Until a named owner can answer for what the model produces, no one will stake a real workflow on it, so pilots never ship.',
    points: [
      'Name one human owner for every AI-driven decision, with authority to change the workflow when the model slips.',
      '“The team owns it” means no one does — accountability has to land on a person.',
      'This is an org-chart problem, not a model problem. Fix it before scaling.',
    ],
  },
  p16: {
    summary: 'Production AI quietly degrades over time. A retraining loop keeps it improving on a cadence instead of rotting after launch.',
    why: 'A model that was excellent at launch drifts as the world changes. Without a loop, you are shipping decay you cannot see.',
    points: [
      'Treat retraining as a standing operating routine, not a one-off project.',
      'Monitor live inputs and outputs — not just the accuracy you measured on day one.',
      'Improvement should never require a fresh procurement cycle.',
    ],
  },
  p17: {
    summary: 'AI-assisted (“vibe”) coding can be fast and production-grade at the same time — speed and rigor are not opposites.',
    why: 'Velocity without tests, review, and ownership creates fragile systems. The goal is to keep the guardrails while moving quickly.',
    points: [
      'Keep tests, types, and code review even when generating fast.',
      'Treat AI output as a draft to verify, not a finished artifact.',
      'Velocity only counts if the result survives production.',
    ],
  },
  p18: {
    summary: 'AI is reshaping business-process outsourcing by replacing high-volume work unit by unit, not all at once.',
    why: 'The economics shift from headcount to per-unit output, which changes how the work is priced, scaled, and governed.',
    points: [
      'Measure per-unit output against headcount, not seats filled.',
      'Migrate volume work incrementally, each slice with an owner and an exception path.',
      'Quality control and governance decide whether it actually scales.',
    ],
  },
  p19: {
    summary: 'The real work starts after the demo: monitoring, retraining, and keeping scope under control.',
    why: 'Demos prove capability. Governance is what keeps AI accountable, safe, and improving once it is live.',
    points: [
      'Define a failure path before launch — not after the first incident.',
      'Control scope creep: every new use of the model needs its own owner.',
      'Governance = monitoring + retraining + clear accountability.',
    ],
  },
};

// Posts that make up "this week's focus" — the freshly refreshed topics that fall in the
// current week (Monday–Sunday containing today), in date order.
export function weekFocus(posts: Post[]): Post[] {
  const now = new Date();
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);
  return posts
    .filter((p) => p.change)
    .filter((p) => { const d = new Date(p.date + 'T00:00:00'); return d >= monday && d <= sunday; })
    .sort((a, b) => a.date.localeCompare(b.date));
}
