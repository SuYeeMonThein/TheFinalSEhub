import { useMemo, useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MyProjectsView } from "@/components/projects/MyProjectsView";
import { ProjectSubmissionForm } from "@/components/projects/ProjectSubmissionForm";
import { ProjectArchive } from "@/components/projects/ProjectArchive";
import { UserManagement } from "@/components/admin/UserManagement";
import { ReportingDashboard } from "@/components/reports/ReportingDashboard";
import { ProjectDetailView } from "@/components/projects/ProjectDetailView";
import { RubricManagement } from "@/components/rubrics/RubricManagement";
import { RubricViewer } from "@/components/rubrics/RubricViewer";
import { CourseManagement } from "@/components/courses/CourseManagement";
import { AdvisorCoursePlaceholder } from "@/components/courses/AdvisorCoursePlaceholder";
import { StudentRosterUpload } from "@/components/courses/StudentRosterUpload";
import { AccountDetails } from "@/components/auth/AccountDetails";
import { useProjects, useArchiveProjects } from "@/hooks/use-projects";
import type { ProjectDto } from "@/services/projectApi";

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "coordinator" | "advisor";
}

interface DashboardProps {
  user: User;
  authToken: string | null;
  onLogout: () => void;
}

export const Dashboard = ({ user, authToken, onLogout }: DashboardProps) => {
  const [currentView, setCurrentView] = useState("my-projects");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [sourceView, setSourceView] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [clientProjectOverrides, setClientProjectOverrides] = useState<
    Record<string, Partial<ProjectDto>>
  >(() => {
    try {
      const raw = localStorage.getItem("clientProjectOverrides");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const {
    data: projects = [],
    isLoading: projectsLoading,
    refetch: refetchProjects,
  } = useProjects(authToken);

  const { data: archiveProjects = [], isLoading: archiveLoading } =
    useArchiveProjects(authToken);

  // Load saved state on component mount
  useEffect(() => {
    const savedView = localStorage.getItem("currentView");
    const savedProject = localStorage.getItem("selectedProject");

    if (savedView) {
      setCurrentView(savedView);
    }

    if (savedProject && savedProject !== "null") {
      setSelectedProject(savedProject);
    }
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    localStorage.setItem("currentView", currentView);
  }, [currentView]);

  useEffect(() => {
    localStorage.setItem("selectedProject", selectedProject || "null");
  }, [selectedProject]);

  // Persist selected project across reloads
  useEffect(() => {
    try {
      localStorage.setItem(
        "clientProjectOverrides",
        JSON.stringify(clientProjectOverrides),
      );
    } catch {}
  }, [clientProjectOverrides]);

  const handleViewChange = (view: string) => {
    setCurrentView(view);
    setSelectedProject(null); // Clear selected project when changing views
  };

  const handleProjectSelection = (projectId: string, source?: string) => {
    setSelectedProject(projectId);
    setSourceView(source || null);
    if (source) {
      setCurrentView(source);
    }
  };

  const renderContent = () => {
    const augmentedProjects: ProjectDto[] = useMemo(() => {
      if (!projects) return [];
      return projects.map((p) => {
        const o = clientProjectOverrides[p.id?.toString?.() ?? ""];
        if (!o) {
          return p;
        }

        // Always trust backend status to avoid stale local overrides showing
        // outdated state (e.g., still "Under Review" after advisor rejected).
        const { status: _ignoredStatus, ...safeOverride } = o;
        return { ...p, ...safeOverride };
      });
    }, [projects, clientProjectOverrides]);

    const handleEditProject = (projectId: string) => {
      // Ensure detail view doesn't take precedence over edit view
      setSelectedProject(null);
      setEditingProjectId(projectId);
      setCurrentView("edit-project");
    };

    const handleProjectUpdate = (
      projectId: string,
      updatedData: Partial<ProjectDto>,
      newStatus?: ProjectDto["status"],
    ) => {
      setClientProjectOverrides((prev) => ({
        ...prev,
        [projectId]: {
          ...(prev[projectId] || {}),
          ...updatedData,
          ...(newStatus ? { status: newStatus } : {}),
        },
      }));
    };

    if (selectedProject && currentView !== "edit-project") {
      const detailProjects =
        sourceView === "archive" ? archiveProjects : augmentedProjects;

      return (
        <ProjectDetailView
          projectId={selectedProject}
          user={user}
          onBack={() => setSelectedProject(null)}
          projects={detailProjects}
          isArchiveView={sourceView === "archive"}
          authToken={authToken}
          onProjectUpdate={(updatedList) => {
            // Align client overrides with server-updated statuses
            setClientProjectOverrides((prev) => {
              const next = { ...prev };
              for (const p of updatedList) {
                const key = p.id?.toString?.() ?? "";
                if (!key) continue;
                next[key] = { ...(next[key] || {}), status: p.status };
              }
              return next;
            });
          }}
          onProjectRefresh={() => void refetchProjects()}
        />
      );
    }

    switch (currentView) {
      case "my-projects":
        return (
          <MyProjectsView
            user={user}
            projects={augmentedProjects}
            isLoading={projectsLoading}
            onViewProject={(id) => handleProjectSelection(id, "my-projects")}
            onEditProject={handleEditProject}
            authToken={authToken}
          />
        );
      case "submit-project":
        return (
          <ProjectSubmissionForm
            user={user}
            authToken={authToken}
            onBack={() => handleViewChange("my-projects")}
            projects={augmentedProjects}
            onProjectCreated={() => void refetchProjects()}
          />
        );
      case "edit-project":
        return (
          <ProjectSubmissionForm
            user={user}
            authToken={authToken}
            onBack={() => {
              setEditingProjectId(null);
              handleViewChange("my-projects");
            }}
            editingProjectId={editingProjectId ?? undefined}
            projects={augmentedProjects}
            onProjectUpdate={(id, updated, status) => {
              // Map the form's update data into a shape compatible with ProjectDto
              const mapped: Partial<ProjectDto> = {
                title: updated.title ?? undefined,
                type: (updated.type as ProjectDto["type"]) ?? undefined,
                description: updated.description ?? undefined,
                keywords: updated.keywords ?? undefined,
                teamName: updated.teamName ?? undefined,
                externalLinks: updated.externalLinks ?? undefined,
                teamMembers: (updated.teamMembers as any) ?? undefined,
                lastModified: new Date().toISOString(),
              };
              handleProjectUpdate(id, mapped, status);
            }}
          />
        );
      case "archive":
        return (
          <ProjectArchive
            user={user}
            projects={archiveProjects}
            isLoading={archiveLoading}
            onViewProject={(id) => handleProjectSelection(id, "archive")}
          />
        );
      case "users":
        return <UserManagement user={user} />;
      case "courses":
        return <CourseManagement user={user} authToken={authToken} />;
      case "advisor-course":
        return (
          <AdvisorCoursePlaceholder
            authToken={authToken}
            onViewProject={(id) => handleProjectSelection(id, "advisor-course")}
            onCreateRubric={() => handleViewChange("rubrics")}
          />
        );
      case "student-roster":
        return <StudentRosterUpload user={user} authToken={authToken} />;
      case "reports":
        return <ReportingDashboard user={user} />;
      case "rubrics":
        return user.role === "advisor" ? (
          <RubricManagement user={user} authToken={authToken} />
        ) : (
          <RubricViewer user={user} authToken={authToken} />
        );
      case "account-details":
        return <AccountDetails user={user} authToken={authToken} />;
      default:
        return (
          <MyProjectsView
            user={user}
            projects={augmentedProjects}
            isLoading={projectsLoading}
            onViewProject={(id) => handleProjectSelection(id, "my-projects")}
            onEditProject={handleEditProject}
            authToken={authToken}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        user={user}
        currentView={currentView}
        onViewChange={handleViewChange}
      />
      <div className="flex-1 flex flex-col">
        <Header user={user} onLogout={onLogout} />
        <main className="flex-1 p-6">{renderContent()}</main>
      </div>
    </div>
  );
};
