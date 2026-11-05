import express from "express";
import request from "supertest";
import projectsRouter from "../projects";
import { getProjectById } from "../../services/projectService";
import { getProjectAccess } from "../../services/projectAccess";
import { downloadFile } from "../../services/storage";
import { getSupabaseAdminClient } from "../../services/supabaseClient";

jest.mock("../../middleware/auth", () => ({
  verifyFirebaseAuth: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    (req as any).user = {
      uid: "uid",
      email: "student@lamduan.mfu.ac.th",
      role: "student",
    };
    next();
  },
}));

jest.mock("../../services/projectService");
jest.mock("../../services/userService");
jest.mock("../../services/supabaseClient");
jest.mock("../../services/storage");
jest.mock("../../services/rosterService");
jest.mock("../../services/courseLookup");
jest.mock("../../services/projectAccess");
jest.mock("../../config/firebase", () => ({ adminAuth: {} }));

const app = express();
app.use("/projects", projectsRouter);

const fileBytes = Buffer.from("%PDF-1.4 student report");

const withFiles = (files: Array<{ name: string; storagePath: string }>) =>
  (getProjectById as jest.Mock).mockResolvedValue({
    data: [{ id: 5, metadata: { files } }],
    error: null,
  });

const download = (name: string) =>
  request(app)
    .get(`/projects/5/files/${encodeURIComponent(name)}`)
    .buffer(true)
    .parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });

describe("GET /projects/:id/files/:filename (Download button)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getProjectAccess as jest.Mock).mockResolvedValue({
      found: true,
      canAccess: true,
      isApproved: false,
    });
    (downloadFile as jest.Mock).mockResolvedValue(new Blob([fileBytes]));
  });

  it("returns the uploaded file's bytes as an attachment", async () => {
    withFiles([
      { name: "Final Report.pdf", storagePath: "projects/5/1_Final_Report.pdf" },
    ]);

    const res = await download("Final Report.pdf");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toMatch(/^attachment;/);
    expect(Buffer.compare(res.body, fileBytes)).toBe(0);
    expect(downloadFile).toHaveBeenCalledWith("projects/5/1_Final_Report.pdf");
  });

  it("downloads a file whose name contains a percent sign", async () => {
    withFiles([
      { name: "Progress 100%.pdf", storagePath: "projects/5/2_Progress_100_.pdf" },
    ]);

    const res = await download("Progress 100%.pdf");

    expect(res.status).toBe(200);
    expect(downloadFile).toHaveBeenCalledWith("projects/5/2_Progress_100_.pdf");
  });

  it("finds a stored file with spaces in its name after the project was edited", async () => {
    // An edit used to drop storagePath from the metadata, leaving only the
    // file table, where the name is stored with "_" instead of spaces.
    withFiles([{ name: "Final Report.pdf" } as any]);
    (getSupabaseAdminClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: async () => ({
            data: [{ file_link: "projects/5/1712345_Final_Report.pdf" }],
          }),
        }),
      }),
    });

    const res = await download("Final Report.pdf");

    expect(res.status).toBe(200);
    expect(downloadFile).toHaveBeenCalledWith(
      "projects/5/1712345_Final_Report.pdf",
    );
  });

  it("refuses someone with no access to an unapproved project", async () => {
    (getProjectAccess as jest.Mock).mockResolvedValue({
      found: true,
      canAccess: false,
      isApproved: false,
    });

    const res = await download("Final Report.pdf");

    expect(res.status).toBe(403);
    expect(downloadFile).not.toHaveBeenCalled();
  });
});
