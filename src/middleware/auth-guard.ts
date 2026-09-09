import type { FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config/env.js";

/**
 * Middleware que verifica autenticacion via API Key.
 * No soporta JWT porque los asesores ya estan autenticados en el portal.
 *
 * Multi-key (mismo criterio que cartilla-adef): el mismo mensaje de error
 * genérico en los tres casos (sin header, header mal formado, key
 * inexistente) — no le da a un atacante ninguna pista de cuál fue el
 * problema. La key válida deja `request.authUser.label` con la etiqueta
 * del consumidor (ej. "n8n", "widget_chat"), para logs/rate-limit por
 * identidad en vez de por IP.
 */
export async function authGuard(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  const MENSAJE_NO_AUTENTICADO = "API Key invalida";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ error: MENSAJE_NO_AUTENTICADO });
  }

  const token = authHeader.substring(7); // Remove "Bearer "
  const label = config.apiKeys[token];

  // Defensa en profundidad (además de Object.create(null) en env.ts): si
  // alguna vez `apiKeys` se arma como objeto literal en otro lado (ej. un
  // test que construye su propio mapa a mano), una key tipo "constructor"
  // resolvería a una propiedad HEREDADA de Object.prototype — nunca un
  // string. Exigir `typeof label === "string"` la descarta sin importar
  // cómo se haya construido el mapa.
  if (typeof label !== "string") {
    return reply.code(401).send({ error: MENSAJE_NO_AUTENTICADO });
  }

  request.authUser = { id: 0, role: "system", label };
  return;
}

// Tipos para el usuario autenticado
export interface AuthUser {
  id: number;
  role: "system";
  label: string;
}

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser;
  }
}
