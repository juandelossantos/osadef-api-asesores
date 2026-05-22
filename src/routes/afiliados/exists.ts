import type { FastifyInstance } from "fastify";
import { authGuard } from "../../middleware/auth-guard.js";

interface ExistsQuery {
  cuil: string;
}

const errorSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
  },
};

export default async function afiliadosExistsRoute(fastify: FastifyInstance) {
  fastify.get<{ Querystring: ExistsQuery }>(
    "/afiliados/exists",
    {
      preHandler: authGuard,
      schema: {
        description:
          "Verifica si un CUIL existe como afiliado titular o familiar. Util para validar antes de consultar autorizaciones o cronicidad.",
        tags: ["Afiliados"],
        security: [{ apiKeyAuth: [] }],
        querystring: {
          type: "object",
          required: ["cuil"],
          properties: {
            cuil: {
              type: "string",
              minLength: 11,
              maxLength: 11,
              description: "CUIL del afiliado o familiar (sin guiones)",
              example: "20120667468",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              cuil: { type: "string", example: "20120667468" },
              exists: { type: "boolean", example: true },
              tipo: {
                type: "string",
                enum: ["titular", "familiar", null],
                example: "titular",
                nullable: true,
              },
            },
          },
          400: { ...errorSchema, description: "Falta ?cuil=" },
          401: { ...errorSchema, description: "API Key invalida o faltante" },
        },
      },
    },
    async (request, reply) => {
      const { cuil } = request.query;

      if (!cuil || !/^\d{11}$/.test(cuil)) {
        return reply.code(400).send({ error: "cuil es obligatorio y debe tener 11 digitos numericos" });
      }

      // Buscar como titular
      const titular = await fastify.prisma.llx_afiliado.findFirst({
        where: { cuit: cuil },
        select: { rowid: true },
      });

      if (titular) {
        return { cuil, exists: true, tipo: "titular" };
      }

      // Buscar como familiar
      const familiar = await fastify.prisma.llx_familiar.findFirst({
        where: { cuil: cuil },
        select: { rowid: true },
      });

      if (familiar) {
        return { cuil, exists: true, tipo: "familiar" };
      }

      return { cuil, exists: false, tipo: null };
    },
  );
}
