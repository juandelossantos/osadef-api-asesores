import dotenv from "dotenv";
import path from "path";

// Cargar .env según NODE_ENV
const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";

dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config({ path: path.resolve(process.cwd(), ".env") }); // fallback

// Multi-key desde acá (mismo patrón que cartilla-adef, src/config/env.js):
// el mapa key→etiqueta se arma solo leyendo variables de entorno al
// arrancar — agregar un consumidor nuevo es una variable de entorno más,
// cero cambios de código. `API_KEY_N8N_ASESORES` (nombre histórico) sigue
// siendo la key real que ya tiene cargada el workflow de n8n/ElevenLabs —
// no se renombra para no tener que tocar esa credencial ya en uso; acá
// solo se la registra en el mapa con la etiqueta fija "n8n" para que el
// resto del código tenga un único camino de lookup.
//
// Object.create(null), NO {}: un objeto literal hereda de Object.prototype,
// así que map['constructor']/['toString']/['hasOwnProperty'] resuelven a
// una propiedad heredada (no un string) en vez de undefined — sin esto, un
// atacante sin ninguna key real podría autenticarse mandando
// "Authorization: Bearer constructor" (hallazgo real ya corregido en
// cartilla-adef, mismo bug si se copiara el patrón sin este detalle).
// Exportada (no solo interna) para poder testear la lógica de colisión de
// keys duplicadas de forma aislada, sin tener que levantar el server real
// con env vars especiales (ver tests/api.spec.ts).
export function construirMapaApiKeys(): Record<string, string> {
  const map: Record<string, string> = Object.create(null);

  if (process.env.API_KEY_N8N_ASESORES) {
    map[process.env.API_KEY_N8N_ASESORES] = "n8n";
  }

  for (const [envKey, value] of Object.entries(process.env)) {
    const match = envKey.match(/^API_KEY_ASESORES_(.+)$/);
    if (match && value) {
      const etiqueta = match[1].toLowerCase();
      // Dos variables con el mismo valor de key (ej. copy-paste al armar
      // el .env, o esta variable nueva reusando por error el mismo valor
      // que API_KEY_N8N_ASESORES) NO se pisan: gana la primera etiqueta
      // registrada (orden de inserción de Object.entries) y se avisa por
      // consola — sin esto, el tráfico real de un consumidor existente
      // (ej. n8n) quedaría atribuido en silencio a la etiqueta nueva.
      if (map[value] && map[value] !== etiqueta) {
        // eslint-disable-next-line no-console
        console.warn(
          `[config] API_KEY_ASESORES_${match[1]} tiene el mismo valor que la key de "${map[value]}" — ` +
            `los requests con esa key se van a seguir atribuyendo a "${map[value]}", revisar el .env`
        );
        continue;
      }
      map[value] = etiqueta;
    }
  }

  return map;
}

export const config = {
  port: parseInt(process.env.PORT || "3003", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  apiKeys: construirMapaApiKeys(),
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
