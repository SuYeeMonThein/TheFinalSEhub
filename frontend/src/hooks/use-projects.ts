import { useQuery } from "@tanstack/react-query";
import {
  fetchProjects,
  fetchArchiveProjects,
  ProjectDto,
} from "@/services/projectApi";

const queryKey = "projects";

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
