import express from "express";
import request from "supertest";
import usersRouter from "../users";
import { findUserById } from "../../services/userService";
import { getSupabaseAdminClient } from "../../services/supabaseClient";

jest.mock("../../middleware/auth", () => ({
  verifyFirebaseAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).user = { uid: "coord", email: "coord@mfu.ac.th", role: "coordinator" };
    next();
  },
  requireCoordinator: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock("../../services/userService");
jest.mock("../../services/supabaseClient");
jest.mock("../../services/emailService", () => ({ sendWelcomeEmail: jest.fn() }));
jest.mock("../../config/firebase", () => ({
  adminAuth: {
    getUserByEmail: jest.fn().mockResolvedValue({ uid: "x" }),
    updateUser: jest.fn().mockResolvedValue({}),
    setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
    deleteUser: jest.fn().mockResolvedValue(undefined),
  },
}));

// A chainable stand-in for the Supabase query builder: every call returns the
// same object, and awaiting it resolves to `result`.
const chain = (result: unknown) => {
  const q: any = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result);
        return () => q;
      },
    },
  );
  return q;
};

const app = express();
app.use(express.json());
app.use("/users", usersRouter);

const coordinator = { id: 7, name: "Coord", email: "c@mfu.ac.th", role: "coordinator" };

const setOtherCoordinators = (otherIds: number[]) => {
  (getSupabaseAdminClient as jest.Mock).mockReturnValue({
    from: (table: string) =>
      chain(
        table === "user"
          ? { data: otherIds.map((id) => ({ id })), error: null }
          : { data: [], error: null },
      ),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  (findUserById as jest.Mock).mockResolvedValue({ data: coordinator, error: null });
});

describe("the last coordinator is protected", () => {
  it("cannot be demoted with PATCH /users/:id", async () => {
    setOtherCoordinators([]);
    const res = await request(app).patch("/users/7").send({ role: "advisor" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least one coordinator/i);
  });

  it("cannot lose the coordinator role with PUT /users/:id/roles", async () => {
    setOtherCoordinators([]);
    const res = await request(app).put("/users/7/roles").send({ roles: ["advisor"] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least one coordinator/i);
  });

  it("cannot be deleted", async () => {
    setOtherCoordinators([]);
    const res = await request(app).delete("/users/7");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least one coordinator/i);
  });
});
