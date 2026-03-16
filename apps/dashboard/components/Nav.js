import { useRouter } from "next/router";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "War Room" },
  { href: "/expos", label: "Expo Directory" },
  { href: "/sales", label: "Sales" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/admin/intelligence", label: "Intelligence" },
  { href: "/admin/system", label: "System" },
  { href: "/admin", label: "Users", exact: true },
  { href: "/settings", label: "Settings" },
];

export default function Nav({ subtitle }) {
  const router = useRouter();
  const path = router.pathname;

  function isActive(item) {
    if (item.exact) return path === item.href;
    if (item.href === "/") return path === "/";
    return path === item.href || path.startsWith(item.href + "/");
  }

  return (
    <div className="page-hdr">
      <div>
        <div className="page-brand">
          ELIZA<span className="dot">.</span>
        </div>
        {subtitle && <div className="page-sub">{subtitle}</div>}
      </div>
      <nav className="page-nav">
        {NAV_ITEMS.map((item) => (
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
