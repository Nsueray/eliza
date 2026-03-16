import "@/styles/design-system.css";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useRouter } from "next/router";
import { useEffect } from "react";

const PUBLIC_PATHS = ["/login", "/unauthorized"];

const ROUTE_PERMISSIONS = {
  "/": "war_room",
  "/expos": "expo_directory",
  "/expos/detail": "expo_detail",
  "/sales": "sales",
  "/finance": "finance",
  "/admin/logs": "logs",
  "/admin/intelligence": "intelligence",
  "/admin/system": "system",
  "/admin": "users",
  "/admin/users/new": "users",
  "/admin/users/[id]": "users",
  "/settings": "settings",
};

function AuthGuard({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !PUBLIC_PATHS.includes(router.pathname)) {
      router.replace("/login");
    }
  }, [user, loading, router.pathname]);

  useEffect(() => {
    if (!loading && user && !PUBLIC_PATHS.includes(router.pathname)) {
      const requiredPermission = ROUTE_PERMISSIONS[router.pathname];
      if (requiredPermission && user.dashboard_permissions?.[requiredPermission] === false) {
        router.replace("/unauthorized");
      }
    }
  }, [user, loading, router.pathname]);

  if (loading) {
    return (
      <div className="loading" style={{ marginTop: "40vh" }}>
        Loading...
      </div>
    );
  }

  if (!user && !PUBLIC_PATHS.includes(router.pathname)) {
    return null;
  }

  // Block render if permission denied (while redirect happens)
  if (user && !PUBLIC_PATHS.includes(router.pathname)) {
    const requiredPermission = ROUTE_PERMISSIONS[router.pathname];
    if (requiredPermission && user.dashboard_permissions?.[requiredPermission] === false) {
      return null;
    }
  }

  return children;
}

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <Component {...pageProps} />
      </AuthGuard>
    </AuthProvider>
  );
}
