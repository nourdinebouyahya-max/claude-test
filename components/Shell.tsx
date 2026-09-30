"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Users, Briefcase, Megaphone, Wallet, CreditCard, ListChecks, KanbanSquare, PiggyBank, Tags,
  Landmark, ScrollText, Settings, Menu, PanelLeftClose, PanelLeftOpen, Moon, Sun, LogOut, ChevronRight, UserCheck,
} from "lucide-react";
import { Avatar } from "./ui";

const ICONS: Record<string, ReactNode> = {
  overview: <LayoutDashboard />,
  managers: <UserCheck />,
  clients: <Briefcase />,
  accounts: <Megaphone />,
  topups: <Wallet />,
  payments: <CreditCard />,
  tasks: <ListChecks />,
  workflow: <KanbanSquare />,
  finance: <PiggyBank />,
  pricing: <Tags />,
  banks: <Landmark />,
  activity: <ScrollText />,
  settings: <Settings />,
  users: <Users />,
};

export type NavItem = { href: string; label: string; icon: string; badge?: number; warn?: boolean; section?: string };

function formatToday() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Casablanca", weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date());
}

export default function Shell({
  nav,
  user,
  crumbsRoot,
  children,
  refreshMs,
}: {
  nav: NavItem[];
  user: { name: string; email: string; role: string };
  crumbsRoot: string;
  children: ReactNode;
  refreshMs?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(formatToday());
    setDark(document.documentElement.dataset.theme === "dark");
    try {
      setCollapsed(localStorage.getItem("ads-sidebar") === "1");
    } catch {}
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  // Session heartbeat: a disabled manager is bounced to login within seconds.
  useEffect(() => {
    let stop = false;
    const ping = async () => {
      try {
        const r = await fetch("/api/auth/ping", { cache: "no-store" });
        if (r.status === 401 && !stop) window.location.href = "/login?reason=signed-out";
      } catch {}
    };
    const t = setInterval(ping, 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  // Live dashboard: re-render server data periodically (skipped while a dialog is open or the tab is hidden).
  useEffect(() => {
    if (!refreshMs) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && !document.querySelector(".modal-back")) router.refresh();
    }, refreshMs);
    return () => clearInterval(t);
  }, [refreshMs, router]);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("ads-sidebar", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    document.cookie = `theme=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const isActive = (href: string) => (href === crumbsRoot ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  const current = nav.find((n) => isActive(n.href));
  const sub = current && pathname !== current.href ? pathname.slice(current.href.length + 1).split("/")[0] : null;

  let lastSection: string | undefined;
  return (
    <div className="shell">
      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${open ? "open" : ""}`}>
        <Link href={crumbsRoot} className="brand" style={{ textDecoration: "none" }}>
          <img src="/logo-icon.png" alt="" />
          <div className="brand-text">
            <div className="brand-word">
              <span>A</span>dsolution
            </div>
            <div className="brand-tag">{user.role === "admin" ? "Admin console" : "Manager desk"}</div>
          </div>
        </Link>
        <nav>
          {nav.map((n) => {
            const head = n.section && n.section !== lastSection ? n.section : null;
            lastSection = n.section ?? lastSection;
            return (
              <div key={n.href} style={{ display: "contents" }}>
                {head && <div className="nav-section">{head}</div>}
                <Link href={n.href} className={`nav-item ${isActive(n.href) ? "active" : ""}`} title={n.label}>
                  {ICONS[n.icon]}
                  <span className="nav-label">{n.label}</span>
                  {!!n.badge && <span className={`nav-badge ${n.warn ? "warn" : ""}`}>{n.badge}</span>}
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="side-foot">
          <Avatar name={user.name} />
          <div className="side-foot-text grow">
            <div className="bold ellipsis">{user.name}</div>
            <div className="xs muted ellipsis">{user.email}</div>
          </div>
          <button className="btn ghost icon side-foot-text" onClick={logout} title="Sign out" aria-label="Sign out">
            <LogOut />
          </button>
        </div>
      </aside>
      <div className={`scrim ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="btn ghost icon mobile-only" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu />
          </button>
          <button className="btn ghost icon desktop-only" onClick={toggleCollapse} aria-label="Collapse sidebar">
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </button>
          <div className="crumbs">
            <Link href={crumbsRoot}>{user.role === "admin" ? "Admin" : "Manager"}</Link>
            {current && current.href !== crumbsRoot && (
              <>
                <ChevronRight size={14} />
                {sub ? <Link href={current.href}>{current.label}</Link> : <span className="here">{current.label}</span>}
              </>
            )}
            {current?.href === crumbsRoot && (
              <>
                <ChevronRight size={14} />
                <span className="here">Overview</span>
              </>
            )}
            {sub && (
              <>
                <ChevronRight size={14} />
                <span className="here">Details</span>
              </>
            )}
          </div>
          <div className="spacer" />
          <span className="today">{today} · Casablanca</span>
          <button className="btn ghost icon" onClick={toggleTheme} aria-label="Toggle dark mode" title="Dark mode">
            {dark ? <Sun /> : <Moon />}
          </button>
          <button className="btn ghost icon mobile-only" onClick={logout} aria-label="Sign out">
            <LogOut />
          </button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
