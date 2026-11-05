import { getSupabaseAdminClient } from "./supabaseClient";
import { listEnrolledCoursesByEmail } from "./rosterService";

export interface CourseMatch {
  id: number;
  advisor_id: number | null;
}

/**
 * Find a course by its code. The same code can exist in several semesters or
 * years, so when more than one course matches this prefers the one the given
 * student is enrolled in, then the most recent one.
 */
export const findCourseByCode = async (
  courseCode: string,
  preferEnrolledEmail?: string,
): Promise<CourseMatch | null> => {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("course")
    .select("id, advisor_id, year, semester")
    .eq("course_code", courseCode)
    .order("year", { ascending: false })
    .order("semester", { ascending: false });

  const rows = data ?? [];
  if (rows.length === 0) {
    return null;
  }

  if (rows.length > 1 && preferEnrolledEmail) {
    const { data: enrolled } = await listEnrolledCoursesByEmail(
      preferEnrolledEmail,
    );
    const enrolledIds = new Set((enrolled ?? []).map((c) => c.courseId));
    const match = rows.find((row) => enrolledIds.has(row.id));
    if (match) {
      return { id: match.id, advisor_id: match.advisor_id };
    }
  }

  return { id: rows[0].id, advisor_id: rows[0].advisor_id };
};
