import { useQuery } from "@tanstack/react-query";
import { fetchCourses, CourseDto } from "@/services/courseApi";

const queryKey = "courses";

export const useCourses = (token: string | null | undefined) => {
  return useQuery<CourseDto[], Error>({
    queryKey: [queryKey, token],
    queryFn: async () => {
      if (!token) {
        return [];
      }

      return fetchCourses(token);
    },
    enabled: Boolean(token)
  });
};
