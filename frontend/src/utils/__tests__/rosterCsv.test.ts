import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { parseRosterCsv } from "../rosterCsv";

describe("parseRosterCsv", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses the template header format", () => {
    const text =
      "Student ID,Name,Email,Year\n" +
      "STU901,Alex Morgan,alex.morgan@university.edu,2024";

    const students = parseRosterCsv(text);

    expect(students).toHaveLength(1);
    expect(students[0]).toMatchObject({
      studentId: "STU901",
      name: "Alex Morgan",
      email: "alex.morgan@university.edu",
      year: "2024",
      status: "active",
    });
  });

  it("parses exported roster headers", () => {
    const text =
      "id,course_id,student_id,name,email,year,created_at\n" +
      "1,4,STU402,Jamie Lee,jamie.lee@university.edu,2024,2026-04-20";

    const students = parseRosterCsv(text);

    expect(students).toHaveLength(1);
    expect(students[0].studentId).toBe("STU402");
    expect(students[0].email).toBe("jamie.lee@university.edu");
  });

  it("marks invalid email rows as errors", () => {
    const text =
      "Student ID,Name,Email,Year\n" +
      "STU777,No Email,invalid-email,2024";

    const students = parseRosterCsv(text);

    expect(students[0].status).toBe("error");
    expect(students[0].errorMessage).toBe("Invalid email format");
  });

  it("reports the file row number of each problem row", () => {
    const text =
      "Student ID,Name,Email,Year\n" +
      "STU1,Ann Lee,ann@university.edu,2024\n" +
      "\n" +
      "STU2,,bob@university.edu,2024\n" +
      ",Cat Kim,not-an-email,2024";

    const students = parseRosterCsv(text);

    expect(students.map((s) => s.rowNumber)).toEqual([2, 4, 5]);
    expect(students[0].status).toBe("active");
    expect(students[1]).toMatchObject({
      status: "error",
      errorMessage: "Missing name",
    });
    expect(students[2]).toMatchObject({
      status: "error",
      errorMessage: "Missing student ID; Invalid email format",
    });
  });

  it("flags rows with too few columns instead of skipping them", () => {
    const text = "Student ID,Name,Email,Year\nSTU1,Ann Lee";

    const students = parseRosterCsv(text);

    expect(students).toHaveLength(1);
    expect(students[0].status).toBe("error");
    expect(students[0].errorMessage).toContain("Not enough columns");
  });

  it("flags duplicate emails and student IDs within the file", () => {
    const text =
      "Student ID,Name,Email,Year\n" +
      "STU1,Ann Lee,ann@university.edu,2024\n" +
      "STU2,Ann Again,ANN@university.edu,2024\n" +
      "STU1,Other Person,other@university.edu,2024";

    const students = parseRosterCsv(text);

    expect(students[0].status).toBe("active");
    expect(students[1].errorMessage).toBe("Duplicate email (also on row 2)");
    expect(students[2].errorMessage).toBe(
      "Duplicate student ID (also on row 2)",
    );
  });

  it("throws when the file has no data rows", () => {
    const text = "Student ID,Name,Email,Year\n";

    expect(() => parseRosterCsv(text)).toThrow(
      "File must contain at least a header row and one data row",
    );
  });
});
