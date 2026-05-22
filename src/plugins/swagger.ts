import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import { config } from "../config/env.js";

const swaggerPlugin = fp(async (fastify: FastifyInstance) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "API OSADEF Asesores",
        description: `
API REST para asesores de OSADEF. Expone datos médicos de afiliados
(autorizaciones y cronicidad) de forma segura para consumo via n8n.

## Autenticacion

Esta API usa unicamente **API Key** (no JWT). Todos los endpoints
requieren el header: \`Authorization: Bearer <api_key>\`

Adicionalmente se requiere el parametro \`?cuil=\` para identificar al afiliado.

El header opcional \`X-Asesor-ID\` se usa para auditoria (quien consulta).

## Consumidores
- **n8n** — orquestador de flujos de IA del chat de asesores
        `.trim(),
        version: "1.0.0",
        contact: {
          name: "CreativaMotions",
          url: "https://creativamotions.com",
        },
      },
      servers: [
        {
          url:
            config.nodeEnv === "production"
              ? "https://asesores-api.osadef.org.ar"
              : "http://localhost:3003",
          description:
            config.nodeEnv === "production"
              ? "Producción"
              : "Desarrollo (local)",
        },
      ],
      tags: [
        { name: "Sistema", description: "Health check del servicio" },
        { name: "Afiliados", description: "Validacion de afiliados" },
        { name: "Autorizaciones", description: "Autorizaciones de medicamentos" },
        { name: "Cronicidad", description: "Medicamentos en tratamiento cronico" },
      ],
      components: {
        securitySchemes: {
          apiKeyAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "API Key",
            description:
              "API Key estatica del sistema. Requiere ?cuil= en cada request.",
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/documentation",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      persistAuthorization: true,
    },
  });
});

export default swaggerPlugin;
