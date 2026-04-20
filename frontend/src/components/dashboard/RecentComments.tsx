import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, MessageSquare, ExternalLink } from "lucide-react";
import { useMemo } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "coordinator" | "advisor";
}

interface Comment {
  id: number;
  project_id: number;
  project_title?: string;
  user_id: number;
  user_name: string;
  user_email: string;
  user_role: string;
  comment: string;
  created_at: string;
}

interface RecentCommentsProps {
  user: User;
  authToken: string | null;
  onViewProject: (projectId: string) => void;
}

export const RecentComments = ({
  user,
  authToken,
  onViewProject,
}: RecentCommentsProps) => {
  // Fetch all comments from all projects
  const { data: allComments = [] } = useQuery<Comment[]>({
    queryKey: ["all-comments"],
    queryFn: async () => {
      if (!authToken) return [];
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5001"}/comments/all`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!authToken,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Filter and sort comments
  const recentComments = useMemo(() => {
    // Get last 10 comments, sorted by newest first
    return allComments
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 10);
  }, [allComments]);

  const formatCommentTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "advisor":
        return "bg-blue-500";
      case "student":
        return "bg-green-500";
      case "coordinator":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  if (recentComments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <CardTitle>Recent Conversations</CardTitle>
          </div>
          <CardDescription>
            Latest comments and discussions on projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">
              Comments will appear here as you communicate with{" "}
              {user.role === "student" ? "advisors" : "students"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <CardTitle>Recent Conversations</CardTitle>
        </div>
        <CardDescription>
          Latest comments and discussions on projects
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentComments.map((comment) => {
            const isOwnComment = comment.user_email === user.email;
            const roleColor = getRoleColor(comment.user_role);

            return (
              <div
                key={comment.id}
                className="flex space-x-3 pb-4 border-b last:border-b-0 last:pb-0"
              >
                <div
                  className={`w-10 h-10 ${roleColor} rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0`}
                >
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`font-semibold text-sm ${
                          isOwnComment ? "text-blue-600" : "text-gray-900"
                        }`}
                      >
                        {isOwnComment ? "You" : comment.user_name}
                      </span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {comment.user_role}
                      </Badge>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatCommentTime(comment.created_at)}
                    </span>
                  </div>
                  {comment.project_title && (
                    <div className="text-xs text-gray-500 mb-1">
                      on{" "}
                      <button
                        onClick={() =>
                          onViewProject(comment.project_id.toString())
                        }
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {comment.project_title}
                      </button>
                    </div>
                  )}
                  <p className="text-sm text-gray-700 leading-relaxed break-words line-clamp-2">
                    {comment.comment}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 mt-1 text-xs text-blue-600"
                    onClick={() => onViewProject(comment.project_id.toString())}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    View Project
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
