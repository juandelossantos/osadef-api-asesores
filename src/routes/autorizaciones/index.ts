import type { FastifyInstance } from "fastify";
import { authGuard } from "../../middleware/auth-guard.js";

interface AutorizacionesQuery {
  cuil: string;
  nombre?: string;
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
    codigo: { type: "string", example: "00042" },
    nombre: { type: "string", example: "METFORMINA" },
    potencia: { type: "string", example: "500" },
    unidadpotencia: { type: "string", example: "00001" },
    unidades: { type: "string", example: "0030" },
    cantidad: { type: "string", example: "02" },
    cobertura: { type: "string", example: "40" },
    tipo: { type: "string", example: "medicamento" },
    medico: { type: "string", example: "" },
    matricula: { type: "string", example: "" },
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
          "Obtiene autorizaciones vigentes de medicamentos y prácticas de un afiliado (titular o familiar). UNION ALL entre llx_medica, llx_medica_familiar, llx_autorizacion_prestacion y llx_autorizacion_prestacion_familiar. Incluye campo tipo: 'medicamento' | 'prestacion'.",
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
            nombre: {
              type: "string",
              description: "Filtrar por nombre de medicamento o práctica (contiene). Reemplaza a monodroga.",
              example: "METFORMINA",
            },
            monodroga: {
              type: "string",
              description: "[Deprecated] Usar nombre en su lugar",
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
      const { cuil, nombre, monodroga, desde, hasta } = request.query;
      const filtro = nombre || monodroga;

      if (!cuil || !/^\d{11}$/.test(cuil)) {
        return reply.code(400).send({ error: "cuil es obligatorio y debe tener 11 digitos numericos" });
      }

      const medFilterClauses: string[] = [];
      const medFilterParams: any[] = [];
      const pracFilterClauses: string[] = [];
      const pracFilterParams: any[] = [];

      if (filtro) {
        medFilterClauses.push(`act.Monodroga LIKE ?`);
        medFilterParams.push(`%${filtro}%`);
        pracFilterClauses.push(`pr.nombreprestacion LIKE ?`);
        pracFilterParams.push(`%${filtro}%`);
      }

      if (desde) {
        medFilterClauses.push(`m.fecharecep >= ?`);
        medFilterParams.push(desde);
        pracFilterClauses.push(`p.fecharecep >= ?`);
        pracFilterParams.push(desde);
      }

      if (hasta) {
        medFilterClauses.push(`m.fecharecep <= ?`);
        medFilterParams.push(hasta);
        pracFilterClauses.push(`p.fecharecep <= ?`);
        pracFilterParams.push(hasta);
      }

      const medFilterSql = medFilterClauses.length > 0 ? ` AND ${medFilterClauses.join(" AND ")}` : "";
      const pracFilterSql = pracFilterClauses.length > 0 ? ` AND ${pracFilterClauses.join(" AND ")}` : "";

      const params = [
        cuil, ...medFilterParams,
        cuil, ...medFilterParams,
        cuil, ...pracFilterParams,
        cuil, ...pracFilterParams,
      ];

      const sql = `
        SELECT 
          m.rowid AS numeroautorizacion,
          m.cuiltitu AS nroafiliado,
          DATE_FORMAT(m.fecharecep, '%Y-%m-%d') AS fecha,
          ADDDATE(DATE_FORMAT(m.fecharecep, '%Y-%m-%d'), INTERVAL 15 DAY) AS fechavencimiento,
          LPAD(act.CodigoMonodroga, 5, '0') AS codigo,
          act.Monodroga AS nombre,
          act.Potencia AS potencia,
          LPAD(act.UnidadPotencia, 5, '0') AS unidadpotencia,
          LPAD(act.Unidad, 4, '0') AS unidades,
          LPAD(rpc.label, 2, '0') AS cantidad,
          SUBSTRING(rp.label,1,length(rp.label)-1) AS cobertura,
          'medicamento' AS tipo,
          '' AS medico,
          '' AS matricula
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
          ${medFilterSql}

        UNION ALL

        SELECT 
          m.rowid AS numeroautorizacion,
          m.cuilbenefi AS nroafiliado,
          DATE_FORMAT(m.fecharecep, '%Y-%m-%d') AS fecha,
          ADDDATE(DATE_FORMAT(m.fecharecep, '%Y-%m-%d'), INTERVAL 15 DAY) AS fechavencimiento,
          LPAD(act.CodigoMonodroga, 5, '0') AS codigo,
          act.Monodroga AS nombre,
          act.Potencia AS potencia,
          LPAD(act.UnidadPotencia, 5, '0') AS unidadpotencia,
          LPAD(act.Unidad, 4, '0') AS unidades,
          LPAD(rpc.label, 2, '0') AS cantidad,
          SUBSTRING(rp.label,1,length(rp.label)-1) AS cobertura,
          'medicamento' AS tipo,
          '' AS medico,
          '' AS matricula
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
          ${medFilterSql}

        UNION ALL

        SELECT 
          p.id AS numeroautorizacion,
          COALESCE(p.cuilbenefi, p.cuiltitu) AS nroafiliado,
          COALESCE(NULLIF(DATE_FORMAT(p.fecharecep, '%Y-%m-%d'), '0000-00-00'), '') AS fecha,
          COALESCE(NULLIF(DATE_FORMAT(DATE_ADD(p.fecharecep, INTERVAL 15 DAY), '%Y-%m-%d'), '0000-00-00'), '') AS fechavencimiento,
          CONVERT(COALESCE(pr.codprestacion, '') USING utf8mb4) AS codigo,
          CONVERT(COALESCE(pr.nombreprestacion, '') USING utf8mb4) AS nombre,
          CONVERT('' USING utf8mb4) AS potencia,
          CONVERT('' USING utf8mb4) AS unidadpotencia,
          CONVERT('' USING utf8mb4) AS unidades,
          CONVERT('' USING utf8mb4) AS cantidad,
          CONVERT(CASE WHEN p.coseguro IS NOT NULL THEN CAST(p.coseguro AS CHAR(10)) ELSE '' END USING utf8mb4) AS cobertura,
          CONVERT('prestacion' USING utf8mb4) AS tipo,
          CONVERT(COALESCE(p.medico, '') USING utf8mb4) AS medico,
          CONVERT(COALESCE(p.matricula, '') USING utf8mb4) AS matricula
        FROM llx_autorizacion_prestacion AS p
        LEFT JOIN llx_autorizacion_prestacion_lineas AS pl ON (p.id = pl.autorizacion)
        LEFT JOIN llx_prestacion AS pr ON (pl.prestacion = pr.rowid)
        WHERE (p.estadotra IS NULL OR p.estadotra NOT IN (0))
          AND p.cuilbenefi = ?
          ${pracFilterSql}

        UNION ALL

        SELECT 
          p.rowid AS numeroautorizacion,
          COALESCE(p.cuilbenefi, p.cuiltitu) AS nroafiliado,
          COALESCE(NULLIF(DATE_FORMAT(p.fecharecep, '%Y-%m-%d'), '0000-00-00'), '') AS fecha,
          COALESCE(NULLIF(DATE_FORMAT(DATE_ADD(p.fecharecep, INTERVAL 15 DAY), '%Y-%m-%d'), '0000-00-00'), '') AS fechavencimiento,
          CONVERT(COALESCE(pr.codprestacion, '') USING utf8mb4) AS codigo,
          CONVERT(COALESCE(pr.nombreprestacion, '') USING utf8mb4) AS nombre,
          CONVERT('' USING utf8mb4) AS potencia,
          CONVERT('' USING utf8mb4) AS unidadpotencia,
          CONVERT('' USING utf8mb4) AS unidades,
          CONVERT('' USING utf8mb4) AS cantidad,
          CONVERT(CASE WHEN p.coseguro IS NOT NULL THEN CAST(p.coseguro AS CHAR(10)) ELSE '' END USING utf8mb4) AS cobertura,
          CONVERT('prestacion' USING utf8mb4) AS tipo,
          CONVERT(COALESCE(p.medico, '') USING utf8mb4) AS medico,
          CONVERT(COALESCE(p.matricula, '') USING utf8mb4) AS matricula
        FROM llx_autorizacion_prestacion_familiar AS p
        LEFT JOIN llx_autorizacion_prestacion_familiar_lineas AS pl ON (p.rowid = pl.autorizacion)
        LEFT JOIN llx_prestacion AS pr ON (pl.prestacion = pr.rowid)
        WHERE (p.estadotra IS NULL OR p.estadotra NOT IN (0))
          AND p.cuilbenefi = ?
          ${pracFilterSql}

        ORDER BY fecha DESC
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
