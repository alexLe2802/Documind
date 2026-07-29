"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Bot,
  Bookmark,
  CreditCard,
  FileUp,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "../components/ui/Brand";
import { LanguageSwitcher } from "../components/ui/LanguageSwitcher";
import { useAuth } from "../features/auth/useAuth";
import { useLanguage } from "../i18n/LanguageProvider";
import { localize } from "../i18n/localize";
import { ROUTES } from "../lib/routes";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  accent?: boolean;
};

function isActivePath(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== ROUTES.dashboard && pathname.startsWith(`${href}/`))
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { locale, t } = useLanguage();
  const text = (vi: string, en: string) => localize(locale, vi, en);
  const pathname = usePathname() ?? ROUTES.dashboard;
  const router = useRouter();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarCompact, setIsSidebarCompact] = useState(false);
  const initial = user?.fullName?.charAt(0).toUpperCase() ?? "D";

  const workspaceNav: NavItem[] = [
    {
      href: ROUTES.dashboard,
      label: t("nav.dashboard"),
      icon: LayoutDashboard,
    },
    { href: ROUTES.library, label: t("nav.library"), icon: LibraryBig },
    { href: ROUTES.upload, label: t("nav.upload"), icon: FileUp },
    { href: ROUTES.community, label: t("nav.community"), icon: UsersRound },
    { href: ROUTES.saved, label: t("nav.saved"), icon: Bookmark },
  ];

  const aiNav: NavItem[] = [
    {
      href: ROUTES.aiChat,
      label: text("AI Chatbot", "AI Chatbot"),
      icon: Bot,
      accent: true,
    },
  ];

  const accountNav: NavItem[] = [
    {
      href: ROUTES.subscription,
      label: t("nav.subscription"),
      icon: CreditCard,
    },
    { href: ROUTES.profile, label: t("common.profile"), icon: UserRound },
  ];

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await logout();
    router.replace(ROUTES.login);
  }

  function renderLink(item: NavItem) {
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`${isActivePath(pathname, item.href) ? "active" : ""}${item.accent ? " ai-nav-link" : ""}`}
        title={isSidebarCompact ? item.label : undefined}
      >
        <Icon size={18} />
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <div
      className={`app-shell${isSidebarCompact ? " app-shell--compact" : ""}`}
    >
      {isMobileNavOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label={text("Đóng điều hướng", "Close navigation")}
          onClick={() => setIsMobileNavOpen(false)}
        />
      ) : null}

      <aside className={`sidebar${isMobileNavOpen ? " sidebar--open" : ""}`}>
        <div className="sidebar-brand-row">
          <Brand compact={isSidebarCompact} />
          <button
            type="button"
            className="sidebar-collapse"
            onClick={() => setIsSidebarCompact((current) => !current)}
            aria-label={isSidebarCompact ? "Expand sidebar" : "Collapse sidebar"}
            title={isSidebarCompact ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCompact ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
          <button
            type="button"
            className="sidebar-close-mobile"
            aria-label={text("Đóng điều hướng", "Close navigation")}
            onClick={() => setIsMobileNavOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        <nav
          className="side-nav"
          aria-label={text("Điều hướng không gian học tập", "Workspace navigation")}
        >
          <span className="side-nav-label">
            {text("Không gian học tập", "Workspace")}
          </span>
          {workspaceNav.map(renderLink)}
        </nav>

        <nav
          className="side-nav side-nav--ai"
          aria-label={text("Điều hướng AI", "AI navigation")}
        >
          <span className="side-nav-label">
            <Sparkles size={13} />
            {text("Hỏi AI", "Ask AI")}
          </span>
          {aiNav.map(renderLink)}
        </nav>

        <nav
          className="side-nav side-nav--utility"
          aria-label={text("Điều hướng tài khoản", "Account navigation")}
        >
          <span className="side-nav-label">{text("Tài khoản", "Account")}</span>
          {accountNav.map(renderLink)}
        </nav>

        {user?.role === "ADMIN" ? (
          <nav
            className="side-nav side-nav--admin"
            aria-label={text("Điều hướng quản trị", "Admin navigation")}
            style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", marginTop: "1rem" }}
          >
            <span className="side-nav-label">{text("Quản trị", "Admin")}</span>
            {renderLink({
              href: ROUTES.adminDashboard,
              label: text("Tổng quan", "Dashboard"),
              icon: LayoutDashboard,
            })}
            {renderLink({
              href: ROUTES.adminUsers,
              label: text("Người dùng", "Users"),
              icon: UsersRound,
            })}
            {renderLink({
              href: ROUTES.adminDocuments,
              label: text("Tài liệu", "Documents"),
              icon: LibraryBig,
            })}
          </nav>
        ) : null}

      </aside>

      <div className="main-column">
        <header className="app-topbar">
          <button
            type="button"
            className="mobile-menu-button"
            aria-label={text("Mở điều hướng", "Open navigation")}
            aria-expanded={isMobileNavOpen}
            onClick={() => setIsMobileNavOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="app-topbar-user">
            {user?.avatarUrl ? (
              <span
                className="mini-avatar mini-avatar--image"
                style={{ backgroundImage: `url(${user.avatarUrl})` }}
              />
            ) : (
              <span className="mini-avatar">{initial}</span>
            )}
            <div>
              <strong>{user?.fullName}</strong>
              <span>{user?.email}</span>
            </div>
          </div>
          <div className="app-topbar-actions">
            <LanguageSwitcher />
            <button
              type="button"
              className="icon-text-button"
              onClick={() => void handleLogout()}
            >
              <LogOut size={17} />
              <span>{t("common.logout")}</span>
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
