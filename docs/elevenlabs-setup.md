# Configuración ElevenLabs Conversational AI - Agent de Asesores

## 1. Crear el Agent en ElevenLabs

1. Ir a https://elevenlabs.io/conversational-ai/app/agents
2. Click en **"Create Agent"**
3. Seleccionar **"Blank Agent"**
4. Nombre: `OSADEF - Asesores Chat`

## 2. System Prompt

Copiar el contenido de `docs/system-prompt.txt` del repositorio.

## 3. Habilitar Markdown en el Widget

En la pestaña **"Widget"** del agente, activar `renderMarkdown: true`. Esto permite que el chat renderice **negrita**, listas con viñetas, y saltos de línea correctamente. Sin esta opción, el texto `**negrita**` se ve literal con asteriscos.

## 4. Configurar Tool (External API)

En la pestaña **"Tools"** del agente, agregar un nuevo tool:

### Nombre del tool
`consultar_datos_asesores`

### Descripción
`Consulta datos médicos de afiliados en la base de datos de OSADEF. Usa esta tool para obtener autorizaciones de medicamentos, tratamientos crónicos, o validar la existencia de un afiliado.`

### Webhook URL
```
https://api.osadef.org.ar/webhook/asesores-chat
```

### Method
`POST`

### Headers
```json
{
  "Content-Type": "application/json"
}
```

### Body Schema (JSON)
```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["autorizaciones", "cronicidad", "exists"],
      "description": "Tipo de consulta: 'autorizaciones' para medicamentos autorizados, 'cronicidad' para tratamientos crónicos, 'exists' para validar si el afiliado existe."
    },
    "cuil": {
      "type": "string",
      "description": "CUIL del afiliado o familiar. Debe tener exactamente 11 dígitos numéricos sin guiones ni puntos. Ejemplo: 20120667468"
    },
    "nombre": {
      "type": "string",
      "description": "Opcional. Nombre del medicamento o práctica para filtrar resultados. Busca en ambos tipos. Ejemplo: resonancia, atorvastatina"
    },
    "desde": {
      "type": "string",
      "description": "Opcional. Fecha inicio para filtrar autorizaciones. Formato YYYY-MM-DD."
    },
    "hasta": {
      "type": "string",
      "description": "Opcional. Fecha fin para filtrar autorizaciones. Formato YYYY-MM-DD."
    },
    "vence_en_dias": {
      "type": "integer",
      "description": "Opcional. Para cronicidad, filtra tratamientos que vencen en los próximos X días."
    }
  },
  "required": ["action", "cuil"]
}
```

## 5. Configurar el Widget (Chat Interface)

En la pestaña **"Widget"** o **"Deploy"** del agente:

### Settings
- **Mode**: `Chat` (no Voice, para que sea texto puro)
- **Language**: `es` (Español)
- **Greeting Message**: `Hola, soy el asistente de OSADEF. ¿En qué puedo ayudarte hoy? Para consultar datos de un afiliado, necesito su CUIL (11 dígitos).`
- **Placeholder**: `Escribe tu consulta aquí...`

### Appearance
- Primary color: `#0056b3` (azul OSADEF, ajustar según branding)
- Position: `bottom-right`
- Icon: chat bubble

## 6. Obtener el Script de Embed

Una vez configurado el agente, ElevenLabs generará un script como este:

```html
<script src="https://elevenlabs.io/convai-widget/index.js" async type="text/javascript"></script>
<elevenlabs-convai
  agent-id="AGENT_ID_AQUI"
  mode="chat"
></elevenlabs-convai>
```

Guardar el `agent-id` para el paso 6.

## 7. Integrar en el Portal de Asesores

El webmaster debe agregar este script en el HTML del portal de asesores (ej: en el footer o layout principal):

```html
<!-- Widget de chat para asesores - ElevenLabs Conversational AI -->
<script src="https://elevenlabs.io/convai-widget/index.js" async type="text/javascript"></script>
<elevenlabs-convai
  agent-id="AGENT_ID_AQUI"
  mode="chat"
  style="
    --el-background: #ffffff;
    --el-primary: #0056b3;
    --el-border-radius: 12px;
  "
></elevenlabs-convai>
```

**Importante**: Reemplazar `AGENT_ID_AQUI` con el agent-id real generado en ElevenLabs.

## 8. Importar Workflow en n8n

1. Ir a la UI de n8n (https://n8np.osadef.org.ar/)
2. Workflows → Import from File
3. Seleccionar `/home/osadef-api-asesores/n8n-workflow.json`
4. Guardar y **Activar** el workflow (toggle ON)
5. Verificar que el webhook esté registrado: `https://api.osadef.org.ar/webhook/asesores-chat`

## 9. Prueba End-to-End

```bash
# Probar el webhook de n8n directamente
curl -X POST https://api.osadef.org.ar/webhook/asesores-chat \
  -H "Content-Type: application/json" \
  -d '{
    "tool_call": {
      "action": "autorizaciones",
      "cuil": "20120667468"
    }
  }'
```

Debe devolver el JSON con las autorizaciones del afiliado.

Luego, probar en el widget del portal: escribir "Quiero ver las autorizaciones del afiliado 20120667468".

## Notas de Seguridad

- El webhook de ElevenLabs llama a n8n sin autenticación (ElevenLabs no soporta custom headers dinámicos en tools). Esto es aceptable porque:
  1. El webhook es un UUID único difícil de adivinar
  2. n8n valida que los parámetros sean correctos
  3. La API de asesores requiere API Key (n8n la provee)
- Si se requiere mayor seguridad, se puede agregar un header estático en ElevenLabs tool config y validarlo en n8n.
