export interface ParsedRosterStudent {
  id: string;
  studentId: string;
  name: string;
  email: string;
  year: string;
  status: "active" | "error";
  errorMessage?: string;
}

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
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error("File must contain at least a header row and one data row");
  }

  const headers = lines[0].split(",").map(normalizeHeader);
  const studentIdIndex = findHeaderIndex(headers, ["student id", "student_id"]);
  const nameIndex = findHeaderIndex(headers, ["name"]);
  const emailIndex = findHeaderIndex(headers, ["email"]);
  const yearIndex = findHeaderIndex(headers, ["year"]);

  const students: ParsedRosterStudent[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = lines[i].split(",").map((value) => value.trim());

    if (values.length < 3) {
      continue;
    }

    const studentId =
      studentIdIndex >= 0 ? values[studentIdIndex] : values[0];
    const name = nameIndex >= 0 ? values[nameIndex] : values[1];
    const email = emailIndex >= 0 ? values[emailIndex] : values[2];
    const year = yearIndex >= 0 ? values[yearIndex] : values[3];

    const student: ParsedRosterStudent = {
      id: `${Date.now()}${i}`,
      studentId: studentId || `STU${Date.now()}${i}`,
      name: name || "Unknown Student",
      email: email || "",
      year: year || "2024",
      status: "active",
    };

    if (!student.email.includes("@")) {
      student.status = "error";
      student.errorMessage = "Invalid email format";
    }

    students.push(student);
  }

  return students;
};
