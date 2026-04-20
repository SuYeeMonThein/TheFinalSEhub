import { getSupabaseClient } from "./supabaseClient";
import { ProjectRecord, ProjectType, ProjectStatus } from "./projectService";

export interface AnalyticsFilters {
  year?: number;
  semester?: "1" | "2" | "all";
  courseId?: number;
  advisorId?: number;
  startDate?: string;
  endDate?: string;
}

export interface ProjectMetrics {
  totalProjects: number;
  approvedProjects: number;
  pendingProjects: number;
  rejectedProjects: number;
  inProgressProjects: number;
  totalStudents: number;
  activeStudents: number;
  approvalRate: number;
  averageGrade: number | null;
  averageTeamSize: number;
  highImpactProjects: number;
  pendingReviews: number;
  completedProjects: number;
}

export interface SubmissionTrend {
  period: string;
  submissions: number;
  approved: number;
  rejected: number;
}

export interface ProjectTypeDistribution {
  name: string;
  value: number;
  percentage: number;
}

export interface ApprovalRate {
  period: string;
  approved: number;
  rejected: number;
  pending: number;
  total: number;
  approvalRate: number;
}

export interface StudentPerformance {
  studentId: number;
  studentName: string;
  studentEmail: string;
  projectsCount: number;
  approvedCount: number;
  averageGrade: number | null;
  latestProject: string | null;
}

export interface AdvisorPerformance {
  advisorId: number;
  advisorName: string;
  advisorEmail: string;
  projectsCount: number;
  averageApprovalRate: number;
  averageResponseTime: number | null;
}

export interface CourseAnalytics {
  courseId: number;
  courseName: string;
  courseCode: string;
  totalProjects: number;
  averageGrade: number | null;
  completionRate: number;
}

export interface ImpactAnalysis {
  category: string;
  count: number;
  percentage: number;
  examples: string[];
}

export interface DetailedProject {
  id: number;
  name: string;
  status: string;
  type: string;
  studentName: string;
  advisorName: string | null;
  submissionDate: string;
  grade: string | null;
  semester: string;
  year: number;
}

type ProjectDateFields = Pick<ProjectRecord, "created_at" | "start_date" | "year" | "semester">;

const resolveProjectDate = (project: Partial<ProjectDateFields>): Date => {
  if (project.created_at) {
    return new Date(project.created_at);
  }

  if (project.start_date) {
    return new Date(project.start_date);
  }

  if (project.year) {
    const monthIndex = project.semester === "2" ? 7 : 0; // Aug vs Jan as semester proxy
    return new Date(Date.UTC(project.year, monthIndex, 1));
  }

  return new Date(0);
};

const inferSemesterLabel = (project: Partial<ProjectDateFields>, referenceDate: Date): string => {
  if (project.semester === "1") {
    return "Spring";
  }

  if (project.semester === "2") {
    return "Fall";
  }

  return referenceDate.getUTCMonth() < 6 ? "Spring" : "Fall";
};

type StudentPerformanceAccumulator = StudentPerformance & { latestProjectDate?: string | null };

/**
 * Get comprehensive project metrics based on filters
 */
export const getProjectMetrics = async (
  filters: AnalyticsFilters = {}
): Promise<{ data: ProjectMetrics | null; error: Error | null }> => {
  const supabase = getSupabaseClient();

  try {
    let query = supabase.from("project").select("*", { count: "exact" });

    // Apply filters
    if (filters.year) {
      query = query.eq("year", filters.year);
    }
    if (filters.semester && filters.semester !== "all") {
      query = query.eq("semester", filters.semester);
    }
    if (filters.courseId) {
      query = query.eq("course_id", filters.courseId);
    }
    if (filters.advisorId) {
      query = query.eq("advisor_id", filters.advisorId);
    }

    const { data: projects, error, count } = await query;

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    if (!projects) {
      return {
        data: {
          totalProjects: 0,
          approvedProjects: 0,
          pendingProjects: 0,
          rejectedProjects: 0,
          inProgressProjects: 0,
          totalStudents: 0,
          activeStudents: 0,
          approvalRate: 0,
          averageGrade: null,
          averageTeamSize: 0,
          highImpactProjects: 0,
          pendingReviews: 0,
          completedProjects: 0,
        },
        error: null,
      };
    }

    // Calculate metrics
    const totalProjects = count || projects.length;
    const approvedProjects = projects.filter((p) => p.status === "approved").length;
    const rejectedProjects = projects.filter((p) => p.status === "reject").length;
    const pendingProjects = projects.filter((p) => p.status === "underreview").length;
    const approvalRate = totalProjects > 0 ? (approvedProjects / totalProjects) * 100 : 0;

    // Get unique students
    const { data: teamMembers } = await supabase
      .from("team_member")
      .select("student_id")
      .in(
        "project_id",
        projects.map((p) => p.id)
      );

    const uniqueStudents = new Set(teamMembers?.map((tm) => tm.student_id) || []);

    // Calculate average grade
    const gradesWithValues = projects
      .map((p) => p.grade)
      .filter((g) => g && !isNaN(parseFloat(g)))
      .map((g) => parseFloat(g!));
    
    const averageGrade = gradesWithValues.length > 0
      ? gradesWithValues.reduce((a, b) => a + b, 0) / gradesWithValues.length
      : null;

    // High impact projects (projects with awards, publications, or high grades)
    const highImpactProjects = projects.filter((p) => {
      const grade = p.grade ? parseFloat(p.grade) : 0;
      return grade >= 85 || p.project_type === "competition";
    }).length;

    return {
      data: {
        totalProjects,
        approvedProjects,
        activeStudents: uniqueStudents.size,
        approvalRate: Math.round(approvalRate * 10) / 10,
        averageGrade: averageGrade ? Math.round(averageGrade * 10) / 10 : null,
        highImpactProjects,
        pendingReviews: pendingProjects,
        pendingProjects,
        completedProjects: approvedProjects,
        rejectedProjects,
        inProgressProjects: projects.filter((p) => p.status === "draft").length,
        averageTeamSize: uniqueStudents.size > 0 ? uniqueStudents.size / totalProjects : 0,
        totalStudents: uniqueStudents.size,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
};

/**
 * Get submission trends over time
 */
export const getSubmissionTrends = async (
  filters: AnalyticsFilters = {},
  groupBy: "month" | "semester" | "year" = "month"
): Promise<{ data: SubmissionTrend[] | null; error: Error | null }> => {
  const supabase = getSupabaseClient();

  try {
    let query = supabase.from("project").select("*");

    if (filters.year) {
      query = query.eq("year", filters.year);
    }
    if (filters.semester && filters.semester !== "all") {
      query = query.eq("semester", filters.semester);
    }

    const { data: projects, error } = await query;

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    if (!projects || projects.length === 0) {
      return { data: [], error: null };
    }

    const orderedProjects = [...projects].sort(
      (a, b) => resolveProjectDate(a).getTime() - resolveProjectDate(b).getTime()
    );

    // Group projects by period
    const trends = new Map<string, { submissions: number; approved: number; rejected: number }>();

    orderedProjects.forEach((project) => {
      const date = resolveProjectDate(project);
      let period: string;

      if (groupBy === "month") {
        period = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      } else if (groupBy === "semester") {
        const label = inferSemesterLabel(project, date);
        const yearLabel = (project.year ?? date.getUTCFullYear()).toString();
        period = `${label} ${yearLabel}`;
      } else {
        const yearValue = project.year ?? date.getUTCFullYear();
        period = yearValue.toString();
      }

      const current = trends.get(period) || { submissions: 0, approved: 0, rejected: 0 };
      current.submissions++;
      if (project.status === "approved") current.approved++;
      if (project.status === "reject") current.rejected++;
      trends.set(period, current);
    });

    const result: SubmissionTrend[] = Array.from(trends.entries()).map(([period, data]) => ({
      period,
      ...data,
    }));

    return { data: result, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
};

/**
 * Get project type distribution
 */
export const getProjectTypeDistribution = async (
  filters: AnalyticsFilters = {}
): Promise<{ data: ProjectTypeDistribution[] | null; error: Error | null }> => {
  const supabase = getSupabaseClient();

  try {
    let query = supabase.from("project").select("project_type");

    if (filters.year) {
      query = query.eq("year", filters.year);
    }
    if (filters.semester && filters.semester !== "all") {
      query = query.eq("semester", filters.semester);
    }

    const { data: projects, error } = await query;

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    if (!projects || projects.length === 0) {
      return { data: [], error: null };
    }

    const typeMap = new Map<string, number>();
    const typeLabels: Record<ProjectType, string> = {
      academic: "Capstone/Academic",
      competition: "Competition Work",
      service: "Social Service",
      other: "Other",
    };

    projects.forEach((project) => {
      const type = project.project_type;
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });

    const total = projects.length;
    const result: ProjectTypeDistribution[] = Array.from(typeMap.entries()).map(([type, count]) => ({
      name: typeLabels[type as ProjectType] || type,
      value: count,
      percentage: Math.round((count / total) * 100 * 10) / 10,
    }));

    return { data: result.sort((a, b) => b.value - a.value), error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
};

/**
 * Get approval rates by period
 */
export const getApprovalRates = async (
  filters: AnalyticsFilters = {}
): Promise<{ data: ApprovalRate[] | null; error: Error | null }> => {
  const supabase = getSupabaseClient();

  try {
    let query = supabase.from("project").select("*");

    if (filters.year) {
      query = query.eq("year", filters.year);
    }

    const { data: projects, error } = await query.order("year", { ascending: true });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    if (!projects || projects.length === 0) {
      return { data: [], error: null };
    }

    // Group by semester
    const rateMap = new Map<string, { approved: number; rejected: number; pending: number; total: number }>();

    projects.forEach((project) => {
      const period = `${project.semester === "1" ? "Spring" : "Fall"} ${project.year}`;
      const current = rateMap.get(period) || { approved: 0, rejected: 0, pending: 0, total: 0 };
      
      current.total++;
      if (project.status === "approved") current.approved++;
      else if (project.status === "reject") current.rejected++;
      else current.pending++;
      
      rateMap.set(period, current);
    });

    const result: ApprovalRate[] = Array.from(rateMap.entries()).map(([period, data]) => ({
      period,
      ...data,
      approvalRate: data.total > 0 ? Math.round((data.approved / data.total) * 100 * 10) / 10 : 0,
    }));

    return { data: result, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
};

/**
 * Get student performance analytics
 */
export const getStudentPerformance = async (
  filters: AnalyticsFilters = {},
  limit: number = 50
): Promise<{ data: StudentPerformance[] | null; error: Error | null }> => {
  const supabase = getSupabaseClient();

  try {
    let projectQuery = supabase.from("project").select("*");

    if (filters.year) {
      projectQuery = projectQuery.eq("year", filters.year);
    }
    if (filters.semester && filters.semester !== "all") {
      projectQuery = projectQuery.eq("semester", filters.semester);
    }

    const { data: projects, error: projectError } = await projectQuery;

    if (projectError) {
      return { data: null, error: new Error(projectError.message) };
    }

    if (!projects || projects.length === 0) {
      return { data: [], error: null };
    }

    // Get team members
    const { data: teamMembers, error: tmError } = await supabase
      .from("team_member")
      .select("project_id, student_id")
      .in(
        "project_id",
        projects.map((p) => p.id)
      );

    if (tmError) {
      return { data: null, error: new Error(tmError.message) };
    }

    // Get student info
    const studentIds = Array.from(new Set(teamMembers?.map((tm) => tm.student_id) || []));
    const { data: students, error: studentError } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", studentIds);

    if (studentError) {
      return { data: null, error: new Error(studentError.message) };
    }

    // Build student performance map
    const performanceMap = new Map<number, StudentPerformanceAccumulator>();

    teamMembers?.forEach((tm) => {
      const project = projects.find((p) => p.id === tm.project_id);
      const student = students?.find((s) => s.id === tm.student_id);

      if (!project || !student) return;

      const current = performanceMap.get(tm.student_id) || {
        studentId: tm.student_id,
        studentName: student.name || "Unknown",
        studentEmail: student.email,
        projectsCount: 0,
        approvedCount: 0,
        averageGrade: null,
        latestProject: null,
        latestProjectDate: null,
      };

      current.projectsCount++;
      if (project.status === "approved") current.approvedCount++;
      
      const grade = project.grade ? parseFloat(project.grade) : null;
      if (grade !== null) {
        current.averageGrade = current.averageGrade !== null
          ? (current.averageGrade + grade) / 2
          : grade;
      }

      const projectDateIso = resolveProjectDate(project).toISOString();
      if (!current.latestProjectDate || projectDateIso > current.latestProjectDate) {
        current.latestProject = project.name;
        current.latestProjectDate = projectDateIso;
      }

      performanceMap.set(tm.student_id, current);
    });

    const result = Array.from(performanceMap.values())
      .map(({ latestProjectDate, ...rest }) => rest)
      .sort((a, b) => b.projectsCount - a.projectsCount)
      .slice(0, limit);

    return { data: result, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
};

/**
 * Get advisor performance analytics
 */
export const getAdvisorPerformance = async (
  filters: AnalyticsFilters = {}
): Promise<{ data: AdvisorPerformance[] | null; error: Error | null }> => {
  const supabase = getSupabaseClient();

  try {
    let query = supabase.from("project").select("*").not("advisor_id", "is", null);

    if (filters.year) {
      query = query.eq("year", filters.year);
    }
    if (filters.semester && filters.semester !== "all") {
      query = query.eq("semester", filters.semester);
    }

    const { data: projects, error: projectError } = await query;

    if (projectError) {
      return { data: null, error: new Error(projectError.message) };
    }

    if (!projects || projects.length === 0) {
      return { data: [], error: null };
    }

    // Get advisor info
    const advisorIds = Array.from(new Set(projects.map((p) => p.advisor_id).filter(Boolean)));
    const { data: advisors, error: advisorError } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", advisorIds as number[]);

    if (advisorError) {
      return { data: null, error: new Error(advisorError.message) };
    }

    // Build advisor performance map
    const performanceMap = new Map<number, AdvisorPerformance>();

    projects.forEach((project) => {
      if (!project.advisor_id) return;

      const advisor = advisors?.find((a) => a.id === project.advisor_id);
      if (!advisor) return;

      const current = performanceMap.get(project.advisor_id) || {
        advisorId: project.advisor_id,
        advisorName: advisor.name || "Unknown",
        advisorEmail: advisor.email,
        projectsCount: 0,
        averageApprovalRate: 0,
        averageResponseTime: null,
      };

      current.projectsCount++;
      const isApproved = project.status === "approved" ? 1 : 0;
      current.averageApprovalRate = 
        ((current.averageApprovalRate * (current.projectsCount - 1)) + isApproved) / current.projectsCount;

      performanceMap.set(project.advisor_id, current);
    });

    const result = Array.from(performanceMap.values())
      .map((perf) => ({
        ...perf,
        averageApprovalRate: Math.round(perf.averageApprovalRate * 100 * 10) / 10,
      }))
      .sort((a, b) => b.projectsCount - a.projectsCount);

    return { data: result, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
};

/**
 * Get course analytics
 */
export const getCourseAnalytics = async (
  filters: AnalyticsFilters = {}
): Promise<{ data: CourseAnalytics[] | null; error: Error | null }> => {
  const supabase = getSupabaseClient();

  try {
    let projectQuery = supabase.from("project").select("*").not("course_id", "is", null);

    if (filters.year) {
      projectQuery = projectQuery.eq("year", filters.year);
    }
    if (filters.semester && filters.semester !== "all") {
      projectQuery = projectQuery.eq("semester", filters.semester);
    }

    const { data: projects, error: projectError } = await projectQuery;

    if (projectError) {
      return { data: null, error: new Error(projectError.message) };
    }

    if (!projects || projects.length === 0) {
      return { data: [], error: null };
    }

    // Get course info
    const courseIds = Array.from(new Set(projects.map((p) => p.course_id).filter(Boolean)));
    const { data: courses, error: courseError } = await supabase
      .from("courses")
      .select("id, name, code")
      .in("id", courseIds as number[]);

    if (courseError) {
      return { data: null, error: new Error(courseError.message) };
    }

    // Build course analytics map
    const analyticsMap = new Map<number, CourseAnalytics>();

    projects.forEach((project) => {
      if (!project.course_id) return;

      const course = courses?.find((c) => c.id === project.course_id);
      if (!course) return;

      const current = analyticsMap.get(project.course_id) || {
        courseId: project.course_id,
        courseName: course.name,
        courseCode: course.code,
        totalProjects: 0,
        averageGrade: null,
        completionRate: 0,
      };

      current.totalProjects++;
      
      const grade = project.grade ? parseFloat(project.grade) : null;
      if (grade !== null) {
        const prevTotal = current.totalProjects - 1;
        current.averageGrade = current.averageGrade !== null
          ? ((current.averageGrade * prevTotal) + grade) / current.totalProjects
          : grade;
      }

      const isCompleted = project.status === "approved" ? 1 : 0;
      current.completionRate = 
        ((current.completionRate * (current.totalProjects - 1)) + isCompleted) / current.totalProjects;

      analyticsMap.set(project.course_id, current);
    });

    const result = Array.from(analyticsMap.values())
      .map((analytics) => ({
        ...analytics,
        averageGrade: analytics.averageGrade ? Math.round(analytics.averageGrade * 10) / 10 : null,
        completionRate: Math.round(analytics.completionRate * 100 * 10) / 10,
      }))
      .sort((a, b) => b.totalProjects - a.totalProjects);

    return { data: result, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
};

/**
 * Get impact analysis
 */
export const getImpactAnalysis = async (
  filters: AnalyticsFilters = {}
): Promise<{ data: ImpactAnalysis[] | null; error: Error | null }> => {
  const supabase = getSupabaseClient();

  try {
    let query = supabase.from("project").select("*");

    if (filters.year) {
      query = query.eq("year", filters.year);
    }
    if (filters.semester && filters.semester !== "all") {
      query = query.eq("semester", filters.semester);
    }

    const { data: projects, error } = await query;

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    if (!projects || projects.length === 0) {
      return { data: [], error: null };
    }

    const impactCategories = {
      high: { count: 0, examples: [] as string[] },
      medium: { count: 0, examples: [] as string[] },
      low: { count: 0, examples: [] as string[] },
    };

    projects.forEach((project) => {
      const grade = project.grade ? parseFloat(project.grade) : 0;
      const isCompetition = project.project_type === "competition";
      
      let category: "high" | "medium" | "low";
      
      if (grade >= 85 || isCompetition) {
        category = "high";
      } else if (grade >= 70) {
        category = "medium";
      } else {
        category = "low";
      }

      impactCategories[category].count++;
      if (impactCategories[category].examples.length < 5) {
        impactCategories[category].examples.push(project.name);
      }
    });

    const total = projects.length;
    const result: ImpactAnalysis[] = [
      {
        category: "High Impact",
        count: impactCategories.high.count,
        percentage: Math.round((impactCategories.high.count / total) * 100 * 10) / 10,
        examples: impactCategories.high.examples,
      },
      {
        category: "Medium Impact",
        count: impactCategories.medium.count,
        percentage: Math.round((impactCategories.medium.count / total) * 100 * 10) / 10,
        examples: impactCategories.medium.examples,
      },
      {
        category: "Low Impact",
        count: impactCategories.low.count,
        percentage: Math.round((impactCategories.low.count / total) * 100 * 10) / 10,
        examples: impactCategories.low.examples,
      },
    ];

    return { data: result, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
};

/**
 * Get detailed project list for export
 */
export const getDetailedProjects = async (
  filters: AnalyticsFilters = {}
): Promise<{ data: DetailedProject[] | null; error: Error | null }> => {
  const supabase = getSupabaseClient();

  try {
    let query = supabase.from("project").select("*");

    if (filters.year) {
      query = query.eq("year", filters.year);
    }
    if (filters.semester && filters.semester !== "all") {
      query = query.eq("semester", filters.semester);
    }
    if (filters.courseId) {
      query = query.eq("course_id", filters.courseId);
    }

    const { data: projects, error: projectError } = await query;

    if (projectError) {
      return { data: null, error: new Error(projectError.message) };
    }

    if (!projects || projects.length === 0) {
      return { data: [], error: null };
    }

    const orderedProjects = [...projects].sort(
      (a, b) => resolveProjectDate(b).getTime() - resolveProjectDate(a).getTime()
    );

    // Get all student and advisor info
    const studentIds = new Set<number>();
    const advisorIds = new Set<number>();

    const { data: teamMembers } = await supabase
      .from("team_member")
      .select("project_id, student_id")
      .in(
        "project_id",
        orderedProjects.map((p) => p.id)
      );

    teamMembers?.forEach((tm) => studentIds.add(tm.student_id));
    orderedProjects.forEach((p) => {
      if (p.advisor_id) advisorIds.add(p.advisor_id);
    });

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", Array.from(new Set([...Array.from(studentIds), ...Array.from(advisorIds)])));

    // Build detailed project list
    const result: DetailedProject[] = orderedProjects.map((project) => {
      const projectTeam = teamMembers?.filter((tm) => tm.project_id === project.id) || [];
      const primaryStudent = projectTeam[0];
      const student = profiles?.find((p) => p.id === primaryStudent?.student_id);
      const advisor = profiles?.find((p) => p.id === project.advisor_id);

      const statusLabels: Record<ProjectStatus, string> = {
        draft: "Draft",
        underreview: "Under Review",
        approved: "Approved",
        reject: "Rejected",
      };

      const typeLabels: Record<ProjectType, string> = {
        academic: "Capstone",
        competition: "Competition",
        service: "Social Service",
        other: "Other",
      };

      return {
        id: project.id,
        name: project.name,
        status: statusLabels[project.status as ProjectStatus] || project.status,
        type: typeLabels[project.project_type as ProjectType] || project.project_type,
        studentName: student?.name || "Unknown",
        advisorName: advisor?.name || null,
        submissionDate:
          project.created_at ||
          project.start_date ||
          resolveProjectDate(project).toISOString(),
        grade: project.grade,
        semester: project.semester === "1" ? "Spring" : "Fall",
        year: project.year,
      };
    });

    return { data: result, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
};
