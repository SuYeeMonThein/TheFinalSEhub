import { cn } from "@/lib/utils";
import mfuLogo from "@/components/Icons/mfu.png";
import {
  BookOpen,
  Upload,
  Archive,
  Users,
  BarChart3,
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
    <div className="w-64 bg-[#06402B] border-r border-[#043823] flex flex-col">
      <div className="p-6 border-b border-[#043823]">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center">
            <img
              src={mfuLogo}
              alt="MFU Logo"
              className="h-12 w-12 rounded-full object-contain"
            />
          </div>
          <div>
            <h2 className="font-semibold text-white">SE Project Hub</h2>
            <p className="text-sm text-gray-300 capitalize">
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
                      ? "bg-[#0B6D57] text-white border border-[#043823]"
                      : "text-gray-200 hover:bg-[#0B6D57]/80 hover:text-white",
                  )}
                >
                  <Icon className="w-5 h-5 text-gray-200" />
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
