"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Building2,
  ChevronDown,
  FilePlus2,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  X,
} from "lucide-react";
import { appShellStyles } from "@/assets/dummyStyles";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { API_BASE } from "@/lib/invoiceUtils";

const NAV_ITEMS = [
  { to: "/app/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/app/invoices", label: "Invoices", Icon: FileText },
  { to: "/app/create-invoice", label: "Create Invoice", Icon: FilePlus2 },
  { to: "/app/business", label: "Business Profiles", Icon: Building2 },
];

function isLinkActive(pathname, to) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

const SidebarLink = ({
  to,
  Icon,
  label,
  pathname,
  collapsed,
  onSelect,
}) => {
  const isActive = isLinkActive(pathname, to);
  return (
    <Link
      href={to}
      title={collapsed ? label : undefined}
      onClick={onSelect}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        collapsed ? "justify-center px-2" : ""
      } ${
        isActive
          ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200/70 shadow-sm"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
          isActive
            ? "bg-white text-blue-600 shadow-sm"
            : "text-gray-400 group-hover:bg-white group-hover:text-gray-700"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && isActive && (
        <span className="h-2 w-2 rounded-full bg-blue-600" />
      )}
    </Link>
  );
};

const AppShell = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut, user, getToken, isSignedIn } = useAuth();
  const toast = useToast();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState(null);

  const profileMenuRef = useRef(null);

  const loadActiveProfile = useCallback(async () => {
    if (!isSignedIn || typeof getToken !== "function") return;
    try {
      const token = await getToken().catch(() => null);
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/businessProfile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 204) {
        setActiveProfile(null);
        return;
      }
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      setActiveProfile(json?.data || null);
    } catch {
      /* ignore background profile errors */
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    let initialCollapsed = false;
    try {
      initialCollapsed = localStorage.getItem("sidebar_collapsed") === "true";
    } catch {
      initialCollapsed = false;
    }

    const applyResponsive = (nextCollapsed) => {
      const mobile = window.innerWidth < 1024;
      if (mobile) {
        setCollapsed(false);
      } else {
        setMobileOpen(false);
        if (nextCollapsed !== undefined) setCollapsed(nextCollapsed);
      }
    };

    const rafId = requestAnimationFrame(() => applyResponsive(initialCollapsed));
    const onResize = () => applyResponsive();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      loadActiveProfile();
    });
    const onProfileUpdated = () => loadActiveProfile();
    window.addEventListener("business-profile-updated", onProfileUpdated);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("business-profile-updated", onProfileUpdated);
    };
  }, [loadActiveProfile]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;
    function onDocPointer(e) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target)
      ) {
        setProfileMenuOpen(false);
      }
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setProfileMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("touchstart", onDocPointer);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("touchstart", onDocPointer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [profileMenuOpen]);

  const logout = async () => {
    setProfileMenuOpen(false);
    setMobileOpen(false);
    try {
      await signOut();
      toast.info("You have been signed out.", "Signed out");
    } catch (error) {
      console.warn("Signout error:", error);
    }
    router.replace("/login");
  };

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", next ? "true" : "false");
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  };

  const displayName = useMemo(() => {
    if (!user) return "User";
    const name = user.name || "";
    return name.trim() || (user.email || "").split("@")[0] || "User";
  }, [user]);

  const firstName = useMemo(() => {
    const parts = displayName.split(" ").filter(Boolean);
    return parts.length ? parts[0] : displayName;
  }, [displayName]);

  const initials = useMemo(() => {
    const parts = displayName.split(" ").filter(Boolean);
    if (!parts.length) return "U";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }, [displayName]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <div
      className={`${appShellStyles.root} print:min-h-0 print:bg-white`}
    >
      {/* Fixed Desktop Sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 z-30 border-r border-gray-200/80 bg-white/95 backdrop-blur-xl transition-all duration-300 print:hidden ${
          collapsed ? "lg:w-20" : "lg:w-72"
        }`}
      >
        <div className="flex h-full flex-col justify-between px-4 py-6">
          <div>
            <div
              className={`mb-8 flex items-center ${
                collapsed ? "justify-center" : "justify-between gap-2"
              }`}
            >
              <Link
                href="/app/dashboard"
                className="inline-flex items-center gap-3 min-w-0"
              >
                <img
                  src="/logo.png"
                  alt="PromptToInvoice"
                  className="h-10 w-10 shrink-0 object-contain"
                />
                {!collapsed && (
                  <span className="truncate text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    PromptToInvoice
                  </span>
                )}
              </Link>

              {!collapsed && (
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label="Collapse sidebar"
                  className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              )}
            </div>

            <nav className="space-y-1.5" aria-label="Sidebar navigation">
              {NAV_ITEMS.map(({ to, label, Icon }) => (
                <SidebarLink
                  key={to}
                  to={to}
                  Icon={Icon}
                  label={label}
                  pathname={pathname}
                  collapsed={collapsed}
                  onSelect={closeMobile}
                />
              ))}
            </nav>
          </div>

          <div className="space-y-2 border-t border-gray-200/70 pt-4">
            {collapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="flex w-full items-center justify-center rounded-xl border border-gray-200 p-2.5 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
            )}

            <button
              type="button"
              onClick={logout}
              title={collapsed ? "Logout" : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors ${
                collapsed ? "justify-center px-2" : ""
              }`}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={closeMobile}
          />
          <div className="fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col justify-between bg-white p-5 shadow-2xl">
            <div>
              <div className="mb-8 flex items-center justify-between border-b border-gray-100 pb-4">
                <Link
                  href="/app/dashboard"
                  className="inline-flex items-center gap-2.5"
                  onClick={closeMobile}
                >
                  <img
                    src="/logo.png"
                    alt="PromptToInvoice"
                    className="h-9 w-9 object-contain"
                  />
                  <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    PromptToInvoice
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={closeMobile}
                  aria-label="Close navigation menu"
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="space-y-1.5" aria-label="Mobile navigation">
                {NAV_ITEMS.map(({ to, label, Icon }) => (
                  <SidebarLink
                    key={to}
                    to={to}
                    Icon={Icon}
                    label={label}
                    pathname={pathname}
                    collapsed={false}
                    onSelect={closeMobile}
                  />
                ))}
              </nav>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {displayName}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Wrapper with Fixed Sidebar Offset */}
      <div
        className={`min-h-screen transition-all duration-300 print:pl-0 print:min-h-0 ${
          collapsed ? "lg:pl-20" : "lg:pl-72"
        }`}
      >
        <header
          className={`sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/70 px-4 py-3.5 sm:px-6 lg:px-8 transition-all print:hidden ${
            scrolled
              ? "bg-white/95 backdrop-blur-xl shadow-sm"
              : "bg-white/80 backdrop-blur-md"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-xl border border-gray-200 bg-white p-2 text-gray-700 hover:bg-gray-50 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden lg:inline-flex rounded-xl border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>

            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-bold text-gray-900 truncate">
                Welcome back,{" "}
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  {firstName}
                </span>
              </h2>
              <p className="text-xs text-gray-500 hidden sm:block">
                {activeProfile?.businessName
                  ? `Active profile: ${activeProfile.businessName}`
                  : "Manage your invoices and business profiles"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* User Profile Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((o) => !o)}
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2.5 rounded-2xl border border-gray-200/80 bg-white px-2.5 py-1.5 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="hidden md:block text-right">
                  <div className="text-sm font-semibold text-gray-900 leading-tight max-w-[140px] truncate">
                    {displayName}
                  </div>
                  <div className="text-xs text-gray-500 leading-tight max-w-[140px] truncate">
                    {user?.email}
                  </div>
                </div>
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-sm">
                  {initials}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                    profileMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {profileMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-80 max-w-[90vw] origin-top-right rounded-2xl border border-gray-200 bg-white p-4 shadow-xl z-50"
                >
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-base font-bold text-white">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {displayName}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-gray-500 truncate mt-0.5">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{user?.email || "—"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="my-3 rounded-xl border border-gray-100 bg-slate-50/80 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        Active Business Profile
                      </span>
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    {activeProfile ? (
                      <>
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {activeProfile.businessName}
                        </p>
                        {(activeProfile.email || activeProfile.taxId) && (
                          <p className="text-xs text-gray-500 truncate">
                            {[
                              activeProfile.email,
                              activeProfile.taxId &&
                                `Tax ID: ${activeProfile.taxId}`,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-gray-500">
                        No business profile configured yet.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Link
                      href="/app/business"
                      role="menuitem"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                      <Building2 className="h-4 w-4 text-blue-600" />
                      Manage Business Profiles
                    </Link>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={logout}
                      className="flex w-full items-center gap-2.5 rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className={`${appShellStyles.main} print:p-0`}>
          <div className={`${appShellStyles.mainContainer} print:max-w-none print:m-0`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;
