# Casos de Prueba — Widget de Chat para Asesores OSADEF

## Instrucciones de uso
1. Abrir el widget de ElevenLabs en el portal de asesores
2. Escribir una consulta de la lista
3. Verificar que ElevenLabs entienda la intención y llame a la tool correcta
4. Verificar que la respuesta sea clara y tenga los datos esperados

---

## 1. Autorizaciones de Medicamentos

### 1.1 Consulta básica
- "Quiero ver las autorizaciones del afiliado 20120667468"
- "Mostrame los medicamentos autorizados para 20120667468"
- "Autorizaciones vigentes de 20120667468"

### 1.2 Con filtro por medicamento
- "Autorizaciones de atorvastatina para 20120667468"
- "Quiero ver si tiene autorizada la triamcinolona, CUIL 20120667468"
- "Medicamentos con monodroga accesorio para 20120667468"

### 1.3 Con filtro por fecha
- "Autorizaciones del afiliado 20120667468 desde 2025-01-01"
- "Medicamentos autorizados a 20120667468 entre enero y diciembre 2025"

### 1.4 Sin datos (CUIL sin autorizaciones)
- "Autorizaciones del afiliado 00000000000"
- "Medicamentos para 20999999999"

### 1.5 CUIL inválido (menos de 11 dígitos)
- "Autorizaciones de 2012066746"
- "Medicamentos para 12345"

### 1.6 Sin especificar CUIL
- "Quiero ver las autorizaciones"
- "Mostrame los medicamentos autorizados"

---

## 2. Tratamientos Crónicos (Cronicidad)

### 2.1 Consulta básica
- "¿Qué cronicidades tiene el afiliado 20120667468?"
- "Tratamientos crónicos de 20120667468"
- "Patologías de 20120667468"

### 2.2 Con filtro por medicamento
- "Cronicidad de insulina para 20120667468"
- "Tratamientos crónicos con capecitabina, CUIL 20120667468"

### 2.3 Con filtro por vencimiento próximo
- "Tratamientos crónicos de 20120667468 que vencen en 30 días"
- "¿Qué medicamentos crónicos vencen pronto para 20120667468?"

### 2.4 Sin datos
- "Cronicidad del afiliado 00000000000"
- "Patologías de 20999999999"

### 2.5 Sin especificar CUIL
- "¿Qué cronicidades tiene este afiliado?"
- "Tratamientos crónicos"

---

## 3. Validación de Afiliados

### 3.1 Afiliado existente (titular)
- "¿Existe el afiliado 20120667468?"
- "Validar CUIL 20120667468"
- "Buscar afiliado 20120667468"

### 3.2 Afiliado no existente
- "¿Existe el afiliado 00000000000?"
- "Validar 20999999999"

### 3.3 CUIL inválido
- "¿Existe 12345?"
- "Validar 201206674"

### 3.4 Sin especificar CUIL
- "¿Este afiliado existe?"
- "Validar afiliado"

---

## 4. Edge Cases y Errores

### 4.1 CUIL con letras o caracteres especiales
- "Autorizaciones de 20-12066746-8"
- "Cronicidad de ABC123"

### 4.2 Acción no reconocida
- "Dame las facturas de 20120667468"
- "Pagos del afiliado 20120667468"

### 4.3 Consulta ambigua
- "Datos del afiliado 20120667468"
- "Información médica de 20120667468"

### 4.4 Múltiples intenciones
- "Autorizaciones y cronicidad de 20120667468"
- "Medicamentos y patologías de 20120667468"

---

## 5. Flujo Conversacional

### 5.1 El asesor no sabe el CUIL
**Asesor:** "Quiero ver las autorizaciones"
**Esperado:** ElevenLabs pide el CUIL

**Asesor:** "20120667468"
**Esperado:** ElevenLabs llama la tool con action=autorizaciones

### 5.2 Cambio de consulta
**Asesor:** "Autorizaciones de 20120667468"
**Esperado:** Lista autorizaciones

**Asesor:** "Ahora mostrame las cronicidades"
**Esperado:** ElevenLabs mantiene el CUIL y cambia action=cronicidad

### 5.3 Filtrado incremental
**Asesor:** "Autorizaciones de 20120667468"
**Esperado:** Lista todas

**Asesor:** "Solo la atorvastatina"
**Esperado:** ElevenLabs filtra por monodroga

---

## 6. Verificaciones de Calidad

### Para cada prueba, verificar:

| # | Verificación | Estado |
|---|---|---|
| 1 | ElevenLabs entiende la intención (autorizaciones/cronicidad/exists) | ☐ |
| 2 | Extrae correctamente el CUIL (11 dígitos) | ☐ |
| 3 | Llamada a tool `consultar_datos_asesores` con parámetros correctos | ☐ |
| 4 | Respuesta de n8n recibida sin errores | ☐ |
| 5 | ElevenLabs genera respuesta en lenguaje natural | ☐ |
| 6 | Datos mostrados son correctos y completos | ☐ |
| 7 | Formato es legible (listas, negritas, fechas) | ☐ |
| 8 | CUIL no se repite en exceso en la respuesta | ☐ |

---

## 7. Datos de Prueba Conocidos

| CUIL | Titular/Familiar | Autorizaciones | Cronicidad |
|---|---|---|---|
| 20120667468 | Titular | 6 (atorvastatina, triamcinolona, etc.) | 7 (diabetes, alta complejidad, etc.) |
| 00000000000 | No existe | 0 | 0 |
| 20999999999 | No existe | 0 | 0 |

---

## 8. Reporte de Bugs

Si una prueba falla, anotar:
1. **Consulta exacta** escrita en el widget
2. **Error mostrado** por ElevenLabs
3. **Respuesta de n8n** (si es accesible)
4. **Logs relevantes** (`journalctl -u osadef-api-asesores`, `docker logs n8n`)

Abrir issue en GitHub con la etiqueta `bug`.
