# osadef-api-asesores

REST API for an AI-powered advisor assistant — part of the OSADEF multi-platform system (private NDA project).

## What it does

Exposes read-only medical authorization data consumed by an **ElevenLabs Conversational AI** agent via **n8n** workflows. Advisors interact with a chat widget embedded in the portal; the agent queries this API in real time to answer questions about member authorizations and chronic treatment records.

## Stack

| Layer | Technology |
|---|---|
| Framework | Fastify v5 + TypeScript v5 |
| ORM | Prisma v6 (read-only, legacy MySQL) |
| AI / Voice | ElevenLabs Conversational AI (chat mode) |
| Automation | n8n (webhook → API → formatted response) |
| Auth | Static API Key (header-based) |
| Docs | OpenAPI / Swagger UI (`/documentation`) |
| Process | systemd + Nginx + Let's Encrypt |
| Tests | Playwright (HTTP integration tests) |

## Architecture

```
Portal widget (ElevenLabs)
        │
        ▼ POST /webhook/asesores-chat
    n8n workflow
        │
        ▼ GET /autorizaciones, /cronicidad, /afiliados/exists
    osadef-api-asesores  ← this repo
        │
        ▼ $queryRaw (read-only)
    MySQL legacy DB
```

## Key design decisions

- **Read-only by design** — never writes to the legacy database
- **Lazy-loading docs** — Swagger UI available in all environments without cluttering logs
- **Health-data safety** — Pino set to `warn` in production; no PII in logs
- **Context isolation** — separate API Key from the sibling `osadef-api` (providers), same stack conventions

## Related repos (private, NDA)

| Repo | Description |
|---|---|
| `osadef-api` | Provider portal API (invoices, payments) |
| `mcp-osadef` | MCP server for CustomGPT integration |
| `osadef-portal-prestadores` | Frontend portal (Next.js) |

## Documentation

Full developer manual, test cases, widget install guide, ElevenLabs setup, and n8n workflow export are in [`/docs`](./docs).

---

*Part of OSADEF — a multi-platform system built with Fastify, Next.js, React Native, and AI integrations.*
