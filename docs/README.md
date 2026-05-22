# Documentación del Proyecto

Bienvenido a la carpeta de documentación de `osadef-api-asesores`. Acá encontrarás todas las guías, manuales y configuraciones necesarias para entender, desarrollar, deployar y mantener el proyecto.

---

## Índice de Documentos

| Archivo | Propósito | Audiencia |
|---|---|---|
| [**DEV-MANUAL.md**](DEV-MANUAL.md) | Manual completo del desarrollador: stack, URLs, deploy, troubleshooting, seguridad, convenciones | Desarrolladores, DevOps, IT |
| [**TEST-CASES.md**](TEST-CASES.md) | Casos de prueba para validar el widget de chat de ElevenLabs | QA, testers, desarrolladores |
| [**WIDGET-INSTALL.md**](WIDGET-INSTALL.md) | Guía de instalación del widget en el portal + pruebas de validación | Webmasters, frontend devs, QA |
| [**elevenlabs-setup.md**](elevenlabs-setup.md) | Guía paso a paso para configurar el agente de ElevenLabs Conversational AI | Desarrolladores, administradores ElevenLabs |
| [**elevenlabs-tool-config.json**](elevenlabs-tool-config.json) | Configuración JSON de la herramienta webhook en ElevenLabs | Desarrolladores (copiar y pegar) |
| [**system-prompt.txt**](system-prompt.txt) | System prompt del agente de IA (listo para copiar y pegar en ElevenLabs) | Desarrolladores, administradores ElevenLabs |

---

## Documentos fuera de esta carpeta

| Archivo | Ubicación | Propósito |
|---|---|---|
| **AGENTS.md** | `/` (raíz) | Reglas críticas, convenciones de código, flujo n8n ↔ API, decisiones técnicas |
| **PROGRESS.md** | `/` (raíz) | Tracker de fases del proyecto: completadas, en progreso, bloqueantes |
| **n8n-workflow.json** | `/` (raíz) | Workflow exportado para importar en n8n |
| **ecosystem.config.cjs** | `/` (raíz) | Configuración PM2 (legacy, ahora usamos systemd) |
| **README.md** | `/` (raíz) | *(pendiente crear)* Resumen rápido del proyecto para visitantes del repo |

---

## Cómo usar esta documentación

### Soy desarrollador y quiero...
- **Entender el stack** → Leer [`DEV-MANUAL.md`](DEV-MANUAL.md) sección 3
- **Hacer deploy** → Leer [`DEV-MANUAL.md`](DEV-MANUAL.md) sección 7
- **Arreglar un bug** → Leer [`DEV-MANUAL.md`](DEV-MANUAL.md) sección 9 (Troubleshooting)
- **Correr tests** → Leer [`DEV-MANUAL.md`](DEV-MANUAL.md) sección 6.6

### Soy webmaster / frontend dev y quiero...
- **Instalar el widget en el portal** → Leer [`WIDGET-INSTALL.md`](WIDGET-INSTALL.md) sección 1 (código del widget)
- **Personalizar colores del widget** → Leer [`WIDGET-INSTALL.md`](WIDGET-INSTALL.md) sección 3
- **Validar que el widget funciona** → Leer [`WIDGET-INSTALL.md`](WIDGET-INSTALL.md) sección 5 (pruebas)
- **Arreglar problemas del widget** → Leer [`WIDGET-INSTALL.md`](WIDGET-INSTALL.md) sección 8 (troubleshooting)

### Soy QA/tester y quiero...
- **Probar el widget** → Leer [`TEST-CASES.md`](TEST-CASES.md) y seguir las consultas de prueba
- **Reportar un bug** → Usar el formato de la sección 8 de [`TEST-CASES.md`](TEST-CASES.md)

### Soy administrador de ElevenLabs/n8n y quiero...
- **Configurar el agente** → Leer [`elevenlabs-setup.md`](elevenlabs-setup.md)
- **Copiar el system prompt** → Abrir [`system-prompt.txt`](system-prompt.txt)
- **Importar la tool config** → Usar [`elevenlabs-tool-config.json`](elevenlabs-tool-config.json)
- **Importar el workflow** → Usar `n8n-workflow.json` desde la raíz

---

## Convenciones de documentación

- Los documentos están en **español** (castellano rioplatense)
- Los nombres de archivos usan **MAYÚSCULAS** para consistencia
- Los archivos `.md` usan formato Markdown estándar
- Los archivos `.json` son configuraciones listas para copiar y pegar
- Los archivos `.txt` son textos planos listos para copiar y pegar

---

## Mantenimiento

Si agregás, modificás o eliminás un documento, actualizá este `README.md` para mantener el índice al día.

Para sugerencias o correcciones, abrir un issue en GitHub o contactar al responsable de desarrollo.

---

*Última actualización: 2026-05-22*
