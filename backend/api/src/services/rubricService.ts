import { getSupabaseAdminClient } from "./supabaseClient";

// ── Types ────────────────────────────────────────────────────────────────

export interface RubricLevelRow {
  id: number;
  criterion_id: number;
  name: string;
  description: string | null;
  points: number;
  sort_order: number;
}

export interface RubricCriterionRow {
  id: number;
  rubric_id: number;
  name: string;
  description: string | null;
  plo_ids: string[];
  weight: number;
  sort_order: number;
}

export interface RubricRow {
  id: number;
  name: string;
  description: string | null;
  project_types: string[];
  max_points: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LevelInput {
  name: string;
  description?: string;
  points: number;
  sort_order?: number;
}

export interface CriterionInput {
  name: string;
  description?: string;
  ploIds: string[];
  weight: number;
  levels: LevelInput[];
}

export interface CreateRubricInput {
  name: string;
  description?: string;
  projectTypes: string[];
  criteria: CriterionInput[];
  maxPoints?: number;
  createdBy: string;
}

export interface UpdateRubricInput {
  name?: string;
  description?: string;
  projectTypes?: string[];
  criteria?: CriterionInput[];
  maxPoints?: number;
  isActive?: boolean;
}

export interface RubricWithCriteria extends RubricRow {
  criteria: (RubricCriterionRow & { levels: RubricLevelRow[] })[];
  course_ids: number[];
}

// ── Helpers ──────────────────────────────────────────────────────────────

export const TABLE_NOT_FOUND_CODE = "PGRST205";

type ServiceResult<T> =
  | { data: T; error: null }
  | { data: null; error: string; code?: string };

const ok = <T>(data: T): ServiceResult<T> => ({ data, error: null });
const fail = <T>(msg: string, code?: string): ServiceResult<T> => ({
  data: null,
  error: msg,
  code,
});

// ── CRUD ─────────────────────────────────────────────────────────────────

export async function listRubrics(): Promise<
  ServiceResult<RubricWithCriteria[]>
> {
  const supabase = getSupabaseAdminClient();

  const { data: rubrics, error } = await supabase
    .from("rubric")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return fail(error.message, error.code);

  const result: RubricWithCriteria[] = [];

  for (const rubric of rubrics ?? []) {
    const { data: criteria, error: cErr } = await supabase
      .from("rubric_criterion")
      .select("*")
      .eq("rubric_id", rubric.id)
      .order("sort_order");

    if (cErr) return fail(cErr.message, cErr.code);

    const criteriaWithLevels: (RubricCriterionRow & {
      levels: RubricLevelRow[];
    })[] = [];

    for (const criterion of criteria ?? []) {
      const { data: levels, error: lErr } = await supabase
        .from("rubric_level")
        .select("*")
        .eq("criterion_id", criterion.id)
        .order("sort_order");

      if (lErr) return fail(lErr.message, lErr.code);

      criteriaWithLevels.push({ ...criterion, levels: levels ?? [] });
    }

    const courseIds = await getRubricCourseIds(supabase, rubric.id);
    if (typeof courseIds === "string") return fail(courseIds);

    result.push({
      ...rubric,
      criteria: criteriaWithLevels,
      course_ids: courseIds,
    });
  }

  return ok(result);
}

export async function getRubricById(
  id: number,
): Promise<ServiceResult<RubricWithCriteria>> {
  const supabase = getSupabaseAdminClient();

  const { data: rubric, error } = await supabase
    .from("rubric")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return fail(error.message, error.code);

  const { data: criteria, error: cErr } = await supabase
    .from("rubric_criterion")
    .select("*")
    .eq("rubric_id", rubric.id)
    .order("sort_order");

  if (cErr) return fail(cErr.message, cErr.code);

  const criteriaWithLevels: (RubricCriterionRow & {
    levels: RubricLevelRow[];
  })[] = [];

  for (const criterion of criteria ?? []) {
    const { data: levels, error: lErr } = await supabase
      .from("rubric_level")
      .select("*")
      .eq("criterion_id", criterion.id)
      .order("sort_order");

    if (lErr) return fail(lErr.message, lErr.code);

    criteriaWithLevels.push({ ...criterion, levels: levels ?? [] });
  }

  const courseIds = await getRubricCourseIds(supabase, rubric.id);
  if (typeof courseIds === "string") return fail(courseIds);

  return ok({ ...rubric, criteria: criteriaWithLevels, course_ids: courseIds });
}

export async function createRubric(
  input: CreateRubricInput,
): Promise<ServiceResult<RubricWithCriteria>> {
  const supabase = getSupabaseAdminClient();

  // Insert rubric
  const { data: rubric, error } = await supabase
    .from("rubric")
    .insert({
      name: input.name,
      description: input.description ?? null,
      project_types: input.projectTypes,
      max_points: input.maxPoints ?? 100,
      is_active: true,
      created_by: input.createdBy,
    })
    .select()
    .single();

  if (error) return fail(error.message, error.code);

  const criteriaWithLevels = await insertCriteria(
    supabase,
    rubric.id,
    input.criteria,
  );
  if (typeof criteriaWithLevels === "string") return fail(criteriaWithLevels);

  return ok({ ...rubric, criteria: criteriaWithLevels, course_ids: [] });
}

export async function updateRubric(
  id: number,
  input: UpdateRubricInput,
): Promise<ServiceResult<RubricWithCriteria>> {
  const supabase = getSupabaseAdminClient();

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.description !== undefined)
    updatePayload.description = input.description;
  if (input.projectTypes !== undefined)
    updatePayload.project_types = input.projectTypes;
  if (input.maxPoints !== undefined) updatePayload.max_points = input.maxPoints;
  if (input.isActive !== undefined) updatePayload.is_active = input.isActive;

  const { data: rubric, error } = await supabase
    .from("rubric")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) return fail(error.message, error.code);

  // If criteria provided, replace them entirely
  if (input.criteria !== undefined) {
    // Delete existing criteria (cascade deletes levels)
    const { error: delErr } = await supabase
      .from("rubric_criterion")
      .delete()
      .eq("rubric_id", id);

    if (delErr) return fail(delErr.message, delErr.code);

    const criteriaWithLevels = await insertCriteria(
      supabase,
      id,
      input.criteria,
    );
    if (typeof criteriaWithLevels === "string") return fail(criteriaWithLevels);

    const courseIds = await getRubricCourseIds(supabase, id);
    if (typeof courseIds === "string") return fail(courseIds);

    return ok({ ...rubric, criteria: criteriaWithLevels, course_ids: courseIds });
  }

  // Return with existing criteria
  return getRubricById(id);
}

export async function deleteRubric(
  id: number,
): Promise<ServiceResult<{ deleted: true }>> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase.from("rubric").delete().eq("id", id);

  if (error) return fail(error.message, error.code);

  return ok({ deleted: true });
}

export async function toggleRubricStatus(
  id: number,
): Promise<ServiceResult<RubricWithCriteria>> {
  const supabase = getSupabaseAdminClient();

  // Get current status
  const { data: current, error: getErr } = await supabase
    .from("rubric")
    .select("is_active")
    .eq("id", id)
    .single();

  if (getErr) return fail(getErr.message, getErr.code);

  return updateRubric(id, { isActive: !current.is_active });
}

/**
 * Replace a rubric's course assignments with `courseIds`.
 * When `scopeCourseIds` is given (advisors), only assignments inside that
 * scope are touched, so courses managed by other people keep their rubric.
 */
export async function setRubricCourses(
  rubricId: number,
  courseIds: number[],
  scopeCourseIds: number[] | null,
): Promise<ServiceResult<RubricWithCriteria>> {
  const supabase = getSupabaseAdminClient();

  if (scopeCourseIds) {
    const outOfScope = courseIds.filter((id) => !scopeCourseIds.includes(id));
    if (outOfScope.length > 0) {
      return fail("You can only assign rubrics to your own courses.", "forbidden");
    }
  }

  const { data: rubric, error: rubricErr } = await supabase
    .from("rubric")
    .select("id")
    .eq("id", rubricId)
    .maybeSingle();

  if (rubricErr) return fail(rubricErr.message, rubricErr.code);
  if (!rubric) return fail("Rubric not found.", "not_found");

  let deleteQuery = supabase
    .from("rubric_course")
    .delete()
    .eq("rubric_id", rubricId);
  if (scopeCourseIds) {
    if (scopeCourseIds.length === 0) return getRubricById(rubricId);
    deleteQuery = deleteQuery.in("course_id", scopeCourseIds);
  }

  const { error: delErr } = await deleteQuery;
  if (delErr) return fail(delErr.message, delErr.code);

  if (courseIds.length > 0) {
    const { error: insErr } = await supabase
      .from("rubric_course")
      .insert(courseIds.map((courseId) => ({ rubric_id: rubricId, course_id: courseId })));

    if (insErr) return fail(insErr.message, insErr.code);
  }

  return getRubricById(rubricId);
}

// ── Private helper ───────────────────────────────────────────────────────

/**
 * Course ids a rubric is assigned to. Returns [] if the rubric_course
 * migration has not been run yet, so the rest of rubric management keeps
 * working without it.
 */
async function getRubricCourseIds(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rubricId: number,
): Promise<number[] | string> {
  const { data, error } = await supabase
    .from("rubric_course")
    .select("course_id")
    .eq("rubric_id", rubricId);

  if (error) {
    if (error.code === TABLE_NOT_FOUND_CODE) return [];
    return error.message;
  }

  return (data ?? []).map((row) => row.course_id as number);
}

async function insertCriteria(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rubricId: number,
  criteria: CriterionInput[],
): Promise<(RubricCriterionRow & { levels: RubricLevelRow[] })[] | string> {
  const result: (RubricCriterionRow & { levels: RubricLevelRow[] })[] = [];

  for (let i = 0; i < criteria.length; i++) {
    const c = criteria[i];

    const { data: criterion, error: cErr } = await supabase
      .from("rubric_criterion")
      .insert({
        rubric_id: rubricId,
        name: c.name,
        description: c.description ?? null,
        plo_ids: c.ploIds,
        weight: c.weight,
        sort_order: i,
      })
      .select()
      .single();

    if (cErr) return cErr.message;

    const levelRows = c.levels.map((l, j) => ({
      criterion_id: criterion.id,
      name: l.name,
      description: l.description ?? null,
      points: l.points,
      sort_order: j,
    }));

    const { data: levels, error: lErr } = await supabase
      .from("rubric_level")
      .insert(levelRows)
      .select();

    if (lErr) return lErr.message;

    result.push({ ...criterion, levels: levels ?? [] });
  }

  return result;
}
