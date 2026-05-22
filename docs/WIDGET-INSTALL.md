# Guía de Instalación del Widget — Chat de Asesores OSADEF

> **Widget:** ElevenLabs Conversational AI (modo chat/texto)  
> **Agent ID:** `agent_6401ks8813fkecwt26vr93vb0nay`  
> **Audiencia:** Webmasters, desarrolladores frontend, administradores del portal de asesores  
> **Última actualización:** 2026-05-22

---

## 1. Código del Widget

Copiar y pegar este bloque HTML en el portal de asesores, preferentemente en el footer o layout principal para que esté disponible en todas las páginas:

```html
<!-- Widget de chat para asesores — OSADEF -->
<elevenlabs-convai
  agent-id="agent_6401ks8813fkecwt26vr93vb0nay"
  mode="chat"
></elevenlabs-convai>
<script
  src="https://unpkg.com/@elevenlabs/convai-widget-embed"
  async
  type="text/javascript"
></script>
```

**Importante:**
- No modificar el `agent-id`. Es la identificación única del agente en ElevenLabs.
- El script debe cargarse `async` para no bloquear el renderizado de la página.
- El widget aparece como una burbuja de chat en la esquina inferior derecha por defecto.

---

## 2. Dónde colocar el widget

### Opción A: Layout principal (recomendada)
Colocar el código antes del cierre de `</body>` en el layout base del portal. Así el chat estará disponible en todas las páginas donde el asesor esté logueado.

```html
<!DOCTYPE html>
<html>
<head>...</head>
<body>
  <!-- Contenido del portal -->

  <!-- Widget OSADEF -->
  <elevenlabs-convai agent-id="agent_6401ks8813fkecwt26vr93vb0nay"></elevenlabs-convai>
  <script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="text/javascript"></script>
</body>
</html>
```

### Opción B: Página específica del chat
Si el chat solo debe estar en una sección específica (ej: "Atención al Afiliado"):

```html
<!-- Solo en /atencion/ -->
<elevenlabs-convai agent-id="agent_6401ks8813fkecwt26vr93vb0nay"></elevenlabs-convai>
<script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="text/javascript"></script>
```

---

## 3. Personalización visual (opcional)

El widget acepta atributos de estilo inline para personalizar colores:

```html
<elevenlabs-convai
  agent-id="agent_6401ks8813fkecwt26vr93vb0nay"
  mode="chat"
  style="
    --el-background: #ffffff;
    --el-primary: #0056b3;
    --el-border-radius: 12px;
    --el-font-family: 'Segoe UI', sans-serif;
  "
></elevenlabs-convai>
```

| Variable | Descripción | Default |
|---|---|---|
| `--el-background` | Fondo del widget | `#ffffff` |
| `--el-primary` | Color principal (botón, encabezado) | `#000000` |
| `--el-border-radius` | Radio de bordes | `8px` |
| `--el-font-family` | Tipografía | Sistema |

---

## 4. Verificación post-instalación

Después de instalar el widget, verificar:

### 4.1 El widget carga
1. Abrir el portal de asesores en navegador
2. Verificar que aparece la burbuja de chat en la esquina inferior derecha
3. Click en la burbuja — debe abrirse el panel de chat
4. Debe aparecer el mensaje de bienvenida del asistente

### 4.2 El agente responde
1. Escribir: `Hola`
2. El asistente debe responder con el saludo configurado

### 4.3 La tool funciona
1. Escribir: `Quiero ver las autorizaciones del afiliado 20120667468`
2. El asistente debe responder con la lista de autorizaciones
3. Si responde "Hubo un error al consultar...", revisar:
   - Que el workflow de n8n esté activo
   - Que la API esté respondiendo (`curl https://asesores-api.osadef.org.ar/health`)
   - Que ElevenLabs tenga cuota disponible

---

## 5. Pruebas completas del widget

### A. Consultas básicas (autorizaciones)

| # | Consulta | Resultado esperado |
|---|---|---|
| 1 | "Quiero ver las autorizaciones del afiliado 20120667468" | Lista de 6 autorizaciones |
| 2 | "Autorizaciones del afiliado 27290758187" | Lista de 92 autorizaciones |
| 3 | "Autorizaciones de 27352722958" | Lista de 174 autorizaciones |
| 4 | "¿Qué puede retirar el afiliado 20219155922?" | Lista de 164 autorizaciones |
| 5 | "Medicamentos autorizados para 00000000000" | "No se encontraron registros" o "El afiliado no existe" |

### B. Consultas básicas (cronicidad)

| # | Consulta | Resultado esperado |
|---|---|---|
| 6 | "¿Qué cronicidades tiene el afiliado 20120667468?" | Lista de 7 tratamientos |
| 7 | "Cronicidades del afiliado 27290758187" | Lista de 22 tratamientos |
| 8 | "Tratamientos crónicos de 27383803786" | Lista de 10 tratamientos |
| 9 | "Patologías de 27201660527" | Lista de tratamientos crónicos |
| 10 | "Cronicidad de 20999999999" | "No existe" o "No se encontraron" |

### C. Filtros por medicamento (monodroga)

| # | Consulta | Resultado esperado |
|---|---|---|
| 11 | "Autorizaciones de atorvastatina para 20120667468" | Solo atorvastatina |
| 12 | "¿Tiene autorizada la triamcinolona? 20120667468" | Solo triamcinolona |
| 13 | "Cronicidad de insulina para 27290758187" | Tratamientos con insulina |
| 14 | "Autorizaciones de Metformina para 20219155922" | Si existe, mostrarla |

### D. Filtros por fecha / vencimiento

| # | Consulta | Resultado esperado |
|---|---|---|
| 15 | "Autorizaciones del afiliado 20120667468 desde 2025-01-01" | Filtradas por fecha |
| 16 | "Cronicidades que vencen en 30 días de 20120667468" | Tratamientos próximos a vencer |
| 17 | "Tratamientos crónicos que vencen pronto de 27290758187" | Filtradas por vencimiento |

### E. Validar afiliado

| # | Consulta | Resultado esperado |
|---|---|---|
| 18 | "¿Existe el afiliado 20120667468?" | "Sí, existe como titular" |
| 19 | "Validar CUIL 27290758187" | "Sí, existe" |
| 20 | "¿Existe 00000000000?" | "No existe en el sistema" |

### F. Edge cases y errores

| # | Consulta | Resultado esperado |
|---|---|---|
| 21 | "Quiero ver las autorizaciones" | Pide el CUIL |
| 22 | "Autorizaciones de 2012066746" | "CUIL inválido, debe tener 11 dígitos" |
| 23 | "Cronicidad de 12345" | "CUIL inválido" |
| 24 | "Dame las facturas de 20120667468" | "Acción no reconocida" o "No puedo consultar facturas" |
| 25 | "Autorizaciones y cronicidad de 20120667468" | Maneja ambas intenciones o pide clarificación |

---

## 6. Flujos conversacionales de prueba

### Flujo 1: Asesor no sabe el CUIL
```
Asesor: "Quiero ver las autorizaciones"
Asistente: "Para consultar las autorizaciones, necesito el CUIL del afiliado (11 dígitos numéricos sin guiones)."

Asesor: "20120667468"
Asistente: [Lista de autorizaciones]
```

### Flujo 2: Cambio de consulta manteniendo CUIL
```
Asesor: "Autorizaciones de 20120667468"
Asistente: [Lista de autorizaciones]

Asesor: "Ahora mostrame las cronicidades"
Asistente: [Lista de cronicidades del mismo CUIL]
```

### Flujo 3: Filtrado incremental
```
Asesor: "Autorizaciones de 27290758187"
Asistente: [Lista completa - 92 items]

Asesor: "Solo la atorvastatina"
Asistente: [Filtra y muestra solo atorvastatina]
```

---

## 7. Checklist de validación final

Antes de dar por terminada la instalación, verificar:

| # | Verificación | Estado |
|---|---|---|
| 1 | Widget visible en el portal | ☐ |
| 2 | Widget se abre al hacer click | ☐ |
| 3 | Saludo inicial aparece | ☐ |
| 4 | Consulta básica de autorizaciones funciona | ☐ |
| 5 | Consulta básica de cronicidad funciona | ☐ |
| 6 | Validar afiliado funciona | ☐ |
| 7 | Filtro por medicamento funciona | ☐ |
| 8 | Manejo de CUIL inválido es correcto | ☐ |
| 9 | Manejo de CUIL faltante pide el dato | ☐ |
| 10 | Respuestas son claras y formateadas | ☐ |
| 11 | No se expone información sensible en exceso | ☐ |
| 12 | Tiempo de respuesta es aceptable (< 5 segundos) | ☐ |

---

## 8. Troubleshooting del widget

### El widget no aparece
- Verificar que el script se cargó: inspeccionar elemento → Network → buscar `convai-widget-embed`
- Verificar que no hay bloqueadores de scripts (ad-blockers)
- Verificar compatibilidad de navegador (Chrome, Firefox, Edge modernos)

### El widget aparece pero no responde
- Verificar cuota de ElevenLabs en el dashboard
- Verificar que el agente está activo en ElevenLabs

### "Hubo un error al consultar..."
- Verificar que n8n workflow está activo: `https://n8np.osadef.org.ar/`
- Verificar que la API responde: `curl https://asesores-api.osadef.org.ar/health`
- Verificar logs de n8n: `docker logs n8n-compose-n8n-1 --tail 50`

### Respuestas lentas (> 10 segundos)
- Verificar conectividad del servidor a MySQL (192.168.0.27)
- Verificar que no hay cuellos de botella en n8n
- Considerar si ElevenLabs está en un servidor lejano geográficamente

---

## 9. Contacto y soporte

| Problema | Contactar |
|---|---|
| Widget no carga / problemas visuales | Webmaster / Frontend dev |
| ElevenLabs no responde | Admin de ElevenLabs (dashboard) |
| "Error al consultar" / datos incorrectos | Dev backend (API + n8n) |
| CUIL no encontrado cuando debería existir | DBA / IT (verificar BD) |
| Cuota agotada en ElevenLabs | Admin de ElevenLabs / Compras |

---

*Documento mantenido por el equipo de desarrollo de OSADEF. Para sugerencias, abrir issue en GitHub.*
