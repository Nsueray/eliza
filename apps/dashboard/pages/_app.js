import "@/styles/design-system.css";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useRouter } from "next/router";
import { useEffect } from "react";

const PUBLIC_PATHS = ["/login"];

function AuthGuard({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !PUBLIC_PATHS.includes(router.pathname)) {
      router.replace("/login");
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
