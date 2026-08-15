import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type SwitchableRole = "advisor" | "coordinator";

interface MockRoleChooserProps {
  email: string;
  onSelectRole: (role: SwitchableRole) => void;
  onLogout: () => void;
}

export const MockRoleChooser = ({
  email,
  onSelectRole,
  onLogout,
}: MockRoleChooserProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Choose Dashboard Role</CardTitle>
          <CardDescription>
            Your account has both Advisor and Coordinator access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Select which role to use for this session. You can switch by
            logging out and choosing again.
          </div>

          <div className="space-y-2">
            <p className="text-sm text-gray-600">Signed in as</p>
            <p className="font-medium text-gray-900">{email}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button onClick={() => onSelectRole("advisor")}>Continue as Advisor</Button>
            <Button onClick={() => onSelectRole("coordinator")} variant="secondary">
              Continue as Coordinator
            </Button>
          </div>

          <Button onClick={onLogout} variant="outline" className="w-full">
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
