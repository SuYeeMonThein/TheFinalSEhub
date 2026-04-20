import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Download, TrendingUp, Award, Users, FileText, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { analyticsApi } from "@/services/analyticsApi";
import { auth } from "@/lib/firebase";

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "coordinator" | "advisor";
}

interface ReportingDashboardProps {
  user: User;
}

export const ReportingDashboard = ({ user }: ReportingDashboardProps) => {
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedSemester, setSelectedSemester] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Real data state
  const [metrics, setMetrics] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [projectTypes, setProjectTypes] = useState<any[]>([]);
  const [approvalRates, setApprovalRates] = useState<any[]>([]);

  // Helper function to get fresh auth token
  const getAuthToken = async (): Promise<string> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("User not authenticated. Please log in again.");
    }
    // Force refresh token to ensure it's valid and not expired
    return await currentUser.getIdToken(true);
  };

  useEffect(() => {
    if (user.role === "coordinator") {
      loadAnalytics();
    }
  }, [selectedYear, selectedSemester, user.role]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get fresh token before making API calls
      const token = await getAuthToken();
      console.log("Fetching analytics data for:", { year: selectedYear, semester: selectedSemester });

      // Convert year and semester to the format expected by the API
      const yearNum = selectedYear === "all" ? undefined : parseInt(selectedYear);
      const semesterValue = selectedSemester === "all" ? "all" : 
                           selectedSemester === "spring" ? "1" : 
                           selectedSemester === "summer" ? "2" : 
                           selectedSemester === "fall" ? "3" : "all";

      const filters = {
        year: yearNum,
        semester: semesterValue as "1" | "2" | "all"
      };

      // Fetch all analytics data from API
      const [metricsData, trendsData, typesData, ratesData] = await Promise.all([
        analyticsApi.getMetrics(token, filters),
        analyticsApi.getSubmissionTrends(token, filters, "month"),
        analyticsApi.getProjectTypeDistribution(token, filters),
        analyticsApi.getApprovalRates(token, filters),
      ]);

      console.log("Analytics data loaded:", { metricsData, trendsData, typesData, ratesData });

      setMetrics(metricsData);
      setTrends(trendsData);
      setProjectTypes(typesData);
      setApprovalRates(ratesData);
    } catch (err: any) {
      console.error("Failed to load analytics:", err);
      const errorMessage = err.message || "Failed to load analytics data";
      setError(errorMessage);
      
      // If authentication error, suggest re-login
      if (errorMessage.includes("authenticated") || errorMessage.includes("token")) {
        setError("Your session has expired. Please logout and login again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      // Get fresh token before export
      const token = await getAuthToken();
      
      const yearNum = selectedYear === "all" ? undefined : parseInt(selectedYear);
      const semesterValue = selectedSemester === "all" ? "all" : 
                           selectedSemester === "spring" ? "1" : 
                           selectedSemester === "summer" ? "2" : 
                           selectedSemester === "fall" ? "3" : "all";

      const filters = {
        year: yearNum,
        semester: semesterValue as "1" | "2" | "all"
      };

      const blob = await analyticsApi.exportData(token, filters, "csv");
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-report-${selectedYear}-${selectedSemester}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error("Failed to export report:", err);
      alert("Failed to export report. Please try logging in again.");
    }
  };

  if (user.role !== "coordinator") {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-lg">Access Denied</div>
        <p className="text-gray-500 mt-2">
          Only Program Coordinators can access reports
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading analytics from database...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 text-lg">Error Loading Analytics</div>
        <p className="text-gray-500 mt-2">{error}</p>
        <Button onClick={loadAnalytics} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Reports & Analytics</h2>
          <p className="text-sm text-gray-500 mt-1">Real-time data from Supabase database</p>
        </div>
        <Button onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Filters */}
      <div className="flex space-x-4">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select academic year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2026">2026</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2023">2023</SelectItem>
            <SelectItem value="2022">2022</SelectItem>
            <SelectItem value="all">All Years</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedSemester} onValueChange={setSelectedSemester}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select semester" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Semesters</SelectItem>
            <SelectItem value="spring">Spring</SelectItem>
            <SelectItem value="summer">Summer</SelectItem>
            <SelectItem value="fall">Fall</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalProjects || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.approvedProjects || 0} approved, {metrics?.pendingProjects || 0} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalStudents || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across {metrics?.totalProjects || 0} projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.approvalRate ? `${metrics.approvalRate.toFixed(1)}%` : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.rejectedProjects || 0} rejected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Team Size</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.averageTeamSize ? metrics.averageTeamSize.toFixed(1) : '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              students per project
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submission Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Submission Trends</CardTitle>
            <CardDescription>
              Project submissions over time (from Supabase)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="submissions" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No submission data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project Types Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Project Types Distribution</CardTitle>
            <CardDescription>
              Breakdown by category (from database)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projectTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={projectTypes}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {projectTypes.map((entry, index) => {
                      const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088fe", "#a4de6c"];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No project type data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval Rates */}
        <Card>
          <CardHeader>
            <CardTitle>Approval Rates by Semester</CardTitle>
            <CardDescription>
              Real approval statistics from database
            </CardDescription>
          </CardHeader>
          <CardContent>
            {approvalRates.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={approvalRates}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="approved" fill="#82ca9d" name="Approved" />
                  <Bar dataKey="rejected" fill="#ff7300" name="Rejected" />
                  <Bar dataKey="pending" fill="#ffc658" name="Pending" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No approval rate data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Current Status Overview</CardTitle>
            <CardDescription>
              Real-time project status distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="font-medium text-green-900">Approved</span>
                <Badge className="bg-green-600">{metrics?.approvedProjects || 0}</Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                <span className="font-medium text-yellow-900">Pending Review</span>
                <Badge className="bg-yellow-600">{metrics?.pendingProjects || 0}</Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <span className="font-medium text-red-900">Rejected</span>
                <Badge className="bg-red-600">{metrics?.rejectedProjects || 0}</Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="font-medium text-blue-900">In Progress</span>
                <Badge className="bg-blue-600">{metrics?.inProgressProjects || 0}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Source Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 text-blue-900">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              Live data from Supabase database • Last updated: {new Date().toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
