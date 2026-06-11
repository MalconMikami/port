# Why Port?

## The Problem

Non-technical people are using AI to create sites, landing pages, dashboards, CRUDs, prototypes, and internal tools at an accelerating pace. Claude, ChatGPT, Cursor, Bolt — the tools are everywhere, and they generate working code in seconds.

But then comes the question: **where do you put it?**

The site works perfectly on `http://localhost:3000`. It was built by someone on the marketing team, or the innovation lab, or a summer intern. They don't know what a VPC is. They don't have AWS credentials. They shouldn't need to learn Kubernetes to publish a landing page.

Meanwhile, the company's infrastructure — the big AWS, GCP, or Azure account — is managed by a platform team. Their focus is on the main applications: production services, SLAs, compliance, cost optimization. It doesn't make sense to throw AI-generated experiments into the same deployment pipeline. These sites are:

- **Lighter** — a few HTML files and some JS, not a microservice
- **More ephemeral** — may live for a week or a year, always disposable
- **Created by non-dev roles** — product, marketing, operations, design
- **Different risk profile** — worth isolating from core infrastructure

The result is a **dead zone**: sites that work but never see the light of day. They live on someone's laptop, shared via screenshots or fragile tunnels, until the laptop is replaced and they're gone.

### For AI and Innovation Teams

Teams that use AI to generate MVPs and prototypes face a specific bottleneck: the AI generates code that **works**, but there's no controlled environment to run it with:

- Isolation between projects
- Governance over what is running
- Ability to update without a rebuild
- Security for sensitive data
- Visibility for the platform team

---

## The Solution

Port solves this with a different model:

1. **Single upload** — ZIP with `index.html` + assets. No build, no CI, no pipeline.
2. **Everything included** — Every deploy automatically gets: static serving, PostgreSQL database, blob storage, AI endpoint, server-side functions, WebSocket, and a client SDK.
3. **Isolation by design** — Each site runs in its own database schema, its own directory, its own worker thread. One site cannot access another's data.
4. **Governance** — Public config (visible to frontend) vs private config (backend only). Admin dashboard to manage all sites.
5. **No infrastructure knowledge needed** — Simple CLI (`port deploy .`) or upload via UI. Docker compose to run the whole platform.

### Who is Port for?

| Profile | How they use it |
|---------|-----------------|
| **Innovation Team** | Generate prototypes with AI, deploy in 10s, share link with stakeholders |
| **Digital Agency** | Host client landing pages with built-in server-side functions and database |
| **Internal Tools** | Create dashboards and CRUDs without depending on DevOps |
| **Education** | Students generate sites with AI and publish in a controlled environment |
| **Early-stage Startup** | MVP running in minutes with DB + AI + storage without paying for multiple services |

---

## What Port is NOT

- **Not Vercel/Netlify** — No build step, no CI, no asset optimization. You upload a finished site.
- **Not a CMS** — No visual editor, no content management. You manage via code + config.
- **Not a full BaaS** — Focuses on the essentials: DB, storage, AI, functions. No complex auth, no queues, no distributed cache.
- **Not for every application** — Static sites with lightweight backend. GPU workloads, heavy streaming, or extreme low-latency have limits.

Port is **deliberately simple**. It solves one specific problem well: giving AI-generated sites a safe, governed home.