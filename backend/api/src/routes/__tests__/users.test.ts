import express from "express";
import request from "supertest";
import bcrypt from "bcryptjs";
import usersRouter from "../users";
import {
  createUser,
  findUserByEmail,
  listUsers,
} from "../../services/userService";

jest.mock("../../middleware/auth", () => ({
  verifyFirebaseAuth: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    (req as any).user = { uid: "coordinator-uid", role: "coordinator" };
    next();
  },
  requireCoordinator: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => next(),
}));

jest.mock("../../services/userService", () => {
  const actual = jest.requireActual("../../services/userService");
  return {
    ...actual,
    createUser: jest.fn(),
    findUserByEmail: jest.fn(),
    listUsers: jest.fn(),
  };
});

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/users", usersRouter);
  return app;
};

describe("POST /users", () => {
  const createUserMock = createUser as jest.MockedFunction<typeof createUser>;

  beforeEach(() => {
    createUserMock.mockReset();
  });

  it("hashes password and creates user when coordinator calls endpoint", async () => {
    createUserMock.mockResolvedValue({
      data: {
        id: 1,
        name: "Alice",
        email: "alice@example.com",
        password: "hashed",
        role: "student",
      },
      error: null,
    } as any);

    const response = await request(buildApp())
      .post("/users")
      .send({
        name: "Alice",
        email: "alice@example.com",
        password: "Secret123!",
        role: "student",
      })
      .expect(201);

    expect(response.body.user).toMatchObject({
      name: "Alice",
      email: "alice@example.com",
      role: "student",
    });
    expect(createUserMock).toHaveBeenCalledTimes(1);
    const [{ passwordHash }] = createUserMock.mock.calls[0];
    expect(passwordHash).not.toEqual("Secret123!");
    expect(await bcrypt.compare("Secret123!", passwordHash)).toBe(true);
  });

  it("rejects invalid roles", async () => {
    const response = await request(buildApp())
      .post("/users")
      .send({
        name: "Bob",
        email: "bob@example.com",
        password: "Secret123!",
        role: "invalid",
      })
      .expect(400);

    expect(response.body.error).toMatch(/Coordinators cannot|Invalid role/i);
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("maps duplicate email errors to HTTP 409", async () => {
    createUserMock.mockResolvedValue({
      data: null,
      error: { message: "duplicate key value", code: "23505" },
    } as any);

    const response = await request(buildApp())
      .post("/users")
      .send({
        name: "Eve",
        email: "eve@example.com",
        password: "Secret123!",
        role: "advisor",
      })
      .expect(409);

    expect(response.body.error).toMatch(/already in use/i);
  });
});

describe("GET /users", () => {
  const findUserByEmailMock = findUserByEmail as jest.MockedFunction<
    typeof findUserByEmail
  >;
  const listUsersMock = listUsers as jest.MockedFunction<typeof listUsers>;

  beforeEach(() => {
    findUserByEmailMock.mockReset();
    listUsersMock.mockReset();
  });

  it("returns all users when no email filter provided", async () => {
    listUsersMock.mockResolvedValue({
      data: [
        {
          id: 1,
          name: "Alice",
          email: "alice@example.com",
          password: "hash",
          role: "student",
        },
        {
          id: 2,
          name: "Bob",
          email: "bob@example.com",
          password: "hash",
          role: "advisor",
        },
      ],
      error: null,
    } as any);

    const response = await request(buildApp()).get("/users").expect(200);

    expect(response.body.users).toHaveLength(2);
    expect(listUsersMock).toHaveBeenCalledTimes(1);
  });

  it("returns a single user when email filter provided", async () => {
    findUserByEmailMock.mockResolvedValue({
      data: {
        id: 3,
        name: "Carol",
        email: "carol@example.com",
        password: "hash",
        role: "coordinator",
      },
      error: null,
    } as any);

    const response = await request(buildApp())
      .get("/users")
      .query({ email: "carol@example.com" })
      .expect(200);

    expect(response.body.user).toMatchObject({ email: "carol@example.com" });
    expect(findUserByEmailMock).toHaveBeenCalledWith("carol@example.com");
  });

  it("returns 404 when filtered email not found", async () => {
    findUserByEmailMock.mockResolvedValue({ data: null, error: null } as any);

    const response = await request(buildApp())
      .get("/users")
      .query({ email: "missing@example.com" })
      .expect(404);

    expect(response.body.error).toMatch(/not found/i);
  });
});
