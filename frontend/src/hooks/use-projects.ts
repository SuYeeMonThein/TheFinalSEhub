import { useQuery } from "@tanstack/react-query";
import {
  fetchProjects,
  fetchArchiveProjects,
  ProjectDto,
} from "@/services/projectApi";

const queryKey = "projects";

export const dedupeProjects = (projects: ProjectDto[]): ProjectDto[] => {
  // Keep track of seen project IDs to remove duplicates
  const seenIds = new Set<number>();
  
  return projects
    .filter((project) => {
      if (seenIds.has(project.id)) {
        return false;
      }
      seenIds.add(project.id);
      return true;
    })
    .map((project) => {
      // Remove duplicate files within each project
      if (project.files && project.files.length > 0) {
        const uniqueFiles = Array.from(
          new Map(project.files.map((file) => [file.name, file])).values()
        );
        return { ...project, files: uniqueFiles };
      }
      return project;
    });
};

export const useProjects = (token: string | null | undefined) => {
  return useQuery<ProjectDto[], Error>({
    queryKey: [queryKey, token],
    queryFn: async () => {
      if (!token) {
        return [];
      }

      return fetchProjects(token);
    },
    enabled: Boolean(token),
  });
};

export const useArchiveProjects = (token: string | null | undefined) => {
  return useQuery<ProjectDto[], Error>({
    queryKey: ["archive-projects", token],
    queryFn: async () => {
      if (!token) {
        return [];
      }

      return fetchArchiveProjects(token);
    },
    enabled: Boolean(token),
  });
};
