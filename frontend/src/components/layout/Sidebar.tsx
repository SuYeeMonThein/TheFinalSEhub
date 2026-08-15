import { cn } from "@/lib/utils";
import {
  BookOpen,
  Upload,
  Archive,
  Users,
  BarChart3,
  FileText,
  Search,
  ClipboardList,
  GraduationCap,
  UserPlus,
  UserCog,
} from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "coordinator" | "advisor";
}

interface SidebarProps {
  user: User;
  currentView: string;
  onViewChange: (view: string) => void;
}

export const Sidebar = ({ user, currentView, onViewChange }: SidebarProps) => {
  const getMenuItems = () => {
    const commonItems = [
      { id: "archive", label: "Project Archive", icon: Archive },
    ];

    switch (user.role) {
      case "student":
        return [
          { id: "my-projects", label: "My Projects", icon: BookOpen },
          { id: "submit-project", label: "Submit Project", icon: Upload },
          ...commonItems,
          { id: "rubrics", label: "Rubrics", icon: ClipboardList },
          { id: "account-details", label: "Account Detail", icon: UserCog },
        ];
      case "advisor":
        return [
          { id: "my-projects", label: "Advisee Projects", icon: BookOpen },
          ...commonItems,
          { id: "advisor-course", label: "Course", icon: GraduationCap },
          { id: "rubrics", label: "Rubric Management", icon: ClipboardList },
          { id: "account-details", label: "Account Detail", icon: UserCog },
        ];
      case "coordinator":
        return [
          { id: "my-projects", label: "All Projects", icon: BookOpen },
          { id: "users", label: "User Management", icon: Users },
          { id: "courses", label: "Course Management", icon: GraduationCap },
          { id: "student-roster", label: "Student Roster", icon: UserPlus },
          { id: "rubrics", label: "Rubrics", icon: ClipboardList },
          { id: "reports", label: "Reports", icon: BarChart3 },
          ...commonItems,
          { id: "account-details", label: "Account Detail", icon: UserCog },
        ];
      default:
        return commonItems;
    }
  };

  const menuItems = getMenuItems();

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">SE Project Hub</h2>
            <p className="text-sm text-gray-500 capitalize">
              {user.role === "advisor" ? "Advisor" : user.role}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onViewChange(item.id)}
                  className={cn(
                    "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    currentView === item.id
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-700 hover:bg-gray-50",
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};
