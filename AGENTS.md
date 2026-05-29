# AGENTS.md — osadef-api-asesores

## Project Goal
API for advisors (asesores) to query medical data (autorizaciones, cronicidad) from a legacy MySQL DB, consumed by n8n → ElevenLabs Conversational AI widget embedded in the advisors portal.

## Stack
Fastify + Prisma + TypeScript strict + Playwright tests + PM2 on port 3003.

## Current State (May 28, 2026)

### Endpoints
| Endpoint | Description |
|---|---|
| `GET /health` | Health check (no auth) |
| `GET /autorizaciones?cuil=&nombre=&desde=&hasta=` | Unified: meds + practices via UNION ALL |
| `GET /cronicidad?cuil=&monodroga=&vence_en_dias=` | Chronic treatments (meds only) |
| `GET /afiliados/exists?cuil=` | Check if CUIL exists |

### Key Design Decisions
- **Unified `/autorizaciones`**: UNION ALL of `llx_medica`, `llx_medica_familiar`, `llx_autorizacion_prestacion`, `llx_autorizacion_prestacion_familiar`. Returns `tipo: "medicamento"|"prestacion"` discriminator.
- **Field names**: `codigo` (was codmonodroga), `nombre` (was monodroga), `cobertura` (was idporcentaje).
- **CONVERT(... USING utf8mb4)** on practice columns fixes collation mismatch for UNION.
- **estadotra NOT IN (0)** for practices (vs =9 for medications).
- n8n Format Response separates meds/practicas by `tipo`. Agent LLM filters by `tipo` based on user query.

### Data
- `27248817939`: 5 meds + 197 practices (best for practice testing)
- `20120667468`: 6 meds + 0 practices
- `27290758187`: 92 meds + many practices + 22 chronic

### System Prompt (`docs/system-prompt.txt`)
Built following ElevenLabs prompting guide best practices:
- `# Personality`, `# Goal`, `# Tone`, `# Tools`, `# Guardrails`, `# Examples` sections
- Practice classification: `[Laboratorio]`, `[Imágenes]`, `[Consulta]`, `[Procedimiento]`, `[Kinesiología]`
- Pagination: show first 5 when >10 results, ask for more
- Filtering: only show what user asked for (meds vs practices)
- Bullet lists enforced for multi-item responses
- "This step is important" emphasis on critical rules
- Error handling for tool failures

### ElevenLabs Agent
- renderMarkdown: true must be enabled in Widget settings for markdown to render
- System prompt in `docs/system-prompt.txt` (paste into ElevenLabs dashboard)
- Tool config in `docs/elevenlabs-tool-config.json` (parameter `nombre`, not `monodroga`)

### n8n
- Workflow export: `n8n-workflow.json` (must be re-imported after changes)
- Webhook: `/webhook/asesores-chat`
- Nodes: Webhook → Parse Intent → API Request → Format Response → Responder
- Format Response uses `item.nombre`, `item.codigo`, `item.cobertura`

### Git
- Remote: `https://github.com/juandelossantos/osadef-api-asesores.git`
- Push works via `git config credential.helper store` (token stored)
- Latest commit: `b262806`

## Critical Rules

- **NUNCA ejecutar `prisma migrate`** — BD es legacy y compartida. Solo `prisma generate` y `prisma db pull`.
- **NUNCA modificar la BD** sin verificar dependencias de otros sistemas.
- **NO implementar endpoints de escritura** (POST/PUT/DELETE). SOLO LECTURA.
- **Sanitizar logs**: nunca loguear CUILs ni diagnósticos en producción.
- **Siempre usar `?` placeholders** en `$queryRawUnsafe`. NUNCA concatenar strings.

## Deployment
```bash
cd /home/osadef-api-asesores
git pull
npm ci
npx prisma generate
npm run build
pm2 restart osadef-api-asesores
```

### Verification
```bash
curl -s http://127.0.0.1:3003/health
```

### PM2
```bash
pm2 status | restart | stop | start osadef-api-asesores
```
Config: `ecosystem.config.cjs` (autorestart, max 10 restarts, production mode).

## Server Ecosystem
| Service | Port | Type |
|---|---|---|
| osadef-portal-prestadores | 3000 | Docker |
| osadef-api | 3001 | PM2 (prestadores API) |
| mcp-osadef | 3002 | systemd |
| **osadef-api-asesores** | **3003** | **PM2** |
| n8n | 5678 | Docker |

## Architecture Flow
Portal (asesor) → ElevenLabs widget → tool webhook → n8n → osadef-api-asesores → MySQL

## Prisma UNION Bug
Complex UNION with aggregates fails through Prisma connector. `/autorizaciones` uses UNION ALL (no aggregates) so it works. `/cronicidad` splits UNION into two `$queryRaw` calls merged in JS.

## Known Issues
- `health.environment` test expects "development" but PM2 runs "production" (pre-existing)
- ElevenLabs quota may be exhausted (needs plan upgrade)
- Widget embed ready but not deployed to portal (waiting for webmaster)

## Test Commands
```bash
npm test                          # Playwright tests
NODE_ENV=development npm test     # Force dev mode
```
