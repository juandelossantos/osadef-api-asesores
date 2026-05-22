# AGENTS.md — osadef-api-asesores

## Reglas criticas

- **NUNCA ejecutar `prisma migrate`** — la BD es legacy y compartida con el portal y osadef-api. Solo `prisma generate` y `prisma db pull`.
- **NUNCA modificar la BD directamente** sin verificar que otros sistemas no dependan de la misma tabla/columna.
- **`API_KEY_N8N_ASESORES` es usada por n8n** en los workflows del chat de asesores. Si se cambia, hay que actualizar la credencial en n8n inmediatamente.
- **Esta API maneja datos de salud** (autorizaciones medicas, diagnosticos de cronicidad). Aplicar las reglas de sanitizacion de logs estrictamente.
- **NO implementar endpoints de escritura** (POST/PUT/DELETE que modifiquen datos). Esta API es SOLO LECTURA.

## Despliegue

### Proceso completo
```bash
cd /home/osadef-api-asesores
git pull
npm ci
npx prisma generate
npm run build
pm2 restart osadef-api-asesores
```

### Verificacion post-deploy
```bash
curl -s http://127.0.0.1:3003/health
# {"status":"ok",...}
```

### Logs
```bash
pm2 logs osadef-api-asesores
# o
tail -f /home/osadef-api-asesores/logs/output.log
tail -f /home/osadef-api-asesores/logs/error.log
```

### PM2
```bash
pm2 status                       # ver estado
pm2 restart osadef-api-asesores  # reiniciar
pm2 stop osadef-api-asesores     # detener
pm2 start osadef-api-asesores    # iniciar
```

La config esta en `ecosystem.config.cjs` (auto-restart, max 10 restarts).

## Dependencias con otros servicios

### n8n (puerto 5678)
- n8n llama a esta API usando `API_KEY_N8N_ASESORES` + `?cuil=` en cada request.
- Si la API se cae, los webhooks de n8n devuelven error, y el chat de IA para asesores deja de funcionar.
- La API es **solo lectura** para n8n (GET endpoints).
- El flujo es: Portal (asesor logueado) → Chat → n8n webhook → esta API.

### osadef-api (puerto 3001)
- No se comunican directamente. Son dos APIs distintas con distintas API Keys.
- Ambas leen de la misma BD MySQL pero tablas diferentes (prestadores vs medicamentos/afiliados).

### osadef-portal-prestadores (puerto 3000)
- **Comparten la misma BD MySQL**. El portal lee/escribe tablas de afiliados.
- Esta API solo lee (GET) de `llx_medica`, `llx_afiliado`, etc.

### Nginx
- `https://asesores-api.osadef.org.ar` → `127.0.0.1:3003` (configurar cuando este listo)
- Tambien proxea `/webhook/` → `127.0.0.1:5678` (n8n)
- Config: `/etc/nginx/sites-available/api-osadef` (agregar location)

## Modelo de autenticacion

### API Key (unico metodo)
- Clave estatica definida en `API_KEY_N8N_ASESORES` del `.env.production`
- Header: `Authorization: Bearer <api_key>`
- Acceso de lectura a todos los afiliados
- Requiere `?cuil=` en cada request para identificar al afiliado/familiar
- Header opcional de auditoria: `X-Asesor-ID: <id_del_asesor>`
- Role: `"system"` (id=0)

### Auth guard (middleware)
- Verifica que el token sea exactamente `API_KEY_N8N_ASESORES`
- Inyecta `request.authUser = { id: 0, role: "system" }`
- No soporta JWT (los asesores ya estan autenticados en el portal)

## Base de datos

### Tablas usadas (10 de ~200+)

| Tabla | Uso |
|---|---|
| `llx_medica` | Autorizaciones del titular |
| `llx_medica_familiar` | Autorizaciones de familiares |
| `llx_activia_vademecum` | Datos del medicamento (monodroga, potencia, etc.) |
| `llx_rp` | Tipo de receta / porcentaje de cobertura |
| `llx_rp_cantidad` | Cantidades autorizadas |
| `llx_afiliado` | Datos del titular (validacion de existencia) |
| `llx_familiar` | Datos del familiar (validacion de existencia) |
| `llx_afiliado_antecedente` | Vinculo titular ↔ patologia (fechas) |
| `llx_familiar_antecedente` | Vinculo familiar ↔ patologia (fechas) |
| `llx_antecedente` | Nombre de la patologia/cronicidad |

### Reglas
- **NUNCA `prisma migrate`** — la BD es legacy y compartida
- Solo `prisma generate` (generar client) y `prisma db pull` (sincronizar schema)
- El schema es independiente del portal y de osadef-api

## Convenciones de desarrollo

### Metodologia: Planning antes de codigo
1. **Entender el requerimiento** — leer la query SQL, identificar tablas, filtros, ordenamiento.
2. **Escribir el test primero** — en `tests/api.spec.ts`, crear el caso de uso antes de implementar el endpoint.
3. **Implementar el endpoint** — siguiendo el patron de osadef-api (schema OpenAPI inline, $queryRaw para queries complejas).
4. **Ejecutar tests** — `npm test`. Si falla, arreglar.
5. **Documentar en Swagger** — verificar que `/documentation` muestre el endpoint correctamente.

### Codigo
- TypeScript estricto (`strict: true`)
- Imports con extension `.js` (requerido por NodeNext module resolution)
- Plugins de Fastify envueltos con `fastify-plugin` (fp) para encapsulacion
- Rutas como funciones async que reciben `FastifyInstance`
- Validacion de input con JSON Schema nativo de Fastify
- Raw SQL (`$queryRawUnsafe`) para queries complejas (UNION, GROUP BY, funciones SQL). Preferir Prisma client para queries simples (exists).
- **SIEMPRE usar parametros** en `$queryRawUnsafe`. NUNCA concatenar strings de usuario directamente en SQL.

### Sanitizacion de logs (CRITICO - datos de salud)
- NUNCA loguear CUIL en produccion.
- NUNCA loguear diagnosticos (nombre de antecedentes) o nombres de medicamentos en logs.
- En desarrollo esta permitido para debugging, pero en produccion los logs deben estar sanitizados.
- Configuracion de Pino en `src/index.ts`: en produccion usar `level: "warn"`.

### Archivos de entorno
- `.env.development` y `.env.production` NUNCA van al repo
- `.env.example` es el template publico
- La carga es automatica segun `NODE_ENV` (ver `src/config/env.ts`)
- Variables requeridas: `DATABASE_URL`, `API_KEY_N8N_ASESORES`

### Git
- Branch principal: `main`
- Remote: crear en GitHub cuando se inicie el repo

### Scripts npm
- `npm run dev` — desarrollo con hot reload (tsx watch)
- `npm run build` — compilar TypeScript a `dist/`
- `npm start` — ejecutar build compilado
- `npm run start:dev` / `npm run start:prod` — con NODE_ENV explicito
- `npm run prisma:generate` — regenerar Prisma client
- `npm run prisma:pull` — sincronizar schema desde BD
- `npm test` — ejecutar suite de Playwright

## Riesgos conocidos

### Datos de salud sensibles
Esta API expone autorizaciones medicas y diagnosticos de cronicidad. En Argentina esto esta protegido por la Ley 25.326 de Proteccion de Datos Personales. Si la API Key se expone, cualquier sistema podria leer datos medicos de cualquier afiliado.

### API Key estatica
`API_KEY_N8N_ASESORES` es una clave estatica. No hay rotacion automatica. Si se expone, cambiar inmediatamente y actualizar n8n.

### Sin rate limiting
La API no tiene rate limiting propio. Depende de Nginx o de n8n para limitar requests.

## Ecosistema del servidor

| Servicio | Puerto | Tipo | Dependencia con esta API |
|---|---|---|---|
| osadef-portal-prestadores | 3000 | Docker | Comparte BD |
| osadef-api | 3001 | PM2 | Misma BD, distinta API Key |
| mcp-osadef | 3002 | systemd | No directa |
| **osadef-api-asesores** | **3003** | **PM2** | **-** |
| n8n | 5678 | Docker | Consume esta API |

## Como funciona la integracion n8n ↔ API (paso a paso)

### Flujo actual de osadef-api (prestadores)
1. El prestador habla en el chat de voz/IA (CustomGPT + ElevenLabs).
2. CustomGPT envia la pregunta a un webhook de n8n.
3. n8n tiene un workflow que:
   - Recibe el mensaje del usuario.
   - Determina la intencion (facturas, pagos, debitos).
   - Extrae el CUIT del prestador (del contexto de la conversacion).
   - Llama a `osadef-api` (puerto 3001) con:
     - Header: `Authorization: Bearer <API_KEY_N8N>`
     - Query: `?cuit=30589663256`
   - Recibe JSON de facturas/pagos/debitos.
   - Formatea la respuesta en lenguaje natural.
   - Devuelve al chat.

### Flujo de osadef-api-asesores (ElevenLabs Conversational AI)
1. El asesor esta logueado en el portal de asesores.
2. En el portal hay un **widget de chat** de ElevenLabs Conversational AI (modo texto).
3. El asesor escribe una consulta (ej: "Quiero ver las autorizaciones del afiliado 20120667468").
4. ElevenLabs entiende la intencion y, si detecta que necesita datos, **llama a una tool** configurada:
   - Tool: `consultar_datos_asesores`
   - Webhook: `https://api.osadef.org.ar/webhook/asesores-chat`
   - Body: `{ "action": "autorizaciones", "cuil": "20120667468" }`
5. n8n recibe el POST en el webhook `asesores-chat`:
   - Parsea la intencion y el CUIL.
   - Determina el endpoint de la API: `/autorizaciones`, `/cronicidad` o `/afiliados/exists`.
   - Llama a `osadef-api-asesores` (puerto 3003) con:
     - Header: `Authorization: Bearer <API_KEY_N8N_ASESORES>`
     - Query: `?cuil=20120667468`
   - Recibe JSON de datos medicos.
   - Devuelve el JSON crudo a ElevenLabs.
6. ElevenLabs usa el JSON para generar una respuesta en lenguaje natural y la muestra en el widget.

### Configuracion de ElevenLabs
- Ver documento completo: `docs/elevenlabs-setup.md`
- Workflow de n8n exportado: `n8n-workflow.json` (importar en n8n y activar)
- Widget embeddable: script de ElevenLabs Conversational AI con `mode="chat"`

### Por que es distinta la API Key?
- `osadef-api` expone datos financieros (facturas, pagos) de prestadores.
- `osadef-api-asesores` expone datos de salud (autorizaciones, diagnosticos) de afiliados.
- Son dominios de datos completamente diferentes con distintos riesgos legales.
- Si alguien compromete una key, no accede a ambos mundos.

## Lecciones aprendidas (a aplicar)

1. **Reiniciar la API con PM2 es seguro** — no afecta otros servicios. Pero n8n y el chat quedaran sin datos hasta que vuelva.
2. **Siempre verificar `/health`** despues de reiniciar.
3. **Los env vars se cargan segun NODE_ENV** — en produccion usa `.env.production`, no `.env`.
4. **$queryRawUnsafe con parametros es seguro** — usar `?` placeholders, no concatenar strings.
5. **Primero el test, luego el codigo** — Playwright detecta problemas de integracion reales.
