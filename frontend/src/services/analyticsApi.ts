const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

export interface AnalyticsFilters {
  year?: number;
  semester?: "1" | "2" | "all";
  courseId?: number;
}

export interface ProjectMetrics {
  totalProjects: number;
  activeStudents: number;
  approvalRate: number;
  averageGrade: number | null;
  highImpactProjects: number;
  pendingReviews: number;
  completedProjects: number;
  rejectedProjects: number;
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

class AnalyticsService {
  private async fetchWithAuth<T>(endpoint: string, token: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Analytics API error: ${response.statusText}`);
    }

    return response.json();
  }

  async getMetrics(
    token: string,
    filters: AnalyticsFilters = {}
  ): Promise<ProjectMetrics> {
    const params = new URLSearchParams();
    if (filters.year) params.append("year", filters.year.toString());
    if (filters.semester) params.append("semester", filters.semester);
    if (filters.courseId) params.append("courseId", filters.courseId.toString());

    const query = params.toString();
    return this.fetchWithAuth<ProjectMetrics>(
      `/analytics/metrics${query ? `?${query}` : ""}`,
      token
    );
  }

  async getSubmissionTrends(
    token: string,
    filters: AnalyticsFilters = {},
    groupBy: "month" | "semester" | "year" = "month"
  ): Promise<SubmissionTrend[]> {
    const params = new URLSearchParams();
    if (filters.year) params.append("year", filters.year.toString());
    if (filters.semester) params.append("semester", filters.semester);
    params.append("groupBy", groupBy);

    const query = params.toString();
    return this.fetchWithAuth<SubmissionTrend[]>(
      `/analytics/trends${query ? `?${query}` : ""}`,
      token
    );
  }

  async getProjectTypeDistribution(
    token: string,
    filters: AnalyticsFilters = {}
  ): Promise<ProjectTypeDistribution[]> {
    const params = new URLSearchParams();
    if (filters.year) params.append("year", filters.year.toString());
    if (filters.semester) params.append("semester", filters.semester);

    const query = params.toString();
    return this.fetchWithAuth<ProjectTypeDistribution[]>(
      `/analytics/project-types${query ? `?${query}` : ""}`,
      token
    );
  }

  async getApprovalRates(
    token: string,
    filters: AnalyticsFilters = {}
  ): Promise<ApprovalRate[]> {
    const params = new URLSearchParams();
    if (filters.year) params.append("year", filters.year.toString());

    const query = params.toString();
    return this.fetchWithAuth<ApprovalRate[]>(
      `/analytics/approval-rates${query ? `?${query}` : ""}`,
      token
    );
  }

  async getStudentPerformance(
    token: string,
    filters: AnalyticsFilters = {},
    limit: number = 50
  ): Promise<StudentPerformance[]> {
    const params = new URLSearchParams();
    if (filters.year) params.append("year", filters.year.toString());
    if (filters.semester) params.append("semester", filters.semester);
    params.append("limit", limit.toString());

    const query = params.toString();
    return this.fetchWithAuth<StudentPerformance[]>(
      `/analytics/students${query ? `?${query}` : ""}`,
      token
    );
  }

  async getAdvisorPerformance(
    token: string,
    filters: AnalyticsFilters = {}
  ): Promise<AdvisorPerformance[]> {
    const params = new URLSearchParams();
    if (filters.year) params.append("year", filters.year.toString());
    if (filters.semester) params.append("semester", filters.semester);

    const query = params.toString();
    return this.fetchWithAuth<AdvisorPerformance[]>(
      `/analytics/advisors${query ? `?${query}` : ""}`,
      token
    );
  }

  async getCourseAnalytics(
    token: string,
    filters: AnalyticsFilters = {}
  ): Promise<CourseAnalytics[]> {
    const params = new URLSearchParams();
    if (filters.year) params.append("year", filters.year.toString());
    if (filters.semester) params.append("semester", filters.semester);

    const query = params.toString();
    return this.fetchWithAuth<CourseAnalytics[]>(
      `/analytics/courses${query ? `?${query}` : ""}`,
      token
    );
  }

  async getImpactAnalysis(
    token: string,
    filters: AnalyticsFilters = {}
  ): Promise<ImpactAnalysis[]> {
    const params = new URLSearchParams();
    if (filters.year) params.append("year", filters.year.toString());
    if (filters.semester) params.append("semester", filters.semester);

    const query = params.toString();
    return this.fetchWithAuth<ImpactAnalysis[]>(
      `/analytics/impact${query ? `?${query}` : ""}`,
      token
    );
  }

  async exportData(
    token: string,
    filters: AnalyticsFilters = {},
    format: "json" | "csv" = "csv"
  ): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters.year) params.append("year", filters.year.toString());
    if (filters.semester) params.append("semester", filters.semester);
    if (filters.courseId) params.append("courseId", filters.courseId.toString());
    params.append("format", format);

    const query = params.toString();
    const response = await fetch(
      `${API_BASE_URL}/analytics/export${query ? `?${query}` : ""}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return response.blob();
  }

  async getDetailedProjects(
    token: string,
    filters: AnalyticsFilters = {}
  ): Promise<DetailedProject[]> {
    const params = new URLSearchParams();
    if (filters.year) params.append("year", filters.year.toString());
    if (filters.semester) params.append("semester", filters.semester);
    if (filters.courseId) params.append("courseId", filters.courseId.toString());

    const query = params.toString();
    return this.fetchWithAuth<DetailedProject[]>(
      `/analytics/export${query ? `?${query}` : ""}`,
      token
    );
  }
}

export const analyticsApi = new AnalyticsService();
