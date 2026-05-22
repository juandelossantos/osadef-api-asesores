import dotenv from "dotenv";
import path from "path";

// Cargar .env según NODE_ENV
const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";

dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config({ path: path.resolve(process.cwd(), ".env") }); // fallback

export const config = {
  port: parseInt(process.env.PORT || "3003", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  apiKeyN8n: process.env.API_KEY_N8N_ASESORES || "",
} as const;

// Validar variables requeridas
export function validateEnv(): void {
  const required = ["DATABASE_URL", "API_KEY_N8N_ASESORES"] as const;
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Variables de entorno faltantes: ${missing.join(", ")}. ` +
        `Revisá tu archivo ${envFile} o .env`
    );
  }
}
