import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Eye,
  Edit,
  Calendar,
  User,
  Award,
  Github,
  ExternalLink,
} from "lucide-react";
import type { ProjectDto } from "@/services/projectApi";


interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "coordinator" | "advisor";
}

interface MyProjectsViewProps {
  user: User;
  projects?: ProjectDto[];
  isLoading?: boolean;
  onViewProject: (projectId: string) => void;
  onEditProject?: (projectId: string) => void;
  authToken?: string | null;
}

// Mock data for projects
const mockProjects: ProjectDto[] = [
  {
    id: 1,
    title: "AI-Powered Learning Management System",
    type: "Capstone",
    status: "Approved",
    submissionDate: "2024-03-15T00:00:00.000Z",
    lastModified: "2024-03-20T00:00:00.000Z",
    description:
      "A comprehensive learning management system enhanced with artificial intelligence techniques to personalise learning pathways and automate assessments.",
    students: ["John Student", "Jane Doe"],
    studentDetails: [
      { id: 1, name: "John Student", email: "john@student.edu" },
      { id: 2, name: "Jane Doe", email: "jane@student.edu" },
    ],
    advisor: "Dr. Sarah Lecturer",
    advisorEmail: "sarah.lecturer@university.edu",
    teamName: "AI Innovation Team",
    keywords: ["AI", "Machine Learning", "Education"],
    externalLinks: ["https://example.com/demo"],
    files: [
      { name: "Final_Report.pdf", size: "2.3 MB", type: "PDF" },
      { name: "Presentation.pptx", size: "8.1 MB", type: "PowerPoint" },
    ],
    teamMembers: [
      {
        id: "1",
        name: "John Student",
        email: "john@student.edu",
        role: "student",
        isPrimary: true,
      },
      {
        id: "2",
        name: "Jane Doe",
        email: "jane@student.edu",
        role: "student",
        isPrimary: false,
      },
      {
        id: "3",
        name: "Dr. Sarah Lecturer",
        email: "sarah.lecturer@university.edu",
        role: "lecturer",
        isPrimary: false,
      },
    ],
    semester: "Spring",
    year: "2024",
    competitionName: null,
    award: null,
    courseCode: "CS401",
    completionDate: "2024-03-14",
    impact: "High",
  },
  {
    id: 2,
    title: "Mobile App for Community Gardens",
    type: "Social Service",
    status: "Under Review",
    submissionDate: "2024-06-10T00:00:00.000Z",
    lastModified: "2024-06-15T00:00:00.000Z",
    description:
      "Mobile application to connect community members with local gardens, manage harvest schedules, and coordinate volunteer shifts.",
    students: ["John Student"],
    studentDetails: [
      { id: 3, name: "John Student", email: "john@student.edu" },
    ],
    advisor: "Dr. Sarah Lecturer",
    advisorEmail: "sarah.lecturer@university.edu",
    teamName: "Green Tech Solutions",
    keywords: ["Mobile", "Community", "Gardens"],
    externalLinks: [],
    files: [
      { name: "Final_Report.pdf", size: "2.3 MB", type: "PDF" },
      { name: "Presentation.pptx", size: "8.1 MB", type: "PowerPoint" },
    ],
    teamMembers: [
      {
        id: "3",
        name: "John Student",
        email: "john@student.edu",
        role: "student",
        isPrimary: true,
      },
      {
        id: "4",
        name: "Dr. Sarah Lecturer",
        email: "sarah.lecturer@university.edu",
        role: "lecturer",
        isPrimary: false,
      },
    ],
    semester: "Summer",
    year: "2024",
    competitionName: null,
    award: null,
    courseCode: "CS302",
    completionDate: "2024-06-14",
    impact: "Medium",
  },
];

export const MyProjectsView = ({
  user,
  projects: passedProjects,
  isLoading = false,
  onViewProject,
  onEditProject,  authToken,}: MyProjectsViewProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const normalizeStatus = (status: ProjectDto["status"]) =>
    (status ?? "").toString().trim().toLowerCase();
  const advisorActionStatuses = useMemo(
    () =>
      new Set([
        "under review",
        "pending advisor review",
        "awaiting advisor approval",
      ]),
    [],
  );

  const getStatusColor = (status: ProjectDto["status"]) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "under review":
      case "pending advisor review":
      case "awaiting advisor approval":
        return "bg-yellow-100 text-yellow-800";
      case "draft":
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusDisplayName = (status: ProjectDto["status"]) => {
    const normalized = normalizeStatus(status);
    if (normalized === "draft") {
      return "Draft";
    }
    if (
      normalized === "under review" ||
      normalized === "pending advisor review" ||
      normalized === "awaiting advisor approval"
    ) {
      return "Under Review";
    }
    if (normalized === "approved") {
      return "Approved";
    }
    if (normalized === "rejected") {
      return "Rejected";
    }
    return status ?? "";
  };

  const projectsToUse = useMemo(() => {
    // When projects are passed from the backend (even if empty), use them directly.
    // Only fall back to mock data when passedProjects is undefined (not yet fetched).
    if (passedProjects !== undefined) {
      return passedProjects;
    }

    return isLoading ? [] : mockProjects;
  }, [passedProjects, isLoading]);

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const lowerEmail = user.email.toLowerCase();
    const lowerName = user.name.toLowerCase();

    return projectsToUse
      .filter((project) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          project.title.toLowerCase().includes(normalizedSearch) ||
          project.description.toLowerCase().includes(normalizedSearch) ||
          (project.courseCode?.toLowerCase().includes(normalizedSearch) ??
            false) ||
          project.keywords.some((keyword) =>
            keyword.toLowerCase().includes(normalizedSearch),
          );

        let matchesUser = true;

        if (user.role === "student") {
          const matchesByEmail = project.studentDetails.some(
            (student) => student.email.toLowerCase() === lowerEmail,
          );
          const matchesByName = project.students.some(
            (studentName) => studentName.toLowerCase() === lowerName,
          );
          matchesUser = matchesByEmail || matchesByName;
        } else if (user.role === "advisor") {
          const matchesAdvisor =
            project.advisorEmail?.toLowerCase() === lowerEmail;
          const matchesLecturerTeam = project.teamMembers.some(
            (member) =>
              member.role === "lecturer" &&
              member.email.toLowerCase() === lowerEmail,
          );
          matchesUser = matchesAdvisor || matchesLecturerTeam;
        } else if (user.role === "coordinator") {
          // Coordinators see all projects
          matchesUser = true;
        }
        return matchesSearch && matchesUser;
      })
      .sort((a, b) => {
        if (user.role === "advisor") {
          const aNeedsAction = advisorActionStatuses.has(
            normalizeStatus(a.status),
          );
          const bNeedsAction = advisorActionStatuses.has(
            normalizeStatus(b.status),
          );
          if (aNeedsAction && !bNeedsAction) return -1;
          if (bNeedsAction && !aNeedsAction) return 1;
        }
        return 0;
      });
  }, [projectsToUse, searchTerm, user, advisorActionStatuses]);

  const getViewTitle = () => {
    switch (user.role) {
      case "student":
        return "My Projects";
      case "advisor":
        return "Advisee Projects";
      case "coordinator":
        return "All Projects";
      default:
        return "Projects";
    }
  };

  return (
    <div>
      {/* Main Content - Projects */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-900">{getViewTitle()}</h2>
          <div className="text-sm text-gray-500">
            {filteredProjects.length} project(s) found
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search projects, course codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading && filteredProjects.length === 0 && (
          <div className="text-sm text-gray-500">Loading projects...</div>
        )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => {
          const projectId = project.id.toString();
          const displayTimestamp =
            project.submissionDate ?? project.lastModified;
          const dateLabel = project.submissionDate ? "Submitted" : "Updated";
          const githubLinks = project.externalLinks.filter((link) =>
            link.toLowerCase().includes("github.com"),
          );

          return (
            <Card key={projectId} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg line-clamp-2">
                    {project.title}
                  </CardTitle>
                  <Badge variant="outline" className="shrink-0 ml-2">
                    {project.type}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-3">
                  {project.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status */}
                <div className="flex justify-start items-center">
                  <Badge className={getStatusColor(project.status)}>
                    {getStatusDisplayName(project.status)}
                  </Badge>
                </div>

                {/* Project Details */}
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    <span>{project.students.join(", ")}</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>
                      {displayTimestamp
                        ? `${dateLabel}: ${new Date(
                            displayTimestamp,
                          ).toLocaleDateString()}`
                        : "Date not available"}
                    </span>
                  </div>
                  {project.grade && (
                    <div className="flex items-center">
                      <Award className="w-4 h-4 mr-2" />
                      <span>Grade: {project.grade}</span>
                    </div>
                  )}
                </div>

                {githubLinks.length > 0 && (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center font-medium text-gray-700">
                      <Github className="w-4 h-4 mr-2" />
                      GitHub Repository
                    </div>
                    <div className="space-y-1">
                      {githubLinks.map((link, index) => (
                        <a
                          key={`${projectId}-github-${index}`}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-600 hover:underline break-all"
                        >
                          <ExternalLink className="w-3 h-3 mr-2" />
                          {link}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-2">
                  <Button
                    onClick={() => onViewProject(projectId)}
                    size="sm"
                    className="flex-1"
                  >
                    {user.role === "advisor" &&
                    project.status === "Under Review" ? (
                      <Edit className="w-4 h-4 mr-2" />
                    ) : (
                      <Eye className="w-4 h-4 mr-2" />
                    )}
                    {user.role === "advisor" &&
                    project.status === "Under Review"
                      ? "Review"
                      : "View"}
                  </Button>

                  {/* Show Edit for students and coordinators when project is Rejected or Under Review */}
                  {user.role !== "advisor" &&
                    (normalizeStatus(project.status) === "rejected" ||
                      normalizeStatus(project.status) === "under review") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            try {
                              localStorage.setItem("editingProject", projectId);
                            } catch {}
                          }
                          if (typeof onEditProject === "function") {
                            onEditProject(projectId);
                            return;
                          }
                          onViewProject(projectId);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredProjects.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg">No projects found</div>
          <p className="text-gray-500 mt-2">
            {searchTerm
              ? "Try adjusting your search criteria"
              : "No projects have been submitted yet"}
          </p>
        </div>
      )}
      </div>

    </div>
  );
};
