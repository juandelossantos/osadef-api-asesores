import { test, expect } from "@playwright/test";
import { ChildProcess, spawn } from "child_process";
import path from "path";
import dotenv from "dotenv";
import { construirMapaApiKeys } from "../src/config/env";

// Cargar variables de entorno para el proceso de tests
dotenv.config({ path: path.resolve(__dirname, "..", ".env.development") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// ─── Configuracion ──────────────────────────────────────────────

const BASE_URL = "http://localhost:3003";
const API_KEY = process.env.API_KEY_N8N_ASESORES!;
const CUIL_TEST = "20120667468"; // CUIL de prueba (validar contra BD real)
const CUIL_TEST_SIN_CUD = CUIL_TEST; // mismo CUIL: confirmado cud.tiene=false
const CUIL_FAMILIAR_TEST = "20005148562"; // familiar real (llx_familiar), confirmado tipo="familiar"

let server: ChildProcess;

// ─── Todos los tests en un solo describe para controlar lifecycle ─

test.describe("API OSADEF Asesores — Tests de integracion HTTP", () => {
  // ─── Arrancar servidor ──────────────────────────────────────

  test.beforeAll(async () => {
    try {
      const check = await fetch(`${BASE_URL}/health`);
      if (check.ok) {
        console.log("Servidor ya estaba corriendo");
        return;
      }
    } catch {
      // No esta corriendo, arrancarlo
    }

    server = spawn("npx", ["tsx", "src/index.ts"], {
      cwd: path.resolve(__dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: { ...process.env },
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout esperando al servidor (15s)"));
      }, 15000);

      const onData = (data: Buffer) => {
        const output = data.toString();
        if (output.includes("API OSADEF Asesores corriendo")) {
          clearTimeout(timeout);
          resolve();
        }
      };

      server.stdout?.on("data", onData);
      server.stderr?.on("data", onData);

      server.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`Error al iniciar servidor: ${err.message}`));
      });

      server.on("exit", (code) => {
        clearTimeout(timeout);
        reject(
          new Error(`Servidor termino inesperadamente con codigo ${code}`),
        );
      });
    });

    console.log("Servidor levantado");
  });

  // ─── Cerrar servidor ────────────────────────────────────────

  test.afterAll(async () => {
    if (server && !server.killed) {
      server.kill();
      console.log("Servidor detenido");
    }
  });

  // ─── 1. Health Check ────────────────────────────────────────

  test("GET /health — responde 200 sin auth", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`);

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
    expect(body.environment).toBe("development");
  });

  // ─── 2. Endpoints sin auth deben fallar ─────────────────────

  test("GET /autorizaciones sin API Key — 401", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/autorizaciones?cuil=${CUIL_TEST}`);
    expect(response.status()).toBe(401);
  });

  test("GET /cronicidad sin API Key — 401", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/cronicidad?cuil=${CUIL_TEST}`);
    expect(response.status()).toBe(401);
  });

  test("GET /afiliados/exists sin API Key — 401", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/afiliados/exists?cuil=${CUIL_TEST}`);
    expect(response.status()).toBe(401);
  });

  test("API Key invalida — 401", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/autorizaciones?cuil=${CUIL_TEST}`, {
      headers: { Authorization: "Bearer token-invalido-123" },
    });
    expect(response.status()).toBe(401);
  });

  // ─── 2b. Multi-key (auth-guard.ts + config/env.ts) ──────────

  test("API Key de un consumidor nuevo (API_KEY_ASESORES_WIDGET_CHAT) autentica igual que la de n8n", async ({ request }) => {
    const keyConsumidorNuevo = process.env.API_KEY_ASESORES_WIDGET_CHAT;
    // Si el .env de este ambiente no tiene esa variable, el test no aplica
    // acá (ver .env.example de este repo) — no es un fallo del código.
    test.skip(!keyConsumidorNuevo, "API_KEY_ASESORES_WIDGET_CHAT no está configurada en este .env");

    const response = await request.get(`${BASE_URL}/afiliados/exists?cuil=${CUIL_TEST}`, {
      headers: { Authorization: `Bearer ${keyConsumidorNuevo}` },
    });
    expect(response.status()).toBe(200);
  });

  test("API Key de n8n sigue funcionando sin cambios (compatibilidad hacia atrás)", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/afiliados/exists?cuil=${CUIL_TEST}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    expect(response.status()).toBe(200);
  });

  test("construirMapaApiKeys() — una key nueva que reusa por error el mismo valor que la de n8n NO le roba la etiqueta (gana la primera registrada)", () => {
    const valorCompartido = "valor-de-prueba-reusado-por-error";
    const envOriginal = {
      API_KEY_N8N_ASESORES: process.env.API_KEY_N8N_ASESORES,
      API_KEY_ASESORES_OTRO: process.env.API_KEY_ASESORES_OTRO,
    };

    process.env.API_KEY_N8N_ASESORES = valorCompartido;
    process.env.API_KEY_ASESORES_OTRO = valorCompartido;

    try {
      const mapa = construirMapaApiKeys();
      expect(mapa[valorCompartido]).toBe("n8n");
    } finally {
      // Restaurar exactamente como estaba — este test corre en el mismo
      // proceso que el resto (no hay aislamiento de process.env entre
      // tests de Playwright).
      if (envOriginal.API_KEY_N8N_ASESORES === undefined) delete process.env.API_KEY_N8N_ASESORES;
      else process.env.API_KEY_N8N_ASESORES = envOriginal.API_KEY_N8N_ASESORES;
      if (envOriginal.API_KEY_ASESORES_OTRO === undefined) delete process.env.API_KEY_ASESORES_OTRO;
      else process.env.API_KEY_ASESORES_OTRO = envOriginal.API_KEY_ASESORES_OTRO;
    }
  });

  // ─── 3. Validaciones de input ───────────────────────────────

  test("GET /autorizaciones sin ?cuil — 400", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/autorizaciones`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("cuil");
  });

  test("GET /autorizaciones con cuil invalido — 400", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/autorizaciones?cuil=123`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    expect(response.status()).toBe(400);
  });

  test("GET /cronicidad sin ?cuil — 400", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/cronicidad`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    expect(response.status()).toBe(400);
  });

  // ─── 4. Afiliados exists ────────────────────────────────────

  test("GET /afiliados/exists — afiliado existente", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/afiliados/exists?cuil=${CUIL_TEST}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.cuil).toBe(CUIL_TEST);
    expect(typeof body.exists).toBe("boolean");
    // Si existe, tipo debe ser titular o familiar
    if (body.exists) {
      expect(["titular", "familiar"]).toContain(body.tipo);
    }
  });

  test("GET /afiliados/exists?include=basico — no explota con un titular (regresión: llx_afiliado no tiene columna `nombre`)", async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/afiliados/exists?cuil=${CUIL_TEST}&include=basico`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    if (body.exists && body.tipo === "titular") {
      expect(body.afiliado).toBeDefined();
      expect(body.afiliado.nombre).toBeNull();
      expect(typeof body.afiliado.apellido).toBe("string");
    }
  });

  test("GET /afiliados/exists?include=cud — cud.estado es JSON null (no \"\") cuando tiene=false (regresión: schema sin nullable coercionaba a string vacío)", async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/afiliados/exists?cuil=${CUIL_TEST_SIN_CUD}&include=cud`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.cud).toBeDefined();
    expect(body.cud.tiene).toBe(false);
    expect(body.cud.estado).toBeNull();
  });

  test("GET /afiliados/exists?include=basico — afiliado.plan es JSON null (no \"\") para un familiar (regresión: mismo bug de nullable que nombre/estado)", async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/afiliados/exists?cuil=${CUIL_FAMILIAR_TEST}&include=basico`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.tipo).toBe("familiar");
    expect(body.afiliado).toBeDefined();
    expect(body.afiliado.plan).toBeNull();
  });

  // ─── 5. Autorizaciones (medicamentos + prácticas) ────────────

  test("GET /autorizaciones — con API Key y cuil valido", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/autorizaciones?cuil=${CUIL_TEST}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect([200, 404]).toContain(response.status());
    const body = await response.json();

    if (response.status() === 200) {
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.count).toBe("number");

      if (body.data.length > 0) {
        const item = body.data[0];
        expect(item.numeroautorizacion).toBeDefined();
        expect(item.nroafiliado).toBeDefined();
        expect(item.fecha).toBeDefined();
        expect(item.fechavencimiento).toBeDefined();
        expect(item.codigo).toBeDefined();
        expect(item.nombre).toBeDefined();
        expect(item.tipo).toBeDefined();
        if (item.tipo === "medicamento") {
          expect(item.cobertura).toBeDefined();
        } else if (item.tipo === "prestacion") {
          expect(item.potencia).toBeDefined();
        }
      }
    }
  });

  test("GET /autorizaciones — filtro por nombre", async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/autorizaciones?cuil=${CUIL_TEST}&nombre=atorvastat`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
    );
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.data.length).toBeGreaterThan(0);
      for (const item of body.data) {
        if (item.tipo === "medicamento") {
          expect(item.nombre.toUpperCase()).toContain("ATORVASTAT");
        }
      }
    }
  });

  test("GET /autorizaciones — contiene tipo prestacion en respuesta", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/autorizaciones?cuil=${CUIL_TEST}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      const hasPrestaciones = body.data.some((item: any) => item.tipo === "prestacion");
      // Puede o no haber prestaciones para este CUIL, pero tipo debe estar presente
      for (const item of body.data) {
        expect(["medicamento", "prestacion"]).toContain(item.tipo);
      }
    }
  });

  // ─── 6. Cronicidad ──────────────────────────────────────────

  test("GET /cronicidad — con API Key y cuil valido", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/cronicidad?cuil=${CUIL_TEST}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect([200, 404]).toContain(response.status());
    const body = await response.json();

    if (response.status() === 200) {
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.count).toBe("number");

      if (body.data.length > 0) {
        const item = body.data[0];
        expect(item.nroafiliado).toBeDefined();
        expect(item.cronicidad).toBeDefined();
        expect(item.monodroga).toBeDefined();
        expect(item.codmonodroga).toBeDefined();
        expect(item.mensual).toBeDefined();
        expect(item.cobertura).toBeDefined();
        expect(item.fecha).toBeDefined();
        expect(item.fechavencimiento).toBeDefined();
      }
    }
  });

  // ─── 7. CORS ────────────────────────────────────────────────

  test("CORS — permite origin externo", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`, {
      headers: { Origin: "https://asesores.osadef.org.ar" },
    });

    expect(response.status()).toBe(200);
    const corsHeader = response.headers()["access-control-allow-origin"];
    expect(corsHeader).toBeDefined();
  });

  test("CORS — preflight OPTIONS", async ({ request }) => {
    const response = await request.fetch(`${BASE_URL}/health`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://asesores.osadef.org.ar",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect([200, 204]).toContain(response.status());
    const allowMethods = response.headers()["access-control-allow-methods"];
    expect(allowMethods).toContain("GET");
  });
});
