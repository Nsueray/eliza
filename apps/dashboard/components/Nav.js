import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/", label: "War Room", permission: "war_room" },
  { href: "/expos", label: "Expo Directory", permission: "expo_directory" },
  { href: "/sales", label: "Sales", permission: "sales" },
  { href: "/finance", label: "Finance", permission: "finance" },
  { href: "/targets", label: "Targets", permission: "targets" },
  { href: "/admin/logs", label: "Logs", permission: "logs" },
  { href: "/admin/intelligence", label: "Intelligence", permission: "intelligence" },
  { href: "/admin/system", label: "System", permission: "system" },
  { href: "/admin", label: "Users", exact: true, permission: "users" },
  { href: "/settings", label: "Settings", permission: "settings" },
];

export default function Nav({ subtitle }) {
  const router = useRouter();
  const path = router.pathname;
  const { user } = useAuth();

  const perms = user?.dashboard_permissions || {};

  function isActive(item) {
    if (item.exact) return path === item.href;
    if (item.href === "/") return path === "/";
    return path === item.href || path.startsWith(item.href + "/");
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => perms[item.permission] !== false
  );

  return (
    <div className="page-hdr">
      <div>
        <div className="page-brand">
          ELIZA<span className="dot">.</span>
        </div>
        {subtitle && <div className="page-sub">{subtitle}</div>}
      </div>
      <nav className="page-nav">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link${isActive(item) ? " active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
