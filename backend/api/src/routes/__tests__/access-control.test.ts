import express from "express";
import request from "supertest";
import projectsRouter from "../projects";
import commentsRouter from "../comments";
import coursesRouter from "../courses";
import studentsRouter from "../students";
import { getProjectAccess } from "../../services/projectAccess";
import { findUserByEmail } from "../../services/userService";

let currentRole = "student";

jest.mock("../../middleware/auth", () => ({
  verifyFirebaseAuth: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    (req as any).user = {
      uid: "uid",
      email: "someone@lamduan.mfu.ac.th",
      role: currentRole,
    };
    next();
  },
  requireCoordinator: (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => (currentRole === "coordinator" ? next() : res.status(403).json({ error: "Forbidden" })),
  requireAdvisor: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock("../../services/projectService");
jest.mock("../../services/userService");
jest.mock("../../services/supabaseClient");
jest.mock("../../services/storage");
jest.mock("../../services/rosterService");
jest.mock("../../services/courseLookup");
jest.mock("../../services/projectAccess");
jest.mock("../../config/firebase", () => ({ adminAuth: {} }));

const access = getProjectAccess as jest.Mock;
const asAccess = (o: { found?: boolean; canAccess?: boolean; isApproved?: boolean }) =>
  access.mockResolvedValue({ found: true, canAccess: false, isApproved: false, ...o });

const app = express();
app.use(express.json());
app.use("/projects", projectsRouter);
app.use("/comments", commentsRouter);
app.use("/courses", coursesRouter);
app.use("/students", studentsRouter);

const pdf = Buffer.from("%PDF-1.4 test");

describe("project file access", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentRole = "student";
  });

  it("blocks a student who is not on the team from uploading files", async () => {
    asAccess({ canAccess: false });
    const res = await request(app)
      .post("/projects/5/files")
      .attach("files", pdf, { filename: "a.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(403);
  });

  it("does not let an advisor change project files", async () => {
    currentRole = "advisor";
    asAccess({ canAccess: true });
    const res = await request(app)
      .post("/projects/5/files")
      .attach("files", pdf, { filename: "a.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(403);
  });

  it("blocks a student who is not on the team from deleting a file", async () => {
    asAccess({ canAccess: false });
    const res = await request(app).delete("/projects/5/files/a.pdf");
    expect(res.status).toBe(403);
  });

  it("blocks downloading files of someone else's unapproved project", async () => {
    asAccess({ canAccess: false, isApproved: false });
    const res = await request(app).get("/projects/5/files/a.pdf");
    expect(res.status).toBe(403);
  });

  it("allows downloading files of an approved (archived) project", async () => {
    asAccess({ canAccess: false, isApproved: true });
    const res = await request(app).get("/projects/5/files/a.pdf");
    expect(res.status).not.toBe(403);
  });

  it("allows a team member through the download check", async () => {
    asAccess({ canAccess: true });
    const res = await request(app).get("/projects/5/files/a.pdf");
    expect(res.status).not.toBe(403);
  });
});

describe("project comments access", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentRole = "student";
  });

  it("rejects a comment longer than 2000 characters", async () => {
    asAccess({ canAccess: true });
    const res = await request(app)
      .post("/comments/5")
      .send({ comment: "a".repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2000/);
  });

  it("blocks reading comments of a project the user is not part of", async () => {
    asAccess({ canAccess: false, isApproved: true });
    const res = await request(app).get("/comments/5");
    expect(res.status).toBe(403);
  });

  it("blocks posting a comment on a project the user is not part of", async () => {
    asAccess({ canAccess: false });
    (findUserByEmail as jest.Mock).mockResolvedValue({ data: { id: 1 }, error: null });
    const res = await request(app).post("/comments/5").send({ comment: "hi" });
    expect(res.status).toBe(403);
  });

  it("returns 404 for a project that does not exist", async () => {
    access.mockResolvedValue({ found: false, canAccess: false, isApproved: false });
    const res = await request(app).get("/comments/5");
    expect(res.status).toBe(404);
  });
});

describe("staff-only lists", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentRole = "student";
    (findUserByEmail as jest.Mock).mockResolvedValue({
      data: { id: 1, role: "student", email: "someone@lamduan.mfu.ac.th" },
      error: null,
    });
  });

  it("does not give students the full course list", async () => {
    const res = await request(app).get("/courses");
    expect(res.status).toBe(403);
  });

  it("does not give students a course's project list", async () => {
    const res = await request(app).get("/courses/17/projects");
    expect(res.status).toBe(403);
  });

  it("does not give students the invited-students list", async () => {
    const res = await request(app).get("/students");
    expect(res.status).toBe(403);
  });
});

describe("archive paging validation", () => {
  it.each(["limit=abc", "limit=0", "limit=101", "page=-5", "page=1.5"])(
    "rejects %s",
    async (query) => {
      const res = await request(app).get(`/projects/archive?${query}`);
      expect(res.status).toBe(400);
    },
  );
});
