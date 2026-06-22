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
}

// date, topic, angle, format, status, priority, change
const rows: [string, string, string, string, string, string, string | null][] = [
  ['2026-06-01', 'The AI execution gap', 'Why 91% adopt AI but only 6% see ROI', 'opinion', 'Published', 'High', null],
  ['2026-06-02', 'Pilots that never ship', 'The notebook-to-production death valley', 'educational', 'Published', 'Medium', null],
  ['2026-06-03', 'Synthetic workforce economics', 'Per-unit output vs. headcount', 'technical', 'Published', 'High', null],
  ['2026-06-04', 'From advice to operation', 'Why slide decks don’t move the P&L', 'opinion', 'Published', 'Medium', null],
  ['2026-06-05', 'The $600B ROI gap', 'Capital deployed vs. outcome realized', 'trend', 'Published', 'Low', null],
  ['2026-06-08', 'Forward-deployed engineers', 'The consulting model that actually ships', 'trend', 'Published', 'High', null],
  ['2026-06-09', 'Outcome-based pricing for AI', 'Getting paid for results, not hours', 'opinion', 'Published', 'Medium', null],
  ['2026-06-10', 'Legacy ERP, rebuilt AI-native', 'A 30-year system in 14 weeks', 'case study', 'Approved', 'High', null],
  ['2026-06-11', 'Who owns the wrong answer?', 'Accountability when the model fails', 'opinion', 'Approved', 'Medium', null],
  ['2026-06-12', 'Executive AI literacy', 'What leaders must understand to govern', 'educational', 'Published', 'Low', null],
  ['2026-06-15', 'Agents in real workflows', 'Beyond the chatbot demo', 'case study', 'Approved', 'High', null],
  ['2026-06-16', 'Measuring AI on the P&L', 'The only metric that survives the board', 'technical', 'Approved', 'Medium', null],
  ['2026-06-17', 'Model drift & compounding', 'Why good AI degrades — and how it shouldn’t', 'technical', 'In Review', 'High', null],
  ['2026-06-18', 'Build vs. buy for AI capability', 'When to own the model layer', 'educational', 'In Review', 'Medium', null],
  ['2026-06-19', 'LatAm: the unclaimed market', 'Where forward-deployed AI is wide open', 'trend', 'Draft', 'Low', null],
  // --- this week (June 22) : freshly refreshed ---
  ['2026-06-22', 'The accountability gap', 'No one owns AI after the demo ends', 'opinion', 'Approved', 'High', 'updated'],
  ['2026-06-23', 'Retraining loops that don’t rot', 'Operating AI so it improves quarterly', 'technical', 'Draft', 'High', 'new'],
  ['2026-06-24', 'Vibe-coding, production-grade', 'Fast and rigorous are not opposites', 'opinion', 'Draft', 'Medium', 'new'],
  ['2026-06-25', 'The synthetic BPO shift', 'Replacing volume work, unit by unit', 'case study', 'Approved', 'High', 'updated'],
  ['2026-06-26', 'Governance after the demo', 'Monitoring, retraining, scope control', 'educational', 'Draft', 'Medium', 'new'],
  ['2026-06-29', 'AI capability you actually own', 'The people layer of the operating model', 'educational', 'Approved', 'Low', null],
  ['2026-06-30', 'The week after the demo', 'What separates the 6% from everyone else', 'opinion', 'Draft', 'Medium', 'new'],
];

export function makePosts(): Post[] {
  return rows.map((r, i) => ({
    id: 'p' + i, date: r[0], topic: r[1], angle: r[2], format: r[3], status: r[4], priority: r[5], change: r[6],
    scheduledFor: null, versions: null, activeVer: 0,
  }));
}

export function NOW() { return new Date().toISOString(); }

export function rel(ts: string | null | undefined) {
  if (!ts) return 'just now';
  const d = new Date(ts), now = new Date('2026-06-22T09:00:00'); let s = Math.floor((+now - +d) / 1000);
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
