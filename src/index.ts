import { config, validateEnv } from "./config/env.js";

// Validar variables de entorno antes de arrancar
validateEnv();

import Fastify from "fastify";
import sensible from "@fastify/sensible";

// Plugins
import prismaPlugin from "./plugins/prisma.js";
import corsPlugin from "./plugins/cors.js";
import swaggerPlugin from "./plugins/swagger.js";

// Rutas
import healthRoute from "./routes/health.js";
import autorizacionesRoute from "./routes/autorizaciones/index.js";
import cronicidadRoute from "./routes/cronicidad/index.js";
import afiliadosExistsRoute from "./routes/afiliados/exists.js";

async function main() {
  const fastify = Fastify({
    logger: {
      level: config.nodeEnv === "development" ? "info" : "warn",
      transport:
        config.nodeEnv === "development"
          ? { target: "pino-pretty" }
          : undefined,
    },
    ajv: {
      customOptions: {
        strict: false,
        keywords: ["example"],
      },
    },
  });

  // Registrar plugins
  await fastify.register(sensible);
  await fastify.register(corsPlugin);
  await fastify.register(swaggerPlugin);
  await fastify.register(prismaPlugin);

  // Registrar rutas
  await fastify.register(healthRoute);
  await fastify.register(autorizacionesRoute);
  await fastify.register(cronicidadRoute);
  await fastify.register(afiliadosExistsRoute);

  // Arrancar servidor
  try {
    await fastify.listen({ port: config.port, host: config.host });
    fastify.log.info(
      `🚀 API OSADEF Asesores corriendo en http://${config.host}:${config.port}`,
    );
    fastify.log.info(`   Entorno: ${config.nodeEnv}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
