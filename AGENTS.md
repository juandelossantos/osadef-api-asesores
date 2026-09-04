# AGENTS.md — osadef-api-asesores

## Project Goal
API for advisors (asesores) to query medical data (autorizaciones, cronicidad) from a legacy MySQL DB, consumed by n8n → ElevenLabs Conversational AI widget embedded in the advisors portal.

## Stack
Fastify + Prisma + TypeScript strict + Playwright tests + PM2 on port 3003.

## Current State (May 29, 2026)

### Endpoints
| Endpoint | Description |
|---|---|
| `GET /health` | Health check (no auth) |
| `GET /autorizaciones?cuil=&nombre=&desde=&hasta=` | Unified: meds + practices via UNION ALL |
| `GET /cronicidad?cuil=&monodroga=&vence_en_dias=` | Chronic treatments (meds only) |
| `GET /afiliados/exists?cuil=&include=basico,cud` | Check if CUIL exists + optional affiliate data + CUD info |

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
- **Acciones soportadas:** `autorizaciones`, `cronicidad`, `exists`, `cud`, `discapacidad`, `certificado`

### Git
- Remote: `https://github.com/juandelossantos/osadef-api-asesores.git`
- Push works via `git config credential.helper store` (token stored)
- Latest commit: `f6b17de`

## Auth — multi-key (agregado 04/09/2026)

`auth-guard.ts` ya no compara contra una única key estática — busca el
Bearer token en `config.apiKeys`, un mapa `key→etiqueta` armado en
`src/config/env.ts` (mismo patrón que ya usa `cartilla-adef`,
`src/config/env.js`). `API_KEY_N8N_ASESORES` (nombre histórico, la que ya
tiene cargada el workflow real de n8n/ElevenLabs) sigue funcionando
exactamente igual — se registra en el mapa con la etiqueta fija `"n8n"`.

**Agregar un consumidor nuevo:**
1. Generar la key: `openssl rand -hex 32`.
2. Agregar `API_KEY_ASESORES_<ETIQUETA>=<key>` al `.env` (nunca al repo —
   `.env` está en `.gitignore`).
3. Reiniciar el servicio (`pm2 restart osadef-api-asesores` en prod, o
   simplemente reiniciar el proceso en dev).
4. Compartir la key por un canal seguro, nunca texto plano en chat/email.

No hace falta tocar código — el mapa se arma solo leyendo variables de
entorno al arrancar. `request.authUser.label` queda disponible para
logs/rate-limit por identidad del consumidor en vez de por IP.

**Nota de seguridad:** `API_KEY_N8N_ASESORES` está confirmada comprometida
sin rotar (ver `mcp-osadef/docs/INFRAESTRUCTURA-Y-AUDITORIA.md` §H2 — el
server tuvo un compromiso real con ~4,5 meses de acceso root, y ese
secreto nunca se rotó desde entonces). El consumidor `widget-chat-adef`
usa una key propia y nueva (`API_KEY_ASESORES_WIDGET_CHAT`) precisamente
para no depender de la comprometida — evaluar rotar la de n8n cuando se
coordine con quien administra el server `prestadores`.

## Critical Rules

- **NUNCA ejecutar `prisma migrate`** — BD es legacy y compartida. Solo `prisma generate` y `prisma db pull`.
- **NUNCA modificar la BD** sin verificar dependencias de otros sistemas.
- **NO implementar endpoints de escritura** (POST/PUT/DELETE). SOLO LECTURA.
- **Sanitizar logs**: nunca loguear CUILs ni diagnósticos en producción.
- **Siempre usar `?` placeholders** en `$queryRawUnsafe`. NUNCA concatenar strings.
- **Host de BD de producción: `192.168.0.27:3306`** (IP interna de Huawei Cloud; la pública equivalente es `159.138.116.230`). Esta API corre en el host y llega a la BD por la IP interna. Ver `/home/AGENTS.md`.

## Reglas de despliegue seguro

> **Este servidor ES producción. No hay staging.** Reglas completas en `/home/AGENTS.md`.

- **NUNCA `docker rm -f $(docker ps -aq)`**, `docker system prune` ni `docker volume prune` — mata el portal, n8n y elimina el volumen `n8n_data` (workflows + credenciales). Eliminar contenedores SOLO por nombre específico.
- **NUNCA `docker compose down -v`** en ningún repo — el flag `-v` elimina volúmenes.
- **Cada deploy es independiente.** Al deployar esta API (PM2), **no tocar** el portal (Docker), n8n (Docker), mcp-osadef (systemd) ni osadef-api (PM2).
- **NUNCA reiniciar Docker (`systemctl restart docker`) sin necesidad** — interrumpe el portal y n8n.
- **NUNCA `prisma migrate`** — la BD es legacy y compartida con el portal y osadef-api.
- **Después de cada deploy, verificar TODOS los servicios críticos** (no solo esta API):
  ```bash
  curl -s http://127.0.0.1:3000/api/health   # portal
  curl -s http://127.0.0.1:3001/health       # osadef-api
  curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3002/  # mcp
  curl -s http://127.0.0.1:3003/health       # esta API (osadef-api-asesores)
  curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5678/  # n8n
  docker ps --format "table {{.Names}}\t{{.Status}}"
  pm2 list
  ```

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
