import type { FastifyInstance } from "fastify";
import { authGuard } from "../../middleware/auth-guard.js";

interface CronicidadQuery {
  cuil: string;
  monodroga?: string;
  vence_en_dias?: string;
}

const cronicoItemSchema = {
  type: "object",
  properties: {
    nroafiliado: { type: "string", example: "20120667468" },
    cronicidad: { type: "string", example: "DIABETES TIPO 2" },
    monodroga: { type: "string", example: "METFORMINA" },
    codmonodroga: { type: "string", example: "00042" },
    potencia: { type: "string", example: "500" },
    unidades: { type: "string", example: "0030" },
    anual: { type: "integer", example: 0 },
    mensual: { type: "integer", example: 60 },
    diaria: { type: "integer", example: 0 },
    cobertura: { type: "string", example: "40%" },
    fecha: { type: "string", example: "2024-03-01" },
    fechavencimiento: { type: "string", example: "2025-03-01" },
  },
};

const errorSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
  },
};

export default async function cronicidadRoute(fastify: FastifyInstance) {
  fastify.get<{ Querystring: CronicidadQuery }>(
    "/cronicidad",
    {
      preHandler: authGuard,
      schema: {
        description:
          "Obtiene los medicamentos en tratamiento cronico vigentes de un afiliado (titular o familiar). Realiza UNION entre llx_afiliado y llx_familiar con sus antecedentes.",
        tags: ["Cronicidad"],
        security: [{ apiKeyAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            cuil: {
              type: "string",
              minLength: 11,
              maxLength: 11,
              description: "CUIL del afiliado o familiar (sin guiones)",
              example: "20120667468",
            },
            monodroga: {
              type: "string",
              description: "Filtrar por nombre de monodroga (contiene)",
              example: "METFORMINA",
            },
            vence_en_dias: {
              type: "integer",
              description: "Filtrar cronicidades que vencen en los proximos X dias",
              example: 30,
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: cronicoItemSchema,
              },
              count: { type: "integer", example: 2 },
            },
          },
          400: { ...errorSchema, description: "Falta ?cuil=" },
          401: { ...errorSchema, description: "API Key invalida o faltante" },
          404: { ...errorSchema, description: "No se encontraron tratamientos cronicos" },
        },
      },
    },
    async (request, reply) => {
      const { cuil, monodroga, vence_en_dias } = request.query;

      if (!cuil || !/^\d{11}$/.test(cuil)) {
        return reply.code(400).send({ error: "cuil es obligatorio y debe tener 11 digitos numericos" });
      }

      const titularResults = await fastify.prisma.$queryRaw`
        SELECT 
          m.cuiltitu AS nroafiliado,
          ant.nombre AS cronicidad,
          act.Monodroga AS monodroga,
          LPAD(act.CodigoMonodroga, 5, '0') AS codmonodroga,
          act.Potencia AS potencia,
          LPAD(act.Unidad, 4, '0') AS unidades,
          MAX(0) AS anual,
          MAX(CEIL((30 * CAST(m.dosisdiaria AS DECIMAL(10,2))) / IF(CAST(m.presentacion AS DECIMAL(10,2)) > 0, CAST(m.presentacion AS DECIMAL(10,2)), CAST(act.Unidad AS DECIMAL(10,2))))) AS mensual,
          MAX(0) AS diaria,
          rp.label AS cobertura,
          a.inicio AS fecha,
          a.final AS fechavencimiento
        FROM llx_medica AS m 
        INNER JOIN llx_afiliado_antecedente AS a ON (m.antecedente = a.antecedente)
        INNER JOIN llx_afiliado AS af ON (a.afiliado = af.rowid)
        INNER JOIN llx_activia_vademecum AS act ON (m.medicamento = act.rowid)
        INNER JOIN llx_rp AS rp ON (m.tipoautoRp1 = rp.rowid)
        INNER JOIN llx_antecedente AS ant ON (m.antecedente = ant.rowid)
        WHERE m.medicamento != 0 
          AND (m.antecedente != 0 AND m.antecedente != 8) 
          AND m.estadotra = 3 
          AND (m.tipoautoRp1 != 1 AND m.tipoautoRp1 != 0) 
          AND act.CodigoMonodroga IS NOT NULL 
          AND act.Potencia IS NOT NULL 
          AND act.UnidadPotencia IS NOT NULL 
          AND act.Unidad IS NOT NULL
          AND m.cuilbenefi = af.cuit
          AND (m.fecharecep BETWEEN a.inicio AND a.final)
          AND a.final >= CURDATE()
          AND af.activo = 1
          AND af.cuit = ${cuil}
        GROUP BY nroafiliado, codmonodroga, potencia, unidadpotencia, unidades
      `;

      const familiarResults = await fastify.prisma.$queryRaw`
        SELECT 
          m.cuilbenefi AS nroafiliado,
          ant.nombre AS cronicidad,
          act.Monodroga AS monodroga,
          LPAD(act.CodigoMonodroga, 5, '0') AS codmonodroga,
          act.Potencia AS potencia,
          LPAD(act.Unidad, 4, '0') AS unidades,
          MAX(0) AS anual,
          MAX(CEIL((30 * CAST(m.dosisdiaria AS DECIMAL(10,2))) / IF(CAST(m.presentacion AS DECIMAL(10,2)) > 0, CAST(m.presentacion AS DECIMAL(10,2)), CAST(act.Unidad AS DECIMAL(10,2))))) AS mensual,
          MAX(0) AS diaria,
          rp.label AS cobertura,
          a.inicio AS fecha,
          a.final AS fechavencimiento
        FROM llx_medica_familiar AS m 
        INNER JOIN llx_familiar_antecedente AS a ON (m.antecedente = a.antecedente)
        INNER JOIN llx_familiar AS f ON (a.familiar = f.rowid)
        INNER JOIN llx_activia_vademecum AS act ON (m.medicamento = act.rowid)
        INNER JOIN llx_rp AS rp ON (m.tipoautoRp1 = rp.rowid)
        INNER JOIN llx_antecedente AS ant ON (m.antecedente = ant.rowid)
        WHERE m.medicamento != 0 
          AND (m.antecedente != 0 AND m.antecedente != 8) 
          AND m.estadotra = 3 
          AND (m.tipoautoRp1 != 1 AND m.tipoautoRp1 != 0) 
          AND act.CodigoMonodroga IS NOT NULL 
          AND act.Potencia IS NOT NULL 
          AND act.UnidadPotencia IS NOT NULL 
          AND act.Unidad IS NOT NULL
          AND m.cuilbenefi = f.cuil
          AND (m.fecharecep BETWEEN a.inicio AND a.final)
          AND a.final >= CURDATE()
          AND f.activo = 1
          AND f.cuil = ${cuil}
        GROUP BY nroafiliado, codmonodroga, potencia, unidadpotencia, unidades
      `;

      let result = [...(titularResults as any[]), ...(familiarResults as any[])];

      if (monodroga) {
        const filter = monodroga.toUpperCase();
        result = result.filter(r => (r as any).monodroga?.toUpperCase().includes(filter));
      }

      if (vence_en_dias) {
        const dias = parseInt(vence_en_dias, 10);
        if (!isNaN(dias)) {
          const fechaLimite = new Date();
          fechaLimite.setDate(fechaLimite.getDate() + dias);
          result = result.filter(r => new Date((r as any).fechavencimiento) <= fechaLimite);
        }
      }

      if (!result || result.length === 0) {
        return reply.code(404).send({ error: "No se encontraron tratamientos cronicos para el CUIL proporcionado" });
      }

      return {
        data: result,
        count: result.length,
      };
    },
  );
}
