import { test, expect } from "@playwright/test";
import { ChildProcess, spawn } from "child_process";
import path from "path";
import dotenv from "dotenv";

// Cargar variables de entorno para el proceso de tests
dotenv.config({ path: path.resolve(__dirname, "..", ".env.development") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// ─── Configuracion ──────────────────────────────────────────────

const BASE_URL = "http://localhost:3003";
const API_KEY = process.env.API_KEY_N8N_ASESORES!;
const CUIL_TEST = "20120667468"; // CUIL de prueba (validar contra BD real)

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

  // ─── 5. Autorizaciones ──────────────────────────────────────

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
        expect(item.codmonodroga).toBeDefined();
        expect(item.monodroga).toBeDefined();
        expect(item.cantidad).toBeDefined();
        expect(item.idporcentaje).toBeDefined();
      }
    }
  });

  test("GET /autorizaciones — filtro por monodroga", async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/autorizaciones?cuil=${CUIL_TEST}&monodroga=atorvastat`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
    );

    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      for (const item of body.data) {
        expect(item.monodroga.toUpperCase()).toContain("ATORVASTAT");
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
