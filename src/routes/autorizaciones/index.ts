import type { FastifyInstance } from "fastify";
import { authGuard } from "../../middleware/auth-guard.js";

interface AutorizacionesQuery {
  cuil: string;
  monodroga?: string;
  desde?: string;
  hasta?: string;
}

const autorizacionItemSchema = {
  type: "object",
  properties: {
    numeroautorizacion: { type: "integer", example: 12345 },
    nroafiliado: { type: "string", example: "20120667468" },
    fecha: { type: "string", example: "2025-01-15" },
    fechavencimiento: { type: "string", example: "2025-01-30" },
    codmonodroga: { type: "string", example: "00042" },
    monodroga: { type: "string", example: "METFORMINA" },
    potencia: { type: "string", example: "500" },
    unidadpotencia: { type: "string", example: "00001" },
    unidades: { type: "string", example: "0030" },
    cantidad: { type: "string", example: "02" },
    idporcentaje: { type: "string", example: "40" },
  },
};

const errorSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
  },
};

export default async function autorizacionesRoute(fastify: FastifyInstance) {
  fastify.get<{ Querystring: AutorizacionesQuery }>(
    "/autorizaciones",
    {
      preHandler: authGuard,
      schema: {
        description:
          "Obtiene las autorizaciones de medicamentos vigentes (estadotra = 9) de un afiliado (titular o familiar). Realiza UNION entre llx_medica y llx_medica_familiar.",
        tags: ["Autorizaciones"],
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
            desde: {
              type: "string",
              format: "date",
              description: "Fecha inicio YYYY-MM-DD",
              example: "2025-01-01",
            },
            hasta: {
              type: "string",
              format: "date",
              description: "Fecha fin YYYY-MM-DD",
              example: "2025-12-31",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: autorizacionItemSchema,
              },
              count: { type: "integer", example: 3 },
            },
          },
          400: { ...errorSchema, description: "Falta ?cuil=" },
          401: { ...errorSchema, description: "API Key invalida o faltante" },
          404: { ...errorSchema, description: "No se encontraron autorizaciones" },
        },
      },
    },
    async (request, reply) => {
      const { cuil, monodroga, desde, hasta } = request.query;

      if (!cuil || !/^\d{11}$/.test(cuil)) {
        return reply.code(400).send({ error: "cuil es obligatorio y debe tener 11 digitos numericos" });
      }

      const filterClauses: string[] = [];
      const filterParams: any[] = [];

      if (monodroga) {
        filterClauses.push(`act.Monodroga LIKE ?`);
        filterParams.push(`%${monodroga}%`);
      }

      if (desde) {
        filterClauses.push(`m.fecharecep >= ?`);
        filterParams.push(desde);
      }

      if (hasta) {
        filterClauses.push(`m.fecharecep <= ?`);
        filterParams.push(hasta);
      }

      const filterSql = filterClauses.length > 0 ? ` AND ${filterClauses.join(" AND ")}` : "";
      const params = [cuil, ...filterParams, cuil, ...filterParams];

      const sql = `
        SELECT 
          m.rowid AS numeroautorizacion,
          m.cuiltitu AS nroafiliado,
          DATE_FORMAT(m.fecharecep, '%Y-%m-%d') AS fecha,
          ADDDATE(DATE_FORMAT(m.fecharecep, '%Y-%m-%d'), INTERVAL 15 DAY) AS fechavencimiento,
          LPAD(act.CodigoMonodroga, 5, '0') AS codmonodroga,
          act.Monodroga AS monodroga,
          act.Potencia AS potencia,
          LPAD(act.UnidadPotencia, 5, '0') AS unidadpotencia,
          LPAD(act.Unidad, 4, '0') AS unidades,
          LPAD(rpc.label, 2, '0') AS cantidad,
          SUBSTRING(rp.label,1,length(rp.label)-1) AS idporcentaje
        FROM llx_medica AS m
        LEFT JOIN llx_activia_vademecum AS act ON (m.medicamento = act.rowid)
        LEFT JOIN llx_rp AS rp ON (m.tipoautoRp1 = rp.rowid)
        LEFT JOIN llx_rp_cantidad AS rpc ON (m.cantrp1 = rpc.rowid)
        WHERE act.CodigoMonodroga IS NOT NULL 
          AND m.estadotra = 9 
          AND DATE_FORMAT(m.fecharecep,'%Y-%m-%d') <= CURDATE()
          AND m.tipoautoRp1 IS NOT NULL AND m.tipoautoRp1 != ''
          AND m.cantrp1 IS NOT NULL AND m.cantrp1 != ''
          AND m.cuilbenefi = ?
          ${filterSql}

        UNION

        SELECT 
          m.rowid AS numeroautorizacion,
          m.cuilbenefi AS nroafiliado,
          DATE_FORMAT(m.fecharecep, '%Y-%m-%d') AS fecha,
          ADDDATE(DATE_FORMAT(m.fecharecep, '%Y-%m-%d'), INTERVAL 15 DAY) AS fechavencimiento,
          act.Monodroga AS monodroga,
          LPAD(act.CodigoMonodroga, 5, '0') AS codmonodroga,
          act.Potencia AS potencia,
          LPAD(act.UnidadPotencia, 5, '0') AS unidadpotencia,
          LPAD(act.Unidad, 4, '0') AS unidades,
          LPAD(rpc.label, 2, '0') AS cantidad,
          SUBSTRING(rp.label,1,length(rp.label)-1) AS idporcentaje
        FROM llx_medica_familiar AS m
        LEFT JOIN llx_activia_vademecum AS act ON (m.medicamento = act.rowid)
        LEFT JOIN llx_rp AS rp ON (m.tipoautoRp1 = rp.rowid)
        LEFT JOIN llx_rp_cantidad AS rpc ON (m.cantrp1 = rpc.rowid)
        WHERE act.CodigoMonodroga IS NOT NULL 
          AND m.estadotra = 9 
          AND DATE_FORMAT(m.fecharecep,'%Y-%m-%d') <= CURDATE()
          AND m.tipoautoRp1 IS NOT NULL AND m.tipoautoRp1 != ''
          AND m.cantrp1 IS NOT NULL AND m.cantrp1 != ''
          AND m.cuilbenefi = ?
          ${filterSql}
      `;

      const result = await fastify.prisma.$queryRawUnsafe(sql, ...params) as any[];

      if (!result || result.length === 0) {
        return reply.code(404).send({ error: "No se encontraron autorizaciones para el CUIL proporcionado" });
      }

      return {
        data: result,
        count: result.length,
      };
    },
  );
}
