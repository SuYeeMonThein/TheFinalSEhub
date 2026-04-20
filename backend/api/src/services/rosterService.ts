import { PostgrestError, PostgrestResponse } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabaseClient";

export interface RosterEntryRecord {
  id: number;
  course_id: number;
  student_id: string;
  name: string;
  email: string;
  year: string | null;
  created_at?: string;
}

export interface UpsertRosterInput {
  studentId: string;
  name: string;
  email: string;
  year?: string;
}

export const listRosterByCourse = async (
  courseId: number,
): Promise<{
  data: RosterEntryRecord[] | null;
  error: PostgrestError | null;
}> => {
  const supabase = getSupabaseAdminClient();
  const response = await supabase
    .from("course_roster")
    .select("*")
    .eq("course_id", courseId)
    .order("id", { ascending: true });

  return { data: response.data ?? null, error: response.error };
};

export const upsertRosterEntries = async (
  courseId: number,
  students: UpsertRosterInput[],
): Promise<{
  data: RosterEntryRecord[] | null;
  addedStudentIds: string[];
  error: PostgrestError | null;
}> => {
  if (students.length === 0) {
    return { data: [], addedStudentIds: [], error: null };
  }

  const supabase = getSupabaseAdminClient();

  const existing = await listRosterByCourse(courseId);
  if (existing.error) {
    return { data: null, addedStudentIds: [], error: existing.error };
  }

  const existingRecords = existing.data ?? [];
  const existingIds = new Set(existingRecords.map((r) => r.student_id));
  const uniqueById = new Map<string, UpsertRosterInput>();

  students.forEach((student) => {
    if (!uniqueById.has(student.studentId)) {
      uniqueById.set(student.studentId, student);
    }
  });

  const toInsert = Array.from(uniqueById.values()).filter(
    (student) => !existingIds.has(student.studentId),
  );

  if (toInsert.length === 0) {
    return { data: existingRecords, addedStudentIds: [], error: null };
  }

  const payload = toInsert.map((s) => ({
    course_id: courseId,
    student_id: s.studentId,
    name: s.name,
    email: s.email,
    year: s.year ?? null,
  }));

  const ins: PostgrestResponse<RosterEntryRecord> = await supabase
    .from("course_roster")
    .insert(payload)
    .select("*");

  if (ins.error) {
    return { data: null, addedStudentIds: [], error: ins.error };
  }

  return {
    data: [...existingRecords, ...(ins.data ?? [])],
    addedStudentIds: toInsert.map((s) => s.studentId),
    error: null,
  };
};

export const deleteRosterEntry = async (
  courseId: number,
  studentId: string,
): Promise<{
  data: RosterEntryRecord[] | null;
  error: PostgrestError | null;
}> => {
  const supabase = getSupabaseAdminClient();
  const response = await supabase
    .from("course_roster")
    .delete()
    .eq("course_id", courseId)
    .eq("student_id", studentId)
    .select("*");

  return { data: response.data ?? null, error: response.error };
};
