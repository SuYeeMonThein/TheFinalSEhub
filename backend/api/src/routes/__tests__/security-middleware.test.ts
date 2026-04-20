import request from "supertest";
import { createApp } from "../../app";

/**
 * Tests for Fix #3 (CORS), #4 (Rate Limiting), #6 (Helmet), #8 (Swagger in production)
 */

describe("Security middleware", () => {
  const app = createApp();

  // ── Fix #6: Helmet security headers ──────────────────────────────────
  describe("Helmet headers", () => {
    it("sets X-Content-Type-Options header", async () => {
      const res = await request(app).get("/health");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("sets X-Frame-Options header", async () => {
      const res = await request(app).get("/health");
      expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    });

    it("removes X-Powered-By header", async () => {
      const res = await request(app).get("/health");
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });
  });

  // ── Fix #3: CORS lockdown ───────────────────────────────────────────
  describe("CORS", () => {
    it("allows requests from configured origin", async () => {
      const res = await request(app)
        .get("/health")
        .set("Origin", "http://localhost:8080");
      expect(res.headers["access-control-allow-origin"]).toBe(
        "http://localhost:8080",
      );
    });

    it("rejects requests from unknown origins", async () => {
      const res = await request(app)
        .get("/health")
        .set("Origin", "http://evil-site.com");
      // CORS middleware won't set the allow-origin header for disallowed origins
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  // ── Fix #8: Swagger docs protection ─────────────────────────────────
  describe("Swagger docs", () => {
    it("serves /docs in non-production (default test env)", async () => {
      // In test env (not production), docs should be available
      const res = await request(app).get("/docs/");
      // Should return 200 or 301 (redirect to trailing slash), not 404
      expect([200, 301]).toContain(res.status);
    });

    it("blocks /docs in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      // Create a fresh app with production env
      const prodApp = createApp();

      const res = await request(prodApp).get("/docs/");
      expect(res.status).toBe(404);

      process.env.NODE_ENV = originalEnv;
    });

    it("blocks /docs.json in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const prodApp = createApp();

      const res = await request(prodApp).get("/docs.json");
      expect(res.status).toBe(404);

      process.env.NODE_ENV = originalEnv;
    });
  });
});
