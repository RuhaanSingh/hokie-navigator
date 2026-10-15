# Hokie Navigator — VT Agent Network prototype

*Tell your story once. The AI coordinates; people decide.*

This is a working prototype for the PwC × PSE Hokie Navigator case competition. It covers a student's personal agent, an agent gateway, seven simulated office agents, staff approval, a consent ledger, confidence scoring, and a full audit log. Six office agents answer informational (L0) questions from real snapshots of their official sites: **Financial Aid** (finaid.vt.edu), **Registrar**, **Bursar**, **Housing**, **Dean of Students**, and **International Student Services** (international.vt.edu). Everything else uses deterministic mock data for a fictional student, **John Doe**.

## Run it (presenting laptop)

```bash
npm install
cp .env.example .env.local        # then paste your Groq key into GROQ_API_KEY
npm run build && npm start        # http://localhost:3000. Present from the production build.
```

- **No key or no Wi-Fi?** The app still works. Set `DEMO_MODE=scripted`, or switch the mode in Demo Controls. Scripted mode runs the same gateway and case pipeline, so the UI behaves the same way.
- **Hybrid (default):** the app calls Groq. If a call errors, times out (6 s), or returns malformed tool calls, it falls back to the scripted path without showing an error, and skips the LLM for the next 60 s so the demo never waits on repeated timeouts.
- State lives in server memory. A restart resets it, and so does **Reset demo state**. Don't deploy this to serverless hosting.
- The Groq key is read server-side only (`src/agents/personal-agent.ts`) and never reaches the browser.

## Presenter controls

Press **⌘/Ctrl + Shift + D** on any page, or open **System → Demo controls**. From there you can:

- Reset the demo
- Take any office agent offline, or add latency to it
- Fill or reopen a course section, including a variant where Plan B breaks a limit
- Trigger the Bursar hold alert
- Switch between Live, Hybrid, and Scripted modes
- Show or hide the "simulated" badges

## Demo script (≈ 6 minutes)

Use two windows: **Student** (`/assistant`) and **Staff** (`/staff`). Keep a third tab on `/system` if you want the diagram to light up.

**Shortcut:** on the Navigator page, the **Demo prompts** button above the message box lists every prompt below, grouped by scenario. One click sends it.

1. **Scenario A, Tell Your Story Once (hero, under 90 s).** Navigator → *Tell your story*.
   - The agent responds with empathy and shows Dean of Students and Cook Counseling contacts. It asks one question. Tap **Stay enrolled if I can**.
   - Case #NAV-2041 opens. The gateway checks consent, and 5 office agents run in parallel.
   - The consequence engine compares options A/B/C. **Option A breaks 2 office rules**, and **Option B has the fewest consequences**. Hover any cell to see the rule it cites.
   - Pick **B**, then **Send to Dean of Students for approval**.
   - In the staff window, the packet appears with a red dot. It shows the goal, options, office responses, conflicts, the 4 confidence checks, and why the agent stopped. Click **Approve**.
   - Back in the student window, execution runs step by step, each step with a level pill. You can view the drafted instructor notices. It ends with a "close the loop" summary and an audit trail link.
1b. **One-prompt Dean case (fastest way to show staff approval).** Navigator → *Request an incomplete* (or type the prompt below). The agent shows human-support contacts, checks 5 offices in parallel, and sends Option B straight to the Dean of Students queue in one turn (about 4 s). Open `/staff` in the second window and approve.
   > My dad is having emergency surgery overseas and I need to fly home for two weeks. I'd like to take Incompletes in CS 3214 and STAT 4705 instead of dropping them. Can you send that to the Dean of Students for approval?

   Variants: name a *medical withdrawal* (Option C) or *dropping two courses* (Option A, which shows its 2 rule conflicts in the packet).
2. **Scenario B, real office data.** Each question is routed to the office that owns it, answered only from that office's site, with source chips:
   - ISS: *"How many hours can I work on campus as an F-1 student?"* or *"What's happening with duration of status?"*
   - Bursar: *"When is spring tuition due?"*
   - Registrar: *"How do I request my transcript?"* or *"When are final grades available?"*
   - Housing: *"How do I get out of my housing contract?"*
   - Dean of Students: *"What is the student emergency fund?"*

   Financial Aid: Ask *"What is SAP and how do I appeal?"*. You get source chips to finaid.vt.edu and a High confidence chip. Then ask *"Can I get a refund on my parking permit?"*. It routes to the Bursar, confidence is Low, the agent refuses to guess, and it offers to route the question to a Bursar staff member (it shows up under Staff → Other offices).
3. **Scenario C, outage.** Demo controls → Financial Aid **offline**, then re-run A. You'll see `Financial Aid agent: unavailable · health check failed`, scholarship shown as *Pending human review*, Medium confidence, "Nothing irreversible executed", the case routed to the counselor queue, and the Dean of Students asked to protect Friday's deadline. The System page shows the office as Down.
4. **Scenario D, pre-approved plan (L3).** Open Plans, then Demo controls → **Fill** CS 3214-1. Within about 2 s the watchdog enrolls John in CS 3214-2 automatically and shows a toast. Reset, then use **Fill CS 3214-1 · variant: Plan B breaks a limit**. The agent **stops and asks** instead of acting.
5. **Scenario E, refusals and wellbeing.**
   - *"Should I stop taking my medication?"* gets no medical advice and links to health and counseling.
   - *"Can you show me my roommate's grades?"* is blocked by the gateway and logged.
   - Any self-harm language triggers the 988, Cook Counseling, and Dean of Students cards. No tools run.
6. **Scenario F, consent.** Privacy → turn **Housing** off, then re-run A. Housing shows "Not contacted: consent revoked by student", and the housing row reads "Unknown — consent revoked".
7. **Scenario G, hold (optional).** Demo controls → Trigger hold alert. On the dashboard, tap **Resolve**. The Bursar, Financial Aid, and Registrar agents find the cause, and the student approves an L2 hold review.

## Architecture (mirrors the deck)

```
src/agents/
  personal-agent.ts      orchestrator: intent, Groq tool loop, hybrid fallback, prose
  case-pipeline.ts       deterministic case: fan-out, options, staff approval, serialized execution
  gateway.ts             the only importer of office agents: consent, allow-list, need-to-know, latency, audit, trace
  consequence-engine.ts  compares options across office rules, counts conflicts, never chooses
  confidence.ts          High / Medium / Low from 4 checks
  watchdog.ts            seat and hold monitoring; L3 only inside a signed plan
  offices/*.ts           7 simulated office agents (deterministic)
  kb/                    per-office site snapshots (markdown + BM25 index) and keyword/retrieval routing
src/lib/store.ts         in-memory store shared by all windows
src/data/                fictional persona, office records, mock policies
```

The autonomy ladder is enforced in code and shown on every action:

| Level | Meaning | Who approves |
|---|---|---|
| **L0** | Inform | Runs automatically |
| **L1** | Draft | Runs automatically, never submitted |
| **L2** | Act with confirmation | The student taps Approve |
| **L3** | Act within a pre-approved plan | Only within a plan the student signed |
| **Staff** | Withdrawals, incompletes, reduced loads, aid, housing, visa, overrides | Always a staff member |

## Data and accuracy

- `scripts/scrape-finaid.ts` and `scripts/scrape-offices.ts` were run once (Oct 2026). Their output (33 Financial Aid pages plus 44 pages from the Registrar, Bursar, Housing, Dean of Students, and ISS) is committed in `src/agents/kb/<office>/`, and nothing hits the network at runtime. `finaid/seed.md` holds the verified fallback facts.
- In scripted/offline mode, the main demo questions use canned answers whose every sentence comes from those pages. Other questions quote the most relevant sentences directly.
- Cook Counseling Center (540-231-6557) and Dean of Students (540-231-3787) contacts were checked against ucc.vt.edu and dos.vt.edu.
- All student records, dollar amounts for the persona, policies marked "(mock)", and deadlines are fictional. Office agents are simulated, and the UI says so.
- There are no VT logos. The wordmark and compass glyph are original.
