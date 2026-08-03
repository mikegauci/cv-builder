"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "⊞" },
  { href: "/admin/cvs", label: "CVs", icon: "☰" },
  { href: "/admin/cover-letters", label: "Cover Letters", icon: "✉" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <aside className="w-56 bg-[#1a2744] flex flex-col min-h-screen">
      <div className="p-6 border-b border-white/10">
        <p className="text-white font-semibold text-sm tracking-wider">CV Builder</p>
        <p className="text-white/40 text-xs mt-0.5">Admin Panel</p>
      </div>

      <nav className="flex-1 py-6 space-y-1 px-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded transition-colors ${
              pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full text-left text-white/40 text-xs hover:text-white/70 transition-colors px-3 py-2"
        >
          Sign out →
        </button>
      </div>
    </aside>
  );
}
