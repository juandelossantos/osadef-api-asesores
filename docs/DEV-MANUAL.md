# Manual del Desarrollador — osadef-api-asesores

> **Versión:** 1.0  
> **Última actualización:** 2026-05-22  
> **Stack:** Fastify + Prisma + TypeScript + MySQL + n8n + ElevenLabs

---

## 1. Visión General

`osadef-api-asesores` es una API REST de **solo lectura** que expone datos médicos de afiliados de OSADEF (autorizaciones de medicamentos y tratamientos crónicos). Es consumida exclusivamente por **n8n** en nombre del chat de IA para asesores (ElevenLabs Conversational AI).

### Principios clave
- **Solo lectura** — Nunca escribe en la BD legacy
- **Sin JWT** — Autenticación por API Key estática
- **Datos de salud** — Reglas estrictas de sanitización de logs
- **Coherencia** — Mismo stack y convenciones que `osadef-api` (prestadores)

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PORTAL DE ASESORES                           │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  ElevenLabs Conversational AI Widget (modo chat/texto)          │ │
│  │  Agent ID: tool_1301ks89hgaveq0vvc0430e87h4q                  │ │
│  └────────────────────┬──────────────────────────────────────────┘ │
└───────────────────────┼─────────────────────────────────────────────┘
                        │ POST /webhook/asesores-chat
                        │ Body: {action, cuil, monodroga?}
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                              n8n (Docker)                            │
│  Puerto: 5678                                                        │
│  Webhook: /webhook/asesores-chat                                     │
│  Workflow: OSADEF Asesores - Chat                                    │
│  Nodos: Webhook → Parse Intent → HTTP Request → Format Response     │
│         → Respond to Webhook                                         │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ GET /autorizaciones?cuil=...
                        │ GET /cronicidad?cuil=...
                        │ GET /afiliados/exists?cuil=...
                        │ Header: Authorization: Bearer <API_KEY>
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     osadef-api-asesores                               │
│  Puerto: 3003                                                        │
│  Servicio: systemd (osadef-api-asesores.service)                    │
│  Framework: Fastify + Prisma + TypeScript                           │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ $queryRaw / $queryRawUnsafe
                        │ MySQL queries legacy
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MySQL (Huawei Cloud)                               │
│  Host: 192.168.0.27                                                 │
│  Base: osadef                                                       │
│  Schema: 816 modelos introspectados                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Stack Tecnológico

| Capa | Tecnología | Versión | Propósito |
|---|---|---|---|
| **Runtime** | Node.js | v22.12.0 | Ejecución del servidor |
| **Framework** | Fastify | v5.x | API REST, plugins, middleware |
| **ORM/Query** | Prisma | v6.x | Conexión MySQL, raw queries |
| **Lenguaje** | TypeScript | v5.x | Tipado estricto |
| **Compilador** | tsc (npm run build) | — | Compila a `dist/` |
| **Dev runner** | tsx | v4.x | Hot reload en desarrollo |
| **Tests** | Playwright | v1.x | Tests de integración HTTP |
| **Auth** | API Key estática | — | Header `Authorization: Bearer` |
| **Docs** | @fastify/swagger | v9.x | OpenAPI/Swagger UI en `/documentation` |
| **Process** | systemd | — | Auto-restart en producción |
| **Proxy** | Nginx | — | SSL + reverse proxy |
| **SSL** | Let's Encrypt (certbot) | — | Certificado auto-renovable |
| **Chat AI** | ElevenLabs Conversational AI | — | Widget embeddable, modo chat |
| **Workflows** | n8n (Docker) | — | Webhook → API → Respuesta formateada |

---

## 4. URLs y Endpoints de Producción

### API (osadef-api-asesores)
| Endpoint | URL | Auth |
|---|---|---|
| Health check | `https://asesores-api.osadef.org.ar/health` | ❌ Sin auth |
| Swagger UI | `https://asesores-api.osadef.org.ar/documentation` | ❌ Sin auth |
| Autorizaciones | `https://asesores-api.osadef.org.ar/autorizaciones?cuil=...` | ✅ API Key |
| Cronicidad | `https://asesores-api.osadef.org.ar/cronicidad?cuil=...` | ✅ API Key |
| Afiliados exists | `https://asesores-api.osadef.org.ar/afiliados/exists?cuil=...` | ✅ API Key |

### n8n
| Servicio | URL |
|---|---|
| UI Admin | `https://n8np.osadef.org.ar/` |
| Webhook asesores | `https://n8np.osadef.org.ar/webhook/asesores-chat` |
| (alternativo vía Nginx) | `https://api.osadef.org.ar/webhook/asesores-chat` |

### ElevenLabs
| Servicio | URL |
|---|---|
| Dashboard | `https://elevenlabs.io/conversational-ai/app/agents` |
| Widget script | `https://elevenlabs.io/convai-widget/index.js` |

### Otros servicios del ecosistema
| Servicio | Puerto | URL pública |
|---|---|---|
| osadef-portal-prestadores | 3000 | `https://portal.osadef.org.ar` |
| osadef-api (prestadores) | 3001 | `https://api.osadef.org.ar` |
| mcp-osadef | 3002 | `https://api.osadef.org.ar/mcp/mcp` |
| osadef-api-asesores | 3003 | `https://asesores-api.osadef.org.ar` |
| n8n | 5678 | `https://n8np.osadef.org.ar` |

---

## 5. Repositorios y Código

| Repositorio | URL | Contenido |
|---|---|---|
| **osadef-api-asesores** | `https://github.com/juandelossantos/osadef-api-asesores` | Este proyecto (API + docs + n8n workflow) |
| osadef-api | `https://github.com/juandelossantos/osadef-api` | API de prestadores (facturas, pagos) |
| mcp-osadef | `https://github.com/juandelossantos/mcp-osadef` | MCP server para CustomGPT |

---

## 6. Guía de Desarrollo Local

### 6.1 Requisitos
- Node.js v22+ (usar nvm: `/root/.nvm/versions/node/v22.12.0/bin/node`)
- MySQL (acceso a BD de desarrollo o producción según `.env`)
- npm v10+

### 6.2 Instalación
```bash
git clone https://github.com/juandelossantos/osadef-api-asesores.git
cd osadef-api-asesores
npm ci                    # Instalar dependencias (no modificar package-lock)
```

### 6.3 Configuración de entorno
Copiar el template y editar:
```bash
cp .env.example .env.development
# Editar:
# - DATABASE_URL
# - API_KEY_N8N_ASESORES (distinta a la de producción)
# - PORT=3003
```

**NUNCA commitear** archivos `.env*` o credenciales.

### 6.4 Generar Prisma Client
```bash
npx prisma generate         # Genera cliente TypeScript
# Si el schema cambió en BD:
npx prisma db pull          # Sincroniza schema desde BD (NUNCA migrate)
```

### 6.5 Compilar y ejecutar
```bash
npm run build               # Compila TypeScript → dist/
npm run dev                 # Desarrollo con hot reload (tsx watch)
# O directo:
NODE_ENV=development npx tsx src/index.ts
```

### 6.6 Ejecutar tests
```bash
npm test                    # Playwright integration tests
# Requiere servidor corriendo en localhost:3003
```

### 6.7 Verificar compilación
```bash
npm run build               # Debe terminar sin errores (0 warnings críticos)
```

---

## 7. Deploy en Producción

### 7.1 Pre-requisitos en servidor
- Node.js v22+ instalado
- Servidor systemd configurado
- Nginx con SSL (certbot)
- BD accesible (misma que osadef-api)

### 7.2 Proceso de deploy
```bash
cd /home/osadef-api-asesores
git pull origin main
npm ci
npx prisma generate
npm run build
systemctl restart osadef-api-asesores
```

### 7.3 Verificación post-deploy
```bash
# 1. Verificar que el servicio está activo
systemctl status osadef-api-asesores

# 2. Health check local
curl -s http://127.0.0.1:3003/health
# → {"status":"ok","environment":"production"}

# 3. Health check externo
curl -s https://asesores-api.osadef.org.ar/health
# → {"status":"ok","environment":"production"}

# 4. Swagger UI
curl -s -o /dev/null -w "%{http_code}\n" https://asesores-api.osadef.org.ar/documentation
# → 200

# 5. Test de endpoint protegido
API_KEY="a3e6b1c4d7f8g9h0i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5"
curl -s "https://asesores-api.osadef.org.ar/autorizaciones?cuil=20120667468" \
  -H "Authorization: Bearer ${API_KEY}" | jq '.count'
# → 6
```

### 7.4 Rollback rápido
```bash
git log --oneline -5        # Ver commits recientes
git revert HEAD             # Revertir último commit
npm run build
systemctl restart osadef-api-asesores
```

---

## 8. Mantenimiento

### 8.1 Logs
```bash
# Logs de la aplicación
tail -f /home/osadef-api-asesores/logs/output.log
tail -f /home/osadef-api-asesores/logs/error.log

# Logs de systemd
journalctl -u osadef-api-asesores -f

# Logs de n8n
docker logs n8n-compose-n8n-1 --tail 100 -f

# Logs de Nginx
sudo tail -f /var/log/nginx/access.log | grep asesores
sudo tail -f /var/log/nginx/error.log | grep asesores
```

### 8.2 Monitoreo periódico
```bash
# Verificar que el proceso está corriendo
ps aux | grep "node dist/index.js" | grep osadef-api-asesores

# Verificar puerto
ss -tlnp | grep 3003

# Verificar uso de recursos
systemctl status osadef-api-asesores
# → Revisar Memory y CPU

# Verificar SSL (certbot)
sudo certbot certificates | grep asesores-api
# → Debe mostrar "Found the following certs" con fecha de expiración
```

### 8.3 Renovación SSL
```bash
# Certbot renova automáticamente, pero verificar manualmente:
sudo certbot renew --dry-run
```

### 8.4 Actualización de dependencias
```bash
# Revisar vulnerabilidades
npm audit

# Actualizar patch versions (seguro)
npm update

# Para major versions, revisar breaking changes primero
# Documentar en CHANGELOG.md si es necesario
```

### 8.5 Backup de BD
```bash
# El backup de MySQL es responsabilidad del DBA / infraestructura.
# Esta API solo lee; no necesita backups propios.
# Si se requiere exportar el schema Prisma:
cd /home/osadef-api-asesores
cp prisma/schema.prisma prisma/schema.prisma.backup.$(date +%Y%m%d)
```

---

## 9. Troubleshooting

### 9.1 Error: "CUIL invalido" en n8n
- Verificar que ElevenLabs envíe `cuil` como string de 11 dígitos
- Si viene con guiones/puntos, agregar sanitización en n8n o en ElevenLabs prompt

### 9.2 Error: "No se encontraron registros"
- El CUIL no tiene datos en la BD
- Probar con CUIL conocido: `20120667468`
- Verificar que `estadotra = 9` (autorizaciones) o `estadotra = 3` (cronicidad)

### 9.3 Error: "API Key invalida"
- Verificar que n8n envíe `Authorization: Bearer <API_KEY_N8N_ASESORES>`
- Verificar que el valor coincida con `.env.production`
- No confundir con `API_KEY_N8N` (la de prestadores)

### 9.4 Error: "Connection refused" a MySQL
- Verificar VPN/tunnel a Huawei Cloud (192.168.0.27)
- Verificar credenciales en `DATABASE_URL`
- Verificar que el firewall permita conexión desde el servidor

### 9.5 Servidor no arranca
```bash
# Verificar error específico
journalctl -u osadef-api-asesores --no-pager | tail -50

# Verificar que existe dist/index.js
ls -la /home/osadef-api-asesores/dist/index.js

# Si no existe, recompilar
cd /home/osadef-api-asesores && npm run build

# Verificar variables de entorno
systemctl show --property=Environment osadef-api-asesores
```

### 9.6 Webhook de n8n devuelve 404
```bash
# Verificar que el workflow está activo en n8n
# Ir a n8np.osadef.org.ar → Workflows → OSADEF Asesores - Chat
# Toggle debe estar ON

# Verificar URL del webhook
curl -s -o /dev/null -w "%{http_code}\n" https://n8np.osadef.org.ar/webhook/asesores-chat
# → Debe dar 405 (método no permitido) o 200 si se envía POST correcto
```

### 9.7 ElevenLabs no responde
- Verificar cuota en dashboard de ElevenLabs (Usage)
- Verificar que la tool está configurada con URL correcta
- Probar tool directamente desde ElevenLabs con body de prueba
- Verificar que n8n devuelve JSON válido (no HTML de error)

---

## 10. Seguridad

### 10.1 Reglas críticas
- **NUNCA** ejecutar `prisma migrate` en la BD legacy
- **NUNCA** loguear CUILs o diagnósticos en producción
- **NUNCA** commitear archivos `.env*` en git
- **NUNCA** modificar tablas de la BD sin coordinar con otros sistemas
- **SIEMPRE** usar parámetros en `$queryRawUnsafe` (no concatenar strings de usuario)

### 10.2 Sanitización de logs
Pino está configurado con `level: "warn"` en producción. Los logs solo muestran errores y warnings, no requests con datos de afiliados.

### 10.3 Rotación de API Key
Si se compromete `API_KEY_N8N_ASESORES`:
1. Generar nueva key
2. Actualizar en `.env.production`
3. Actualizar en n8n workflow (nodo HTTP Request)
4. Reiniciar servicio: `systemctl restart osadef-api-asesores`
5. Actualizar credencial en n8n

---

## 11. Convenciones de Código

### 11.1 TypeScript
- `strict: true` obligatorio
- Imports con extensión `.js` (NodeNext module resolution)
- Tipar siempre los parámetros de rutas Fastify (`Querystring`, `Params`)

### 11.2 SQL Raw Queries
- Usar `$queryRawUnsafe` solo para queries complejas (UNION, GROUP BY, funciones SQL)
- **SIEMPRE** usar placeholders `?` con parámetros
- **NUNCA** concatenar input de usuario en strings SQL

### 11.3 Tests
- Playwright para tests de integración HTTP
- Usar datos reales de la BD (ej: CUIL `20120667468`)
- Tests deben pasar antes de mergear a `main`

### 11.4 Commits
Seguir conventional commits:
```
feat: nuevo endpoint /cronicidad
fix: corregir filtro monodroga en autorizaciones
docs: actualizar manual del desarrollador
chore: actualizar dependencias
```

---

## 12. Contactos y Escalación

| Rol | Responsable | Contacto |
|---|---|---|
| **Desarrollo** | Dev | GitHub: juandelossantos |
| **Infraestructura** | IT | Ticket interno |
| **n8n Admin** | Dev + IT | `https://n8np.osadef.org.ar` |
| **ElevenLabs** | Dev | Dashboard: `elevenlabs.io` |
| **BD MySQL** | DBA / IT | `192.168.0.27` |

---

## 13. Anexos

### 13.1 Archivos clave del proyecto
```
/home/osadef-api-asesores/
├── src/
│   ├── index.ts                    # Entry point Fastify
│   ├── config/env.ts               # Variables de entorno
│   ├── middleware/auth-guard.ts    # Validación API Key
│   ├── plugins/
│   │   ├── prisma.ts               # Conexión Prisma
│   │   ├── cors.ts                 # Config CORS
│   │   └── swagger.ts              # OpenAPI docs
│   └── routes/
│       ├── health.ts               # GET /health
│       ├── afiliados/exists.ts     # GET /afiliados/exists
│       ├── autorizaciones/index.ts # GET /autorizaciones
│       └── cronicidad/index.ts     # GET /cronicidad
├── tests/
│   └── api.spec.ts                 # Tests Playwright
├── docs/
│   ├── DEV-MANUAL.md               # Este archivo
│   ├── elevenlabs-setup.md         # Guía configuración ElevenLabs
│   ├── elevenlabs-tool-config.json # Config JSON de la tool
│   └── system-prompt.txt           # System prompt del agente
├── n8n-workflow.json               # Workflow exportado para n8n
├── ecosystem.config.cjs            # Config PM2 (legacy)
├── prisma/schema.prisma            # Schema legacy MySQL
└── .env.production                 # Variables prod (NO en git)
```

### 13.2 Glosario
| Término | Significado |
|---|---|
| **Monodroga** | Principio activo de un medicamento |
| **Cronicidad** | Tratamiento médico prolongado (patología + medicamento) |
| **CUIL** | Código Único de Identificación Laboral (11 dígitos) |
| **API Key** | Token estático para autenticación de n8n |
| **$queryRaw** | Prisma raw query con tagged template literals |
| **$queryRawUnsafe** | Prisma raw query con placeholders `?` (usar con cuidado) |

---

*Documento mantenido por el equipo de desarrollo de OSADEF. Para sugerencias o correcciones, abrir un issue en GitHub o contactar al responsable de desarrollo.*
