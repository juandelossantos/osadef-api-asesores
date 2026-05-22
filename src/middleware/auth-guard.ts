import type { FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config/env.js";

/**
 * Middleware que verifica autenticacion via API Key.
 * No soporta JWT porque los asesores ya estan autenticados en el portal.
 */
export async function authGuard(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Token de autenticacion requerido" });
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  // Verificar API Key
  if (token === config.apiKeyN8n) {
    request.authUser = {
      id: 0,
      role: "system",
    };
    return;
  }

  return reply.code(401).send({ error: "API Key invalida" });
}

// Tipos para el usuario autenticado
export interface AuthUser {
  id: number;
  role: "system";
}

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser;
  }
}
