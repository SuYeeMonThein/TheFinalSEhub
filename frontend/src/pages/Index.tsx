import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { LoginForm } from "@/components/auth/LoginForm";
import { SetPasswordModal } from "@/components/auth/SetPasswordModal";
import { MockRoleChooser, SwitchableRole } from "@/components/auth/MockRoleChooser";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { auth } from "@/lib/firebase";
import { onIdTokenChanged } from "firebase/auth";
import { getMyRoles } from "@/services/userApi";

type AppRole = "student" | "coordinator" | "advisor";

const Index = () => {
  const [user, setUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: AppRole;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedMockRole, setSelectedMockRole] = useState<SwitchableRole | null>(null);
  const [canChooseRole, setCanChooseRole] = useState(false);
  const [isResolvingRoleAccess, setIsResolvingRoleAccess] = useState(false);

  // Load user from localStorage on component mount
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("authToken");
    const isFirstLogin = localStorage.getItem("isFirstLogin") === "true";

    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);

        // Show password modal if first login
        if (isFirstLogin) {
          setShowPasswordModal(true);
        }
      } catch (error) {
        console.error("Failed to parse saved user data:", error);
        localStorage.removeItem("user");
      }
    }

    if (savedToken) {
      setAuthToken(savedToken);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!user || !authToken) {
      setCanChooseRole(false);
      setIsResolvingRoleAccess(false);
      return;
    }

    let isCancelled = false;
    setIsResolvingRoleAccess(true);

    const resolveRoleAccess = async () => {
      try {
        const rolesResponse = await getMyRoles(authToken);
        const hasDualRole =
          rolesResponse.roles.includes("advisor") &&
          rolesResponse.roles.includes("coordinator");

        if (isCancelled) {
          return;
        }

        setCanChooseRole(hasDualRole);

        if (hasDualRole) {
          const savedMockRole = localStorage.getItem("mockRoleOverride");
          if (savedMockRole === "advisor" || savedMockRole === "coordinator") {
            setSelectedMockRole(savedMockRole);
          }
        } else {
          setSelectedMockRole(null);
          localStorage.removeItem("mockRoleOverride");
          localStorage.removeItem("actingRole");
        }
      } catch (error) {
        if (isCancelled) {
          return;
        }

        console.warn("Failed to resolve dual-role access", error);
        setCanChooseRole(false);
        setSelectedMockRole(null);
        localStorage.removeItem("mockRoleOverride");
        localStorage.removeItem("actingRole");
      } finally {
        if (!isCancelled) {
          setIsResolvingRoleAccess(false);
        }
      }
    };

    void resolveRoleAccess();

    return () => {
      isCancelled = true;
    };
  }, [authToken, user]);

  // Keep Firebase ID token fresh and synced
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const fresh = await firebaseUser.getIdToken(/* forceRefresh */ true);
          setAuthToken(fresh);
          localStorage.setItem("authToken", fresh);
          localStorage.setItem("firebaseAuthToken", fresh);
          // Restore user from storage if present, but do not synthesize a new one here
          if (!user) {
            const stored = localStorage.getItem("user");
            if (stored) {
              try {
                setUser(JSON.parse(stored));
              } catch {
                // ignore
              }
            }
          }
        } catch (e) {
          console.warn("Failed to refresh Firebase ID token", e);
        }
      } else {
        // Fully clear auth and user on sign-out/change
        setAuthToken(null);
        setUser(null);
        localStorage.removeItem("authToken");
        localStorage.removeItem("firebaseAuthToken");
        localStorage.removeItem("user");
        localStorage.removeItem("currentView");
        localStorage.removeItem("selectedProject");
        localStorage.removeItem("editingProject");
      }
    });

    // Optional periodic refresh safeguard
    const refreshTimer = setInterval(
      () => {
        const u = auth.currentUser;
        if (u) {
          void u.getIdToken(true).catch(() => {});
        }
      },
      45 * 60 * 1000,
    ); // every 45 minutes

    return () => {
      unsubscribe();
      clearInterval(refreshTimer);
    };
  }, [user]);

  const handleLogin = (
    userData: {
      id: string;
      name: string;
      email: string;
      role: AppRole;
    },
    token: string,
    isFirstLogin?: boolean,
  ) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    setAuthToken(token);
    localStorage.setItem("authToken", token);

    // Force role choice resolution on each fresh login.
    setSelectedMockRole(null);
    localStorage.removeItem("mockRoleOverride");
    localStorage.removeItem("actingRole");

    // Show password modal for first-time email link sign-ins
    if (isFirstLogin) {
      setShowPasswordModal(true);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setAuthToken(null);
    setShowPasswordModal(false);
    setSelectedMockRole(null);
    localStorage.removeItem("user");
    localStorage.removeItem("currentView");
    localStorage.removeItem("selectedProject");
    localStorage.removeItem("editingProject");
    localStorage.removeItem("projects");
    localStorage.removeItem("firebaseAuthToken");
    localStorage.removeItem("authToken");
    localStorage.removeItem("isFirstLogin");
    localStorage.removeItem("passwordSkipped");
    localStorage.removeItem("passwordSet");
    localStorage.removeItem("mockRoleOverride");
    localStorage.removeItem("actingRole");
    void signOut(auth).catch((error) => {
      console.error("Failed to sign out from Firebase", error);
    });
  };

  const handleMockRoleSelect = (role: SwitchableRole) => {
    setSelectedMockRole(role);
    localStorage.setItem("mockRoleOverride", role);
    localStorage.setItem("actingRole", role);
  };

  const handlePasswordModalClose = () => {
    setShowPasswordModal(false);
    localStorage.removeItem("isFirstLogin");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  if (isResolvingRoleAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking role access...</p>
        </div>
      </div>
    );
  }

  const shouldShowMockRoleChooser = canChooseRole && selectedMockRole === null;

  if (shouldShowMockRoleChooser) {
    return (
      <MockRoleChooser
        email={user.email}
        onSelectRole={handleMockRoleSelect}
        onLogout={handleLogout}
      />
    );
  }

  const effectiveUser: {
    id: string;
    name: string;
    email: string;
    role: AppRole;
  } =
    canChooseRole && selectedMockRole
      ? { ...user, role: selectedMockRole }
      : user;

  return (
    <>
      <Dashboard
        user={effectiveUser}
        authToken={authToken}
        onLogout={handleLogout}
      />
      <SetPasswordModal
        open={showPasswordModal}
        onClose={handlePasswordModalClose}
        userEmail={effectiveUser.email}
      />
    </>
  );
};

export default Index;
