import { sendWelcomeEmail, sendBulkWelcomeEmails } from "../../services/emailService";
import { adminAuth } from "../../config/firebase";

jest.mock("../../config/firebase", () => ({
  adminAuth: { generatePasswordResetLink: jest.fn() },
}));

const sentBodies: string[] = [];

beforeEach(() => {
  sentBodies.length = 0;
  process.env.BREVO_API_KEY = "test-key";
  global.fetch = jest.fn(async (_url: unknown, init?: { body?: string }) => {
    sentBodies.push(String(init?.body));
    return { ok: true, text: async () => "" } as Response;
  }) as unknown as typeof fetch;
  (adminAuth.generatePasswordResetLink as jest.Mock).mockResolvedValue(
    "https://example.test/reset?oobCode=abc",
  );
});

describe("welcome emails", () => {
  it("contains a set-password link and never a password", async () => {
    await sendWelcomeEmail({ name: "Stu", email: "stu@lamduan.mfu.ac.th", role: "student" });

    const body = sentBodies[0];
    expect(body).toContain("https://example.test/reset?oobCode=abc");
    expect(body.toLowerCase()).not.toContain("password:");
    expect(body).not.toContain("Student@123");
  });

  it("falls back to the Forgot password instructions when no link can be made", async () => {
    (adminAuth.generatePasswordResetLink as jest.Mock).mockRejectedValue(new Error("no account"));
    await sendWelcomeEmail({ name: "Stu", email: "stu@lamduan.mfu.ac.th", role: "student" });

    expect(sentBodies[0]).toContain("Forgot password?");
  });

  it("bulk welcome emails do not take or send a shared default password", async () => {
    const result = await sendBulkWelcomeEmails([
      { name: "A", email: "a@lamduan.mfu.ac.th", rollNumber: "1" },
    ]);
    expect(result.success).toBe(1);
    expect(sentBodies.join("")).not.toContain("Student@123");
  });
});
