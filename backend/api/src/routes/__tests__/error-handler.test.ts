import express from "express";
import request from "supertest";
import { errorHandler } from "../../middleware/errorHandler";

describe("error handler", () => {
  const buildApp = () => {
    const app = express();
    app.use(express.json());

    app.post("/json", (_req, res) => {
      res.json({ ok: true });
    });

    app.get("/boom", (_req, _res) => {
      throw new Error("boom");
    });

    app.use(errorHandler);
    return app;
  };

  it("returns a generic 500 response without leaking details", async () => {
    const res = await request(buildApp()).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error." });
    expect(res.body.stack).toBeUndefined();
    expect(res.body.message).toBeUndefined();
  });

  it("returns 400 for invalid JSON payloads", async () => {
    const res = await request(buildApp())
      .post("/json")
      .set("Content-Type", "application/json")
      .send("{\"bad\":");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid JSON payload." });
  });
});
