# Guía de Consultas Soportadas — Chat de Asesores OSADEF

> Este documento lista **todas las consultas que el asistente de IA puede responder**. Sirve como referencia para asesores y para validar que ElevenLabs entienda correctamente cada intención.

---

## Cómo funciona el chat

1. El asesor escribe una pregunta en lenguaje natural
2. ElevenLabs detecta la **intención** (autorizaciones, cronicidad, exists)
3. Extrae el **CUIL** (11 dígitos obligatorios)
4. Opcionalmente extrae **filtros** (monodroga, fechas, vencimiento)
5. Llama a la API a través de n8n
6. Recibe los datos y responde en texto legible

---

## A) Consultas Directas (básicas)

### 1. Autorizaciones completas de un afiliado
| Ejemplo | Respuesta esperada |
|---|---|
| "Quiero ver las autorizaciones del afiliado 20120667468" | Lista de autorizaciones vigentes |
| "¿Qué medicamentos tiene autorizados el titular 20120667468?" | Lista con monodroga, fecha, vencimiento, cobertura |
| "Autorizaciones vigentes del familiar 20120667468" | Mismo formato, busca en tabla familiar |
| "¿Qué puede retirar el afiliado 20120667468?" | Sinónimo de "autorizaciones" |
| "¿Qué recetas tiene autorizadas María García?" | **Nota:** requiere CUIL. El asesor debe saberlo o buscarlo. |

**Tool llamada:** `action="autorizaciones"`, `cuil="20120667468"`

---

### 2. Cronicidad / Tratamientos crónicos
| Ejemplo | Respuesta esperada |
|---|---|
| "¿Qué cronicidades tiene el afiliado 20120667468?" | Lista de patologías + medicamentos + vencimiento |
| "Medicamentos crónicos del titular 20120667468" | Sinónimo de cronicidad |
| "Tratamientos de largo plazo del familiar 20120667468" | Busca en tabla familiar |
| "¿Qué patologías activas tiene 20120667468?" | Mismo, mostrando nombre del antecedente |
| "Resumen de patologías activas de 20120667468" | Lista consolidada |

**Tool llamada:** `action="cronicidad"`, `cuil="20120667468"`

---

### 3. Validar existencia de afiliado
| Ejemplo | Respuesta esperada |
|---|---|
| "¿Existe el afiliado 20120667468?" | Sí/No + tipo (titular/familiar) |
| "Validar CUIL 20120667468" | Confirmación de existencia |
| "Buscar afiliado 20120667468" | Resultado de búsqueda |

**Tool llamada:** `action="exists"`, `cuil="20120667468"`

---

### 4. Consultas puntuales (requieren lógica adicional)
| Ejemplo | Nota técnica |
|---|---|
| "¿Cuándo vence la autorización 12345?" | ElevenLabs puede buscarla en la lista de autorizaciones |
| "¿Qué cobertura tiene el medicamento X?" | Se filtra por monodroga en autorizaciones o cronicidad |
| "¿Cuántas unidades mensuales le corresponden?" | Campo `mensual` en cronicidad |
| "¿Cuándo vence la cronicidad de diabetes?" | Filtrar cronicidad por patología |

---

## B) Consultas con Filtros

### 5. Filtrar por medicamento (monodroga)
| Ejemplo | Filtro aplicado |
|---|---|
| "Autorizaciones de atorvastatina para 20120667468" | `monodroga="atorvastatina"` |
| "¿Tiene autorizada la Metformina?" | `monodroga="metformina"` |
| "Cronicidad de insulina para 20120667468" | `monodroga="insulina"` |
| "Autorizaciones con código monodroga 00042" | `monodroga="00042"` (si el asesor busca por código) |

---

### 6. Filtrar por fecha
| Ejemplo | Filtro aplicado |
|---|---|
| "Autorizaciones de este mes" | `desde="2026-05-01"`, `hasta="2026-05-31"` |
| "Autorizaciones que vencen esta semana" | ElevenLabs calcula rango de fechas |
| "Autorizaciones del último año" | `desde="2025-05-22"` |
| "Cronicidades que vencen en los próximos 30 días" | `vence_en_dias=30` |
| "Cronicidades que vencen en enero" | ElevenLabs puede calcular `vence_en_dias` |

**Nota:** Los filtros de fecha requieren que ElevenLabs calcule las fechas. Si el LLM no lo hace bien, el asesor puede escribir las fechas directamente.

---

### 7. Filtrar por cobertura
| Ejemplo | Nota técnica |
|---|---|
| "Autorizaciones con 40% de cobertura" | Filtrar resultados donde `idporcentaje="40"` |
| "Medicamentos con cobertura del 100%" | Filtrar donde `idporcentaje="100"` |

**Nota:** Actualmente el endpoint devuelve el campo `idporcentaje`, pero no tiene filtro por cobertura en la query. ElevenLabs puede filtrar en memoria o el asesor puede ver el porcentaje en la lista.

---

### 8. Filtrar por cantidad
| Ejemplo | Nota técnica |
|---|---|
| "Autorizaciones para más de 30 unidades" | Filtrar donde `unidades > 30` |

**Nota:** No hay filtro directo por cantidad en la API. ElevenLabs puede filtrar en memoria.

---

## C) Consultas Combinadas y Avanzadas

### 9. Comparar autorizaciones vs cronicidad
| Ejemplo | Nota técnica |
|---|---|
| "¿Tiene Metformina en cronicidad o solo autorización?" | ElevenLabs debe llamar **ambas** tools y comparar |
| "Medicamentos autorizados que NO están en cronicidad" | Requiere dos llamadas + comparación |
| "Cronicidades sin autorizaciones recientes" | Requiere comparar fechas de ambas |

**Limitación actual:** El workflow de n8n maneja **una acción por llamada**. Para consultas combinadas, ElevenLabs necesitaría hacer **dos llamadas separadas** (una para autorizaciones, otra para cronicidad) y comparar los resultados. Esto depende de la capacidad del LLM de ElevenLabs.

---

### 10. Resumen completo
| Ejemplo | Nota técnica |
|---|---|
| "Resumen médico del afiliado 20120667468" | ElevenLabs puede llamar ambas tools y consolidar |
| "Medicación completa de 20120667468" | Autorizaciones + cronicidad en una sola respuesta |

---

### 11. Consultas de estado
| Ejemplo | Nota técnica |
|---|---|
| "¿Tiene autorizaciones vencidas?" | Requiere comparar `fechavencimiento < hoy` |
| "¿Tiene cronicidades por vencer?" | Usar `vence_en_dias=30` o fecha específica |

---

## D) Casos Edge y Manejo de Errores

### 12. CUIL faltante
| Consulta | Respuesta del asistente |
|---|---|
| "Quiero ver las autorizaciones" | "Necesito el CUIL del afiliado para consultar" |
| "¿Qué medicamentos tiene?" | "Por favor, proporcione el CUIL (11 dígitos)" |

### 13. CUIL inválido
| Consulta | Respuesta del asistente |
|---|---|
| "Autorizaciones de 12345" | "El CUIL debe tener 11 dígitos numéricos" |
| "Cronicidad de 20-12066746-8" | "El CUIL no debe contener guiones ni puntos" |

### 14. Afiliado no encontrado
| Consulta | Respuesta del asistente |
|---|---|
| "Autorizaciones de 00000000000" | "El CUIL no existe en el sistema" |
| "Cronicidad de 20999999999" | "No se encontraron registros para este afiliado" |

### 15. Sin datos disponibles
| Consulta | Respuesta del asistente |
|---|---|
| "Autorizaciones de un afiliado que no tiene" | "No tiene autorizaciones vigentes" |
| "Cronicidad de un afiliado sano" | "No tiene tratamientos crónicos registrados" |

---

## E) Ejemplos de Conversaciones Reales

### Conversación 1: Autorizaciones básica
```
Asesor: Hola, quiero ver las autorizaciones del afiliado 20120667468
Asistente: Encontré 6 autorizaciones vigentes:
         1. Atorvastatina 40mg — Autorizado: 26/12/2023, Vence: 10/01/2024
         2. Triamcinolona 40mg — Autorizado: 08/10/2025, Vence: 23/10/2025
         ...
```

### Conversación 2: Filtro por medicamento
```
Asesor: ¿Tiene autorizada la Metformina?
Asistente: Para consultar necesito el CUIL del afiliado.
Asesor: 20120667468
Asistente: El afiliado no tiene Metformina autorizada actualmente.
```

### Conversación 3: Cronicidad por vencer
```
Asesor: Quiero saber qué cronicidades vencen en los próximos 30 días
Asistente: ¿De qué afiliado?
Asesor: 20120667468
Asistente: Tiene 7 tratamientos crónicos. Los que vencen en los próximos 30 días son:
         1. Diabetes Centenera — tiras reactivas — Vence: 22/05/2026
         2. Diabetes Centenera — insulina — Vence: 22/05/2026
         ...
```

---

## F) Matriz de Capacidades

| Capacidad | Endpoint API | Filtros soportados | Complejidad |
|---|---|---|---|
| Autorizaciones completas | `/autorizaciones` | — | Baja |
| Autorizaciones por medicamento | `/autorizaciones?monodroga=X` | monodroga | Baja |
| Autorizaciones por fecha | `/autorizaciones?desde=X&hasta=Y` | desde, hasta | Media |
| Cronicidad completa | `/cronicidad` | — | Baja |
| Cronicidad por medicamento | `/cronicidad?monodroga=X` | monodroga | Baja |
| Cronicidad por vencimiento | `/cronicidad?vence_en_dias=X` | vence_en_dias | Media |
| Validar afiliado | `/afiliados/exists` | — | Baja |
| Comparar auth vs cronicidad | Dos llamadas separadas | — | Alta |
| Cobertura específica | Filtrar en memoria | — | Media |
| Unidades específicas | Filtrar en memoria | — | Media |

---

## G) Notas para Desarrolladores

### Si queremos agregar nuevas capacidades:

1. **Nuevo filtro en endpoint existente**
   - Modificar la query SQL en `src/routes/autorizaciones/index.ts` o `src/routes/cronicidad/index.ts`
   - Agregar parámetro al schema de Fastify
   - Actualizar tests en `tests/api.spec.ts`
   - Actualizar este documento

2. **Nuevo endpoint**
   - Crear archivo en `src/routes/nuevo-endpoint/index.ts`
   - Seguir patrón de endpoints existentes
   - Agregar ruta en `src/index.ts`
   - Crear tests
   - Actualizar workflow de n8n si es necesario
   - Documentar en este archivo

3. **Nueva tool en ElevenLabs**
   - Si el LLM no puede manejar una consulta compleja con la tool actual, considerar crear una tool específica
   - Ejemplo: `resumen_completo` que llame ambos endpoints internamente

---

## H) Validación del Widget

Para validar que ElevenLabs entiende todas estas consultas:

1. Probar cada consulta de la sección A (directas)
2. Probar 3-4 consultas de la sección B (con filtros)
3. Probar 1-2 consultas de la sección C (combinadas)
4. Verificar que el CUIL se maneje correctamente (faltante, inválido, válido)
5. Verificar mensajes de error amigables

**Resultado esperado:** El asesor puede hacer cualquiera de estas consultas en lenguaje natural y obtener una respuesta útil.

---

*Este documento debe mantenerse actualizado cada vez que se agregue un nuevo endpoint o capacidad a la API.*
