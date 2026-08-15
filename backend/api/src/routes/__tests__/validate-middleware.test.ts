import express from "express";
import request from "supertest";
import { validate } from "../../middleware/validate";
import {
  createCourseSchema,
  changePasswordSchema,
} from "../../middleware/schemas";

/**
 * Tests for the validate() middleware itself — ensures structured error responses.
 */

describe("validate middleware", () => {
  const buildApp = (schema: any) => {
    const app = express();
    app.use(express.json());
    app.post("/test", validate(schema), (_req, res) => {
      res.json({ ok: true, body: _req.body });
    });
    return app;
  };

  it("passes valid body through and sets parsed body on req", async () => {
    const app = buildApp(createCourseSchema);

    const res = await request(app).post("/test").send({
      courseCode: "CS101",
      title: "Intro",
      semester: "1",
      year: 2026,
      credits: 3,
      instructor: "Dr. X",
      advisorEmail: "a@b.com",
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // year & credits should be transformed to string
    expect(res.body.body.year).toBe("2026");
    expect(res.body.body.credits).toBe("3");
  });

  it("returns 400 with structured errors on invalid body", async () => {
    const app = buildApp(createCourseSchema);

    const res = await request(app).post("/test").send({ courseCode: "CS101" }); // missing many fields

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed.");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);

    // Each detail should have field and message
    for (const detail of res.body.details) {
      expect(detail).toHaveProperty("field");
      expect(detail).toHaveProperty("message");
    }
  });

  it("returns field-specific errors for password validation", async () => {
    const app = buildApp(changePasswordSchema);

    const res = await request(app).post("/test").send({ newPassword: "weak" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed.");
    expect(res.body.details.some((d: any) => d.field === "newPassword")).toBe(
      true,
    );
  });
});
