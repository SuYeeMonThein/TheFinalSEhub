import {
  createCourseSchema,
  changePasswordSchema,
  createProjectSchema,
  createCommentSchema,
  updateGradeSchema,
  updateStatusSchema,
} from "../../middleware/schemas";

/**
 * Tests for Fix #7 (Zod input validation) and Fix #9 (Password strength)
 */

describe("Zod schemas", () => {
  // ── Fix #7: Course creation schema ──────────────────────────────────
  describe("createCourseSchema", () => {
    const validCourse = {
      courseCode: "CS101",
      title: "Intro to CS",
      semester: "1",
      year: "2026",
      credits: "3",
      instructor: "Dr. Smith",
      advisorEmail: "advisor@uni.edu",
    };

    it("accepts valid course data", () => {
      const result = createCourseSchema.safeParse(validCourse);
      expect(result.success).toBe(true);
    });

    it("rejects missing courseCode", () => {
      const { courseCode, ...rest } = validCourse;
      const result = createCourseSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects missing title", () => {
      const { title, ...rest } = validCourse;
      const result = createCourseSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects invalid advisorEmail", () => {
      const result = createCourseSchema.safeParse({
        ...validCourse,
        advisorEmail: "not-an-email",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("advisorEmail");
      }
    });

    it("accepts numeric year and credits", () => {
      const result = createCourseSchema.safeParse({
        ...validCourse,
        year: 2026,
        credits: 3,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // Should be transformed to strings
        expect(result.data.year).toBe("2026");
        expect(result.data.credits).toBe("3");
      }
    });

    it("trims whitespace from string fields", () => {
      const result = createCourseSchema.safeParse({
        ...validCourse,
        courseCode: "  CS101  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.courseCode).toBe("CS101");
      }
    });
  });

  // ── Fix #9: Password strength schema ────────────────────────────────
  describe("changePasswordSchema", () => {
    it("accepts strong password", () => {
      const result = changePasswordSchema.safeParse({
        newPassword: "MyPass1!",
      });
      expect(result.success).toBe(true);
    });

    it("rejects password shorter than 8 chars", () => {
      const result = changePasswordSchema.safeParse({ newPassword: "Ab1!" });
      expect(result.success).toBe(false);
    });

    it("rejects password without uppercase", () => {
      const result = changePasswordSchema.safeParse({
        newPassword: "mypass1!",
      });
      expect(result.success).toBe(false);
    });

    it("rejects password without lowercase", () => {
      const result = changePasswordSchema.safeParse({
        newPassword: "MYPASS1!",
      });
      expect(result.success).toBe(false);
    });

    it("rejects password without digit", () => {
      const result = changePasswordSchema.safeParse({
        newPassword: "MyPasswd!",
      });
      expect(result.success).toBe(false);
    });

    it("rejects password without special character", () => {
      const result = changePasswordSchema.safeParse({
        newPassword: "MyPasswd1",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing newPassword", () => {
      const result = changePasswordSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects non-string newPassword", () => {
      const result = changePasswordSchema.safeParse({ newPassword: 12345678 });
      expect(result.success).toBe(false);
    });
  });

  // ── Fix #7: Project schema ──────────────────────────────────────────
  describe("createProjectSchema", () => {
    it("accepts valid project", () => {
      const result = createProjectSchema.safeParse({
        title: "My Project",
        description: "A test project",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing title", () => {
      const result = createProjectSchema.safeParse({ description: "desc" });
      expect(result.success).toBe(false);
    });

    it("rejects missing description", () => {
      const result = createProjectSchema.safeParse({ title: "title" });
      expect(result.success).toBe(false);
    });

    it("rejects empty title", () => {
      const result = createProjectSchema.safeParse({
        title: "",
        description: "desc",
      });
      expect(result.success).toBe(false);
    });
  });

  // ── Fix #7: Comment schema ──────────────────────────────────────────
  describe("createCommentSchema", () => {
    it("accepts valid comment", () => {
      const result = createCommentSchema.safeParse({ content: "Hello" });
      expect(result.success).toBe(true);
    });

    it("rejects empty content", () => {
      const result = createCommentSchema.safeParse({ content: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing content", () => {
      const result = createCommentSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ── Fix #7: Grade schema ───────────────────────────────────────────
  describe("updateGradeSchema", () => {
    it("accepts valid grade and uppercases it", () => {
      const result = updateGradeSchema.safeParse({ grade: "a" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.grade).toBe("A");
      }
    });

    it("rejects empty grade", () => {
      const result = updateGradeSchema.safeParse({ grade: "" });
      expect(result.success).toBe(false);
    });
  });

  // ── Fix #7: Status schema ──────────────────────────────────────────
  describe("updateStatusSchema", () => {
    it("accepts valid status", () => {
      const result = updateStatusSchema.safeParse({ status: "approved" });
      expect(result.success).toBe(true);
    });

    it("rejects empty status", () => {
      const result = updateStatusSchema.safeParse({ status: "" });
      expect(result.success).toBe(false);
    });
  });
});
