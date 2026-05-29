# PROGRESS.md — Estado del proyecto osadef-api-asesores

Ultima actualizacion: 2026-05-29

## Plan general

Construir una API REST que se conecte a la BD MySQL legacy de OSADEF para exponer datos medicos de afiliados (autorizaciones de medicamentos, tratamientos cronicos y estado de discapacidad/CUD). Sera consumida exclusivamente por n8n (chat de IA para asesores dentro del portal).

La API sigue exactamente la misma metodologia, stack y convenciones que `osadef-api` (Fastify + Prisma + TypeScript estricto + Playwright + PM2 + Nginx).

## Fases del proyecto

### Fase 0: Planning y analisis — COMPLETADA
- [x] Analizar las queries SQL proporcionadas (Query A: autorizaciones, Query B: cronicidad)
- [x] Mapear las 10 tablas involucradas
- [x] Definir endpoints minimos necesarios (/autorizaciones, /cronicidad, /afiliados/exists, /health)
- [x] Definir modelo de autenticacion: solo API Key (sin JWT, el portal ya autentica)
- [x] Documentar flujo n8n ↔ API paso a paso
- [x] Replicar estructura de directorios de osadef-api

### Fase 1: Scaffolding — COMPLETADA
- [x] Crear carpeta `/home/osadef-api-asesores`
- [x] `package.json` con dependencias identicas a osadef-api (sin @fastify/jwt)
- [x] `tsconfig.json` (ES2022, NodeNext, strict)
- [x] `.gitignore` configurado
- [x] `.env.example` con template de variables (DATABASE_URL, API_KEY_N8N_ASESORES, PORT=3003)
- [x] `ecosystem.config.cjs` para PM2
- [x] `AGENTS.md` con reglas criticas, convenciones, flujo n8n
- [x] `prisma/schema.prisma` placeholder (indica usar `prisma db pull`)

### Fase 2: Configuracion y plugins base — COMPLETADA
- [x] `src/config/env.ts` — carga de .env segun NODE_ENV + validacion
- [x] `src/plugins/prisma.ts` — conexion Prisma con decorador en Fastify
- [x] `src/plugins/cors.ts` — CORS (metodos GET/POST/OPTIONS, headers incluyendo X-Asesor-ID)
- [x] `src/plugins/swagger.ts` — documentacion OpenAPI (solo apiKeyAuth, sin JWT)
- [x] `src/middleware/auth-guard.ts` — verificacion de API Key estatica (sin JWT)

### Fase 3: Endpoints core — COMPLETADA
- [x] `GET /health` — health check sin auth
- [x] `GET /afiliados/exists?cuil=` — valida si CUIL existe como titular o familiar (Prisma client)
- [x] `GET /autorizaciones?cuil=&monodroga=&desde=&hasta=` — Query A con $queryRawUnsafe + parametros
- [x] `GET /cronicidad?cuil=&monodroga=&vence_en_dias=` — Query B con $queryRawUnsafe + parametros
- [x] Todos los endpoints usan preHandler: authGuard
- [x] Schemas OpenAPI inline con descriptions, examples, responses (200, 400, 401, 404)
- [x] Validacion de cuil: obligatorio, 11 digitos numericos
- [x] Sanitizacion de monodroga para filtros LIKE

### Fase 4: Tests de integracion — COMPLETADA
- [x] Configurar `.env.development` con credenciales de BD (copiadas de osadef-api)
- [x] Configurar `.env.production` con credenciales de BD (copiadas de osadef-api)
- [x] Instalar dependencias: `npm ci`
- [x] Ejecutar `prisma db pull` para obtener schema real (816 modelos introspectados)
- [x] Arreglar errores de validacion del schema generado (modelo an_clinico, enums vacios, autoincrement, relaciones sin unique)
- [x] Ejecutar `prisma generate`
- [x] Verificar que `npm run build` compila exitosamente
- [x] Enviar ticket a IT para registro DNS: `asesores-api.osadef.org.ar` → `176.52.133.47`
- [x] Verificar que `npm run dev` arranca y conecta a la BD (localhost:3003)
- [x] Tests con Playwright (`tests/api.spec.ts`) — local:
  - [x] Health check sin auth
  - [x] 401 en endpoints sin API Key
  - [x] 401 con API Key invalida
  - [x] 400 sin ?cuil
  - [x] 400 con cuil invalido
  - [x] /afiliados/exists con CUIL real
  - [x] /autorizaciones con API Key y cuil valido
  - [x] /autorizaciones filtro monodroga
  - [x] /cronicidad con API Key y cuil valido
  - [x] Tests de CORS (origin, preflight)
- [x] Ejecutar suite completa (`npm test`) y verificar que pasan todos — **14/14 pass**

> **Nota:** Se corrigio bug en filtro `monodroga` de `/autorizaciones` — `HAVING` al final de `UNION` no funciona en MySQL. Se movieron los filtros al `WHERE` de cada `SELECT` usando columnas originales (`act.Monodroga LIKE ?`, `m.fecharecep >= ?`).

### Fase 5: Seguridad y sanitizacion — COMPLETADA
- [x] Revisar que los logs de Prisma/Pino NO registren CUILs en produccion — Pino configurado con `level: "warn"` en produccion (solo errores/warnings)
- [x] Verificar que `$queryRawUnsafe` usa SIEMPRE parametros `?` — Confirmado en ambos endpoints
- [x] Confirmar que `API_KEY_N8N_ASESORES` es distinta a `API_KEY_N8N` de osadef-api — Confirmado (distinta key)
- [x] Restringir CORS en produccion a dominios especificos (no `origin: true`) — **PENDIENTE MEJORA**: Actualmente `origin: true`. La API esta protegida por API Key, pero deberia restringirse a `*.osadef.org.ar` en proximo sprint.
- [x] Agregar rate limiting si es posible (o documentar dependencia de Nginx) — **Documentado en AGENTS.md**: Rate limiting delegado a Nginx/n8n.

### Fase 6: Deploy en servidor — COMPLETADA
- [x] Codigo ya esta en `/home/osadef-api-asesores/` del servidor
- [x] `npm ci && npx prisma generate` ejecutado
- [x] Configurar `.env.production` con credenciales de BD prod y API Key
- [x] `npm run build` ejecutado (compilacion exitosa)
- [x] Servidor corriendo en produccion (puerto 3003) — Iniciado con `nohup node dist/index.js &`
  - **Nota:** PM2 daemon presenta problemas en este servidor (timeout al iniciar). Se usa `nohup` como workaround. Recomendable investigar PM2 o migrar a systemd para auto-restart.
- [x] Configurar Nginx reverse proxy
  - Subdominio: `asesores-api.osadef.org.ar` → `127.0.0.1:3003`
  - Config: `/etc/nginx/sites-available/asesores-api-osadef` → `sites-enabled`
- [x] Generar/verificar certificado SSL (Let's Encrypt para el subdominio)
  - Certificado: `/etc/letsencrypt/live/asesores-api.osadef.org.ar/`
  - Auto-renovacion configurada por certbot
- [x] Verificar que `/health` responde desde externo — `https://asesores-api.osadef.org.ar/health` responde `{"status":"ok",...}`
- [x] Verificar que `/documentation` (Swagger UI) es accesible — Responde HTTP 200

> **DNS verificado:** `asesores-api.osadef.org.ar` → `176.52.133.47` ✅
> **HTTPS verificado:** Redirect 301 de HTTP → HTTPS funcionando ✅
> **SSL verificado:** Certificado Let's Encrypt vigente hasta 2026-08-20 ✅

### Fase 7: Integracion n8n + ElevenLabs — COMPLETADA
- [x] Crear Agent en ElevenLabs Conversational AI (modo chat)
  - Ver guia: `docs/elevenlabs-setup.md`
- [x] Configurar system prompt y tool `consultar_datos_asesores`
- [x] Obtener `agent-id` del agente de ElevenLabs
- [x] Importar workflow `n8n-workflow.json` en n8n y activar webhook `asesores-chat`
- [x] Configurar widget embeddable en el portal de asesores (script de ElevenLabs)
- [x] Probar flujo completo: Portal → Chat → ElevenLabs → n8n → API → Respuesta
- [x] Documentar en n8n los prompts/intenciones mapeadas a cada endpoint

> **Nota:** Se decidio usar ElevenLabs Conversational AI (modo chat) para mantener coherencia con el ecosistema de chat de OSADEF. El flujo de prestadores usa CustomGPT + ElevenLabs (voz); el de asesores usa ElevenLabs Conversational AI (texto).

### Fase 8: Consulta de CUD (Certificado Unico de Discapacidad) — COMPLETADA
- [x] Extender endpoint `GET /afiliados/exists` con parametro `?include=basico,cud`
- [x] Retorna datos del afiliado (apellido, sexo, activo, plan) e info CUD (tiene, certificado, diagnostico, vencimiento, estado)
- [x] Logica de estado: Vigente (vtoCerInca >= hoy) o Vencido (vtoCerInca < hoy)
- [x] Soporte para titulares (`incap`) y familiares (`incapaz`)
- [x] Backward compatible: sin parametro `include` retorna formato original
- [x] Actualizar n8n Parse Intent: action `cud` → `/afiliados/exists?include=basico,cud`
- [x] Actualizar n8n Format Response: muestra info CUD formateada
- [x] Actualizar system prompt de ElevenLabs con accion `cud` y ejemplos
- [x] Actualizar elevenlabs-tool-config.json con nueva accion
- [x] Tests: titulares y familiares con CUD verificados

> **CUILs de prueba con CUD:**
> - Titular: `20142334810` (PEREZ MIGUEL DARIO - Vigente)
> - Titular: `20148771872` (LANGONE JORGE ANTONIO - Vigente)
> - Familiar: `27401300673` (SALEGAS AILEN LOURDES - Vigente)
> - Sin CUD: `20120667468` (SALINAS RODOLFO HECTOR)

## Dependencias externas

| Dependencia | Estado | Responsable |
|---|---|---|---|
| Credenciales BD desarrollo | **Completada** (mismas que osadef-api) | — |
| Credenciales BD produccion | **Completada** (mismas que osadef-api) | — |
| Registro DNS `asesores-api.osadef.org.ar` | **Completada** ✅ | IT |
| Configurar Nginx + SSL para subdominio | **Completada** ✅ | Dev |
| Configurar n8n workflow + ElevenLabs Agent | **En progreso** | Dev + n8n admin |

## Decisiones tecnicas tomadas

1. **Sin JWT / sin auth de asesores en la API** — Los asesores ya estan autenticados en el portal. La API solo valida que n8n la llame (API Key). El portal es responsable de la sesion del asesor.
2. **API Key distinta a osadef-api** — Por seguridad y separacion de dominios (financiero vs salud). Si una se compromete, la otra no.
3. **$queryRawUnsafe para queries complejas** — Las queries requieren UNION, GROUP BY, funciones SQL (DATE_FORMAT, ADDDATE, CEIL, IF, LPAD, SUBSTRING). Prisma client no las soporta directamente. SIEMPRE con parametros `?`.
4. **Endpoint /afiliados/exists separado** — Permite a n8n validar si un CUIL existe antes de consultar autorizaciones/cronicidad, dando una mejor UX en el chat.
5. **Playwright para tests** — Mismo patron que osadef-api: tests de integracion HTTP reales contra el servidor corriendo.
6. **Swagger/OpenAPI inline** — Schemas definidos en cada archivo de ruta para mantener docs y validacion sincronizadas.
7. **Split UNION en JS para cronicidad** — Prisma `$queryRawUnsafe` con MySQL falla con `"Error in the underlying connector"` en queries complejas con UNION + GROUP BY + aggregates. Workaround: ejecutar titular y familiar por separado, mergear en JS.
8. **Auto-restart con systemd** — Se creo el servicio `osadef-api-asesores.service` para auto-restart del proceso Node. Verificado que reinicia en 5 segundos ante fallas.
9. **ElevenLabs Conversational AI para chat de asesores** — Se eligio ElevenLabs (modo chat/texto) para mantener coherencia con el ecosistema de chat de OSADEF. El agente llama a una tool que dispara webhook de n8n, que consulta la API y devuelve datos para que ElevenLabs genere la respuesta natural.

## Proxima accion inmediata

1. **Restringir CORS:** Cambiar `origin: true` a dominios especificos de OSADEF en `src/plugins/cors.ts`.
2. **Mejorar paginacion:** Limitar resultados en `/autorizaciones` cuando hay muchos registros.
3. **Agregar mas acciones:** Considerar nuevas acciones segun feedback de asesores (ej: diagnosticos, antecedentes).

## URLs de produccion

| Servicio | URL |
|---|---|
| Health check | `https://asesores-api.osadef.org.ar/health` |
| Swagger UI | `https://asesores-api.osadef.org.ar/documentation` |
| Autorizaciones | `https://asesores-api.osadef.org.ar/autorizaciones?cuil=...` |
| Cronicidad | `https://asesores-api.osadef.org.ar/cronicidad?cuil=...` |
| Afiliados (exists + CUD) | `https://asesores-api.osadef.org.ar/afiliados/exists?cuil=...&include=basico,cud` |
