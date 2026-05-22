import type { FastifyInstance } from "fastify";

export default async function healthRoute(fastify: FastifyInstance) {
  fastify.get(
    "/health",
    {
      schema: {
        description: "Health check — verifica que la API esté respondiendo",
        tags: ["Sistema"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string", example: "ok" },
              timestamp: {
                type: "string",
                format: "date-time",
                example: "2026-04-07T18:10:54.779Z",
              },
              environment: {
                type: "string",
                example: "development",
                enum: ["development", "production"],
              },
            },
          },
        },
      },
    },
    async () => {
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
      };
    },
  );
}
