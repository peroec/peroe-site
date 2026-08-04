import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router";
import {
  Newspaper,
  MessagesSquare,
  Tv,
  Link2,
  Heart,
  Briefcase,
  ChevronDown,
  BookOpen,
} from "lucide-react";
import { SITE_AVATAR, SITE_NAME, TOOL_ITEMS } from "~/lib/site";

const NAV_ITEMS = [
  { to: "/posts", label: "博客", icon: Newspaper },
  { to: "/forum", label: "论坛", icon: MessagesSquare },
  { to: "/webnovel", label: "小说", icon: BookOpen },
  { to: "/anime", label: "追番", icon: Tv },
  { to: "/friends", label: "友链", icon: Link2 },
  { to: "/sponsors", label: "赞助", icon: Heart },
];

export function Header() {
  const [toolsOpen, setToolsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" reloadDocument className="flex items-center gap-2">
          {SITE_AVATAR ? (
            <img
              src={SITE_AVATAR}
              alt="logo"
              className="h-8 w-8 rounded-sm border border-border object-cover"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-border text-sm font-bold text-white">
              {SITE_NAME.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="text-base font-bold text-white">{SITE_NAME}</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm text-muted">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded px-2.5 py-1.5 transition-colors hover:text-white ${
                  isActive ? "text-white" : ""
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}

          {/* 工具下拉 */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setToolsOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded px-2.5 py-1.5 transition-colors hover:text-white"
            >
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">工具</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${toolsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {toolsOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 overflow-hidden rounded-md border border-border bg-card shadow-xl">
                {TOOL_ITEMS.map((item) => (
                  <Link
                    key={item.label}
                    to={item.url}
                    onClick={() => setToolsOpen(false)}
                    className="block px-4 py-2.5 text-sm text-muted transition-colors hover:bg-card-hover hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
