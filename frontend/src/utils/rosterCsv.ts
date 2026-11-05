export interface ParsedRosterStudent {
  id: string;
  /** Line number in the CSV file, counting the header as row 1 (as a spreadsheet shows it). */
  rowNumber: number;
  studentId: string;
  name: string;
  email: string;
  year: string;
  status: "active" | "error";
  errorMessage?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeHeader = (value: string): string => value.trim().toLowerCase();

const findHeaderIndex = (headers: string[], keys: string[]): number => {
  for (const key of keys) {
    const index = headers.indexOf(key);
    if (index >= 0) {
      return index;
    }
  }
  return -1;
};

export const parseRosterCsv = (text: string): ParsedRosterStudent[] => {
  // Keep each line's position in the file so errors can point at the real row.
  const lines = text
    .split(/\r?\n/)
    .map((line, index) => ({ text: line.trim(), rowNumber: index + 1 }))
    .filter((line) => line.text.length > 0);

  if (lines.length < 2) {
    throw new Error("File must contain at least a header row and one data row");
  }

  const headers = lines[0].text.split(",").map(normalizeHeader);
  const studentIdIndex = findHeaderIndex(headers, ["student id", "student_id"]);
  const nameIndex = findHeaderIndex(headers, ["name"]);
  const emailIndex = findHeaderIndex(headers, ["email"]);
  const yearIndex = findHeaderIndex(headers, ["year"]);

  const students: ParsedRosterStudent[] = [];
  const rowByEmail = new Map<string, number>();
  const rowByStudentId = new Map<string, number>();

  for (let i = 1; i < lines.length; i += 1) {
    const { text: line, rowNumber } = lines[i];
    const values = line.split(",").map((value) => value.trim());

    const studentId =
      (studentIdIndex >= 0 ? values[studentIdIndex] : values[0]) ?? "";
    const name = (nameIndex >= 0 ? values[nameIndex] : values[1]) ?? "";
    const email = (emailIndex >= 0 ? values[emailIndex] : values[2]) ?? "";
    const year = (yearIndex >= 0 ? values[yearIndex] : values[3]) ?? "";

    const errors: string[] = [];
    if (values.length < 3) {
      errors.push("Not enough columns (expected Student ID, Name, Email, Year)");
    } else {
      if (!studentId) errors.push("Missing student ID");
      if (!name) errors.push("Missing name");
      if (!email) {
        errors.push("Missing email");
      } else if (!EMAIL_PATTERN.test(email)) {
        errors.push("Invalid email format");
      }
    }

    const emailKey = email.toLowerCase();
    if (emailKey && rowByEmail.has(emailKey)) {
      errors.push(`Duplicate email (also on row ${rowByEmail.get(emailKey)})`);
    } else if (emailKey) {
      rowByEmail.set(emailKey, rowNumber);
    }

    if (studentId && rowByStudentId.has(studentId)) {
      errors.push(
        `Duplicate student ID (also on row ${rowByStudentId.get(studentId)})`,
      );
    } else if (studentId) {
      rowByStudentId.set(studentId, rowNumber);
    }

    students.push({
      id: `${Date.now()}${i}`,
      rowNumber,
      studentId,
      name,
      email,
      year: year || "2024",
      status: errors.length > 0 ? "error" : "active",
      errorMessage: errors.length > 0 ? errors.join("; ") : undefined,
    });
  }

  return students;
};
