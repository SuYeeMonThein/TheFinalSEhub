import { describe, expect, it } from "vitest";
import { dedupeProjectFiles } from "../ProjectSubmissionForm";

describe("dedupeProjectFiles", () => {
  it("keeps only one entry for the same uploaded file name", () => {
    const existingFiles = [
      { name: "report.pdf", size: "1.2 MB", type: "PDF" },
    ];

    const incomingFiles = [
      { name: "report.pdf", size: "1.2 MB", type: "PDF", pendingId: "new-1" },
      { name: "notes.docx", size: "0.3 MB", type: "DOCX", pendingId: "new-2" },
    ];

    expect(dedupeProjectFiles(existingFiles, incomingFiles)).toEqual([
      { name: "report.pdf", size: "1.2 MB", type: "PDF" },
      { name: "notes.docx", size: "0.3 MB", type: "DOCX", pendingId: "new-2" },
    ]);
  });
});
