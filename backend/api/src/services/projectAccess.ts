import { getSupabaseAdminClient } from "./supabaseClient";
import { findUserByEmail } from "./userService";

export interface ProjectAccess {
  /** false when the project does not exist */
  found: boolean;
  /** Team member, assigned advisor, or coordinator: may see private details and make changes. */
  canAccess: boolean;
  /** The project is approved, so it is part of the public archive. */
  isApproved: boolean;
  error?: string;
}

/**
 * Decide what the signed-in user may do with a project.
 *
 * - coordinators: everything
 * - advisors: projects they advise directly or through the course they are assigned to
 * - students: projects they are a team member of
 *
 * `role` must be the effective role (req.user.role).
 */
export const getProjectAccess = async (
  projectId: number,
  email: string | undefined,
  role: string | undefined,
): Promise<ProjectAccess> => {
  const supabase = getSupabaseAdminClient();

  const { data: project, error } = await supabase
    .from("project")
    .select("id, status, advisor_id, course_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    return { found: false, canAccess: false, isApproved: false, error: error.message };
  }
  if (!project) {
    return { found: false, canAccess: false, isApproved: false };
  }

  const isApproved = project.status === "approved";

  if (!email) {
    return { found: true, canAccess: false, isApproved };
  }
  if (role === "coordinator") {
    return { found: true, canAccess: true, isApproved };
  }

  const userResponse = await findUserByEmail(email);
  if (userResponse.error) {
    return { found: true, canAccess: false, isApproved, error: userResponse.error.message };
  }
  const user = userResponse.data;
  if (!user) {
    return { found: true, canAccess: false, isApproved };
  }

  if (role === "advisor") {
    if (project.advisor_id === user.id) {
      return { found: true, canAccess: true, isApproved };
    }
    if (project.course_id) {
      const { data: course } = await supabase
        .from("course")
        .select("advisor_id")
        .eq("id", project.course_id)
        .maybeSingle();
      if (course?.advisor_id === user.id) {
        return { found: true, canAccess: true, isApproved };
      }
    }
    return { found: true, canAccess: false, isApproved };
  }

  if (role === "student") {
    const { data: membership } = await supabase
      .from("team_member")
      .select("project_id")
      .eq("project_id", projectId)
      .eq("student_id", user.id)
      .maybeSingle();
    return { found: true, canAccess: Boolean(membership), isApproved };
  }

  return { found: true, canAccess: false, isApproved };
};

/**
 * Ids of the projects a user may see private details of, or `null` when the
 * user may see every project (coordinators).
 */
export const listAccessibleProjectIds = async (
  email: string | undefined,
  role: string | undefined,
): Promise<number[] | null> => {
  if (role === "coordinator") {
    return null;
  }
  if (!email) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const userResponse = await findUserByEmail(email);
  const user = userResponse.data;
  if (!user) {
    return [];
  }

  if (role === "advisor") {
    const { data: direct } = await supabase
      .from("project")
      .select("id")
      .eq("advisor_id", user.id);
    const { data: courses } = await supabase
      .from("course")
      .select("id")
      .eq("advisor_id", user.id);
    const courseIds = (courses ?? []).map((c) => c.id);
    const { data: viaCourse } = courseIds.length
      ? await supabase.from("project").select("id").in("course_id", courseIds)
      : { data: [] as { id: number }[] };
    return Array.from(
      new Set([...(direct ?? []), ...(viaCourse ?? [])].map((p) => p.id)),
    );
  }

  if (role === "student") {
    const { data } = await supabase
      .from("team_member")
      .select("project_id")
      .eq("student_id", user.id);
    return (data ?? []).map((row) => row.project_id);
  }

  return [];
};
