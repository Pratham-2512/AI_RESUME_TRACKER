# 06 — UI Wireframes

App shell: left sidebar nav + top bar (search, copilot toggle, avatar). All screens use
shadcn/ui. Wireframes below are layout intent, not pixel specs.

## Shell

```
┌────────────┬───────────────────────────────────────────────┐
│ AI CAREER  │  [ search jobs … ]            🔔   💬   (avatar)│
│  OS        ├───────────────────────────────────────────────┤
│            │                                                 │
│ ▸ Dashboard│              <page content>                     │
│ ▸ Profile  │                                                 │
│ ▸ Resumes  │                                                 │
│ ▸ Jobs     │                                                 │
│ ▸ Matches  │                                                 │
│ ▸ Skills   │                                                 │
│ ▸ Documents│                                                 │
│ ▸ LinkedIn │                                                 │
│ ▸ Apps     │                                                 │
│ ▸ Copilot  │                                                 │
└────────────┴───────────────────────────────────────────────┘
```

## Dashboard (Module 11)

```
┌ Total Apps ┐ ┌ Interview % ┐ ┌ Offer % ┐ ┌ Avg Match ┐
│    42      │ │    19%      │ │   5%    │ │   78      │
└────────────┘ └─────────────┘ └─────────┘ └───────────┘
┌─ Match score trend ───────────┐ ┌─ Application funnel ──────┐
│  ▁▂▃▅▆▇ (line)                 │ │ Saved ███ Applied ██ ...  │
└────────────────────────────────┘ └───────────────────────────┘
┌─ Top skills (you) ─┐ ┌─ Missing skills (market) ─┐ ┌─ Learning progress ─┐
│ Python SQL React   │ │ Docker AWS FastAPI        │ │ Week 2 of 4  ▓▓░░    │
└────────────────────┘ └───────────────────────────┘ └─────────────────────┘
```

## Profile (Module 1)

```
[ Personal ] [ Education ] [ Experience ] [ Skills ] [ Projects ] [ Certs ] [ Goals ]
┌─ Skills ───────────────────────────────────────────────┐
│ Python  ●●●●○  5y   [x]      [+ Add skill]              │
│ SQL     ●●●●●  4y   [x]                                 │
└─────────────────────────────────────────────────────────┘
                                       [ Save ] → re-embeds profile
```

## Resume detail (Module 2)

```
┌─ resume.pdf ──────────────┐ ┌─ ATS Analysis ───────────────────────┐
│ (preview / parsed text)   │ │  Before ⬤ 61      After ⬤ 88          │
│                           │ │  ─────────────────────────────────    │
│                           │ │  Formatting   ████████░░  82          │
│                           │ │  Keywords     █████░░░░░  54          │
│                           │ │  Impact       ███████░░░  71          │
│                           │ │  Missing: Docker, AWS, FastAPI         │
│                           │ │  Weak: Summary too generic → [fix]     │
│                           │ │  [ Rewrite for: ATS ▾ ]  → stream      │
└───────────────────────────┘ └────────────────────────────────────────┘
target ▾ = ATS | AI Engineer | Data Analyst | Software Dev | ML Engineer
```

## Jobs discovery (Module 3)

```
[ q ] [ Type ▾ ] [ Mode ▾ ] [ Salary ▾ ] [ Sort: Match ▾ ]
┌──────────────────────────────────────────────────────────┐
│ Sr Data Analyst · Acme · Remote · $95–120k   Match 82% ⭐ │
│ skills: SQL, Python, Tableau           [ Save ] [ View ]  │
├──────────────────────────────────────────────────────────┤
│ ML Engineer · Globex · Hybrid · $130–160k    Match 74%    │
└──────────────────────────────────────────────────────────┘
```

## Match breakdown (Module 4) — job detail right rail

```
┌─ Match 82% ────────────────────────┐
│ Strengths:  SQL · Python · AI tools │
│ Missing:    Docker · AWS · FastAPI  │
│ Weak areas: cloud deployment        │
│ "Strong analytical fit; gap is …"   │
│ [ Tailor resume ] [ Cover letter ]  │
│ [ Start application → ]              │
└─────────────────────────────────────┘
```

## Skills (Module 5)

```
┌─ Most requested (your matches) ─┐  ┌─ 4-Week Roadmap (ROI-ranked) ──────┐
│ SQL 40 · Python 38 · AWS 31 …   │  │ W1 Docker basics  ▸ resources       │
└─────────────────────────────────┘  │ W2 AWS core       ▸ resources       │
┌─ Your gaps ─────────────────────┐  │ W3 FastAPI + REST ▸ resources       │
│ Docker · AWS · FastAPI · k8s    │  │ W4 Deploy project ▸ checkpoint      │
└─────────────────────────────────┘  └─────────────────────────────────────┘
```

## Documents (Module 6) / LinkedIn (Module 9)

```
[ Type: Cover letter ▾ ] [ Job: Sr Analyst @ Acme ▾ ] [ Tone: Confident ▾ ] [ Generate ]
┌─ Draft (streaming, editable) ───────────────────────────┐
│ Dear Hiring Manager, …                                   │
└──────────────────────────────────────────────────────────┘
                                   [ Copy ] [ Save ] [ Regenerate ]
```

## Interview prep (Module 7)

```
[ Technical ] [ HR ] [ Behavioral ] [ Project ]      difficulty ▾
┌──────────────────────────────────────────────────────────┐
│ Q: Explain a time you optimized a slow SQL query. (Med)   │
│    confidence ●●●●○                                       │
│    ▸ Suggested answer (STAR, from your experience)        │
└──────────────────────────────────────────────────────────┘
```

## Applications tracker (Module 8) — kanban

```
┌ Saved ┐ ┌ Applied ┐ ┌ Interview ┐ ┌ Offer ┐ ┌ Rejected ┐
│ Acme  │ │ Globex  │ │ Initech   │ │       │ │ Hooli    │
│ +3    │ │ +5      │ │ +1        │ │       │ │ +2       │
└───────┘ └─────────┘ └───────────┘ └───────┘ └──────────┘
drag card → status change (logs application_event)
```

## Semi-auto apply wizard (Module 10)

```
Step 1 Analyze ✓   Step 2 Optimize résumé ✓   Step 3 Cover letter ✓
Step 4 Recruiter msg ✓   Step 5 PREVIEW   Step 6 APPROVAL   Step 7 Assist fill   Step 8 Submit
┌─ Preview everything ─────────────────────────────────────┐
│ Résumé v3 (ATS 88) · Cover letter · Recruiter message    │
│                                                          │
│  ⚠ Nothing is submitted automatically.                    │
│  [ ✗ Edit ]                       [ ✓ Approve & continue ]│  ← sets approved_at
└──────────────────────────────────────────────────────────┘
after approval: [ Open application page ] + browser assist fills fields;
                YOU click submit, then [ I submitted it ] → status=applied
```

## Copilot (Module 12)

```
┌──────────────────────────────────────────────────────────┐
│ You: Why am I getting rejected?                           │
│ AI:  Looking at your 8 rejections… (streaming)            │
│      • 5 roles required AWS (you're missing it)           │
│      • résumé impact score is low …   [Tailor résumé]     │
├──────────────────────────────────────────────────────────┤
│ [ Which jobs fit me? ] [ Increase salary? ] [ Learn next?]│  ← suggested prompts
│ [ ask anything …                                  ] [→]   │
└──────────────────────────────────────────────────────────┘
```
