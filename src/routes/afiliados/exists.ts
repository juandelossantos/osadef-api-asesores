import type { FastifyInstance } from "fastify";
import { authGuard } from "../../middleware/auth-guard.js";

interface ExistsQuery {
  cuil: string;
  include?: string;
}

const errorSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
  },
};

function computeCudStatus(vtoCerInca: Date | null): string {
  if (!vtoCerInca) return "Sin fecha";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const vencimiento = new Date(vtoCerInca);
  vencimiento.setHours(0, 0, 0, 0);
  return vencimiento >= today ? "Vigente" : "Vencido";
}

export default async function afiliadosExistsRoute(fastify: FastifyInstance) {
  fastify.get<{ Querystring: ExistsQuery }>(
    "/afiliados/exists",
    {
      preHandler: authGuard,
      schema: {
        description:
          "Verifica si un CUIL existe como afiliado titular o familiar. Opcionalmente retorna datos basicos y estado del CUD (Certificado Unico de Discapacidad).",
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
            include: {
              type: "string",
              description:
                "Campos adicionales a retornar. Valores separados por coma: 'basico' (nombre, estado, plan), 'cud' (discapacidad, certificado, vencimiento). Ejemplo: 'basico,cud'",
              example: "basico,cud",
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
              afiliado: {
                type: "object",
                nullable: true,
                properties: {
                  apellido: { type: "string" },
                  sexo: { type: "string" },
                  activo: { type: "boolean" },
                  plan: { type: "string" },
                },
              },
              cud: {
                type: "object",
                nullable: true,
                properties: {
                  tiene: { type: "boolean", example: true },
                  certificado: { type: "string", nullable: true },
                  diagnostico: { type: "string", nullable: true },
                  vencimiento: { type: "string", nullable: true },
                  estado: { type: "string", nullable: true, example: "Vigente" },
                },
              },
            },
          },
          400: { ...errorSchema, description: "Falta ?cuil=" },
          401: { ...errorSchema, description: "API Key invalida o faltante" },
        },
      },
    },
    async (request, reply) => {
      const { cuil, include } = request.query;

      if (!cuil || !/^\d{11}$/.test(cuil)) {
        return reply.code(400).send({ error: "cuil es obligatorio y debe tener 11 digitos numericos" });
      }

      const includes = (include || "").split(",").map((s) => s.trim());
      const wantBasico = includes.includes("basico");
      const wantCud = includes.includes("cud");

      // Buscar como titular
      const titular = await fastify.prisma.llx_afiliado.findFirst({
        where: { cuit: cuil },
        select: {
          rowid: true,
          ...(wantBasico && {
            apellido: true,
            sexo: true,
            activo: true,
            plan: true,
          }),
          ...(wantCud && {
            incap: true,
            certInca: true,
            diagInca: true,
            vtoCerInca: true,
          }),
        },
      });

      if (titular) {
        const response: any = { cuil, exists: true, tipo: "titular" };

        if (wantBasico) {
          response.afiliado = {
            apellido: titular.apellido,
            sexo: titular.sexo,
            activo: titular.activo === 1,
            plan: titular.plan,
          };
        }

        if (wantCud) {
          const tiene = titular.incap === 1;
          response.cud = {
            tiene,
            certificado: titular.certInca || null,
            diagnostico: titular.diagInca || null,
            vencimiento: titular.vtoCerInca
              ? titular.vtoCerInca.toISOString().split("T")[0]
              : null,
            estado: tiene ? computeCudStatus(titular.vtoCerInca) : null,
          };
        }

        return response;
      }

      // Buscar como familiar
      const familiar = await fastify.prisma.llx_familiar.findFirst({
        where: { cuil: cuil },
        select: {
          rowid: true,
          ...(wantBasico && {
            apellido: true,
            sexo: true,
            activo: true,
          }),
          ...(wantCud && {
            incapaz: true,
            certInca: true,
            diagInca: true,
            vtoCerInca: true,
          }),
        },
      });

      if (familiar) {
        const response: any = { cuil, exists: true, tipo: "familiar" };

        if (wantBasico) {
          response.afiliado = {
            apellido: familiar.apellido,
            nombre: null,
            sexo: familiar.sexo,
            activo: familiar.activo === 1,
            plan: null,
          };
        }

        if (wantCud) {
          const tiene = familiar.incapaz === 1;
          response.cud = {
            tiene,
            certificado: familiar.certInca || null,
            diagnostico: familiar.diagInca || null,
            vencimiento: familiar.vtoCerInca
              ? familiar.vtoCerInca.toISOString().split("T")[0]
              : null,
            estado: tiene ? computeCudStatus(familiar.vtoCerInca) : null,
          };
        }

        return response;
      }

      return { cuil, exists: false, tipo: null };
    },
  );
}
