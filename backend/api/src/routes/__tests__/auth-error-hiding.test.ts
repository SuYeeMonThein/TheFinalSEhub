import express from "express";
import request from "supertest";

/**
 * Tests for Fix #5: Auth error details not leaked to clients
 */

// Mock Firebase admin so we can control token verification
jest.mock("../../config/firebase", () => ({
  adminAuth: {
    verifyIdToken: jest.fn(),
  },
}));

import { adminAuth } from "../../config/firebase";
import { verifyFirebaseAuth } from "../../middleware/auth";

const verifyIdTokenMock = adminAuth.verifyIdToken as jest.MockedFunction<
  typeof adminAuth.verifyIdToken
>;

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.get("/protected", verifyFirebaseAuth, (_req, res) => {
    res.json({ ok: true });
  });
  return app;
};

describe("Auth middleware — error hiding (Fix #5)", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
  });

  it("returns 401 without details field when token is invalid", async () => {
    verifyIdTokenMock.mockRejectedValue(
      new Error("Firebase ID token has expired"),
    );

    const res = await request(buildApp())
      .get("/protected")
      .set("Authorization", "Bearer expired-token");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
    // Must NOT contain details, message, or stack
    expect(res.body.details).toBeUndefined();
    expect(res.body.message).toBeUndefined();
    expect(res.body.stack).toBeUndefined();
  });

  it("returns 401 for missing Authorization header", async () => {
    const res = await request(buildApp()).get("/protected");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Missing or invalid Authorization header.");
  });

  it("returns 401 for non-Bearer token", async () => {
    const res = await request(buildApp())
      .get("/protected")
      .set("Authorization", "Basic abc123");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Missing or invalid Authorization header.");
  });

  it("passes through when token is valid", async () => {
    verifyIdTokenMock.mockResolvedValue({
      uid: "test-uid",
      aud: "",
      auth_time: 0,
      exp: 0,
      iat: 0,
      iss: "",
      sub: "",
      firebase: { identities: {}, sign_in_provider: "" },
    } as any);

    const res = await request(buildApp())
      .get("/protected")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
