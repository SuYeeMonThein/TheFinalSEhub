import express from "express";
import request from "supertest";
import projectsRouter from "../projects";
import {
  createProjectRecord,
  getProjectById,
  insertProjectLinks,
  upsertProjectStudents,
} from "../../services/projectService";
import { findUserByEmail, findUserById } from "../../services/userService";
import { getSupabaseAdminClient } from "../../services/supabaseClient";

jest.mock("../../middleware/auth", () => ({
  verifyFirebaseAuth: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    (req as any).user = {
      uid: "student-uid",
      email: "student@lamduan.mfu.ac.th",
      role: "student",
    };
    next();
  },
}));

jest.mock("../../services/projectService", () => ({
  createProjectRecord: jest.fn(),
  getProjectById: jest.fn(),
  insertProjectLinks: jest.fn(),
  upsertProjectStudents: jest.fn(),
}));

jest.mock("../../services/userService", () => ({
  findUserByEmail: jest.fn(),
  findUserById: jest.fn(),
}));

jest.mock("../../services/supabaseClient", () => ({
  getSupabaseAdminClient: jest.fn(),
}));

jest.mock("../../services/storage", () => ({
  uploadFile: jest.fn(),
  downloadFile: jest.fn(),
  deleteFile: jest.fn(),
}));

const student = {
  id: 1,
  name: "Stu",
  email: "student@lamduan.mfu.ac.th",
  role: "student",
};
const advisor = {
  id: 7,
  name: "Dr. Advisor",
  email: "advisor@mfu.ac.th",
  role: "advisor",
};

const mockCourse = (course: unknown) => {
  (getSupabaseAdminClient as jest.Mock).mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: course }),
          single: async () => ({ data: course }),
        }),
      }),
    }),
  });
};

const app = express();
app.use(express.json());
app.use("/projects", projectsRouter);

const post = (body: Record<string, unknown>) =>
  request(app)
    .post("/projects")
    .send({ title: "T", description: "D", ...body });

describe("POST /projects course advisor auto-fill", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (findUserByEmail as jest.Mock).mockImplementation(async (email: string) => ({
      data: [student, advisor].find((u) => u.email === email) ?? null,
    }));
    (findUserById as jest.Mock).mockImplementation(async (id: number) => ({
      data: id === advisor.id ? advisor : null,
    }));
    (createProjectRecord as jest.Mock).mockResolvedValue({ data: { id: 99 } });
    (upsertProjectStudents as jest.Mock).mockResolvedValue({});
    (insertProjectLinks as jest.Mock).mockResolvedValue({});
    (getProjectById as jest.Mock).mockResolvedValue({ data: [] });
  });

  const created = () => (createProjectRecord as jest.Mock).mock.calls[0][0];

  it("adds the course advisor as a lecturer member and project advisor", async () => {
    mockCourse({ id: 5, advisor_id: 7 });
    const res = await post({ courseCode: "1305394" });

    expect(res.status).toBe(201);
    expect(created().advisorId).toBe(7);
    expect(created().courseId).toBe(5);
    expect(created().metadata.teamMembers).toContainEqual(
      expect.objectContaining({ email: advisor.email, role: "lecturer" }),
    );
  });

  it("keeps a manually added advisor instead of the course advisor", async () => {
    mockCourse({ id: 5, advisor_id: 7 });
    const res = await post({
      courseCode: "1305394",
      teamMembers: [{ email: "other@mfu.ac.th", role: "lecturer" }],
    });

    expect(res.status).toBe(201);
    const lecturers = created().metadata.teamMembers.filter(
      (m: { role: string }) => m.role === "lecturer",
    );
    expect(lecturers).toHaveLength(1);
    expect(lecturers[0].email).toBe("other@mfu.ac.th");
  });

  it("adds no advisor when the course code is unknown", async () => {
    mockCourse(null);
    const res = await post({ courseCode: "nope" });

    expect(res.status).toBe(201);
    expect(created().advisorId).toBeNull();
    expect(
      created().metadata.teamMembers.some(
        (m: { role: string }) => m.role === "lecturer",
      ),
    ).toBe(false);
  });
});
