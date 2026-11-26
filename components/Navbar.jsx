
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SignedOut, useAuth } from "@/context/AuthContext";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (
      isSignedIn &&
      ["/", "/login", "/signup"].includes(pathname) ||
      (isSignedIn && pathname.startsWith("/auth"))
    ) {
      router.replace("/app/dashboard");
    }
  }, [isSignedIn, pathname, router]);

  const openSignIn = () => router.push("/login");
  const openSignUp = () => router.push("/signup");

  const closeMenu = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <nav className="flex h-[76px] items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-10">
            <Link
              href="/"
              onClick={closeMenu}
              className="group flex items-center gap-2.5"
            >
              <img
                src="/logo.png"
                alt="PromptToInvoice"
                className="h-10 w-10 rounded-xl object-contain"
              />
              <span className="text-xl font-extrabold tracking-tight text-gray-900">
                PromptTo<span className="text-indigo-600">Invoice</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden items-center gap-8 md:flex">
              <a
                href="/#features"
                className="text-sm font-medium text-gray-600 transition hover:text-indigo-600"
              >
                Features
              </a>

              <a
                href="/#pricing"
                className="text-sm font-medium text-gray-600 transition hover:text-indigo-600"
              >
                Pricing
              </a>
            </div>
          </div>

          {/* Desktop Auth */}
          <div className="hidden items-center gap-3 md:flex">
            <SignedOut>
              <button
                onClick={openSignIn}
                type="button"
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 hover:text-indigo-600"
              >
                Sign in
              </button>

              <button
                onClick={openSignUp}
                type="button"
                className="group flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-indigo-600/30"
              >
                Get Started
                <svg
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12h14m-7-7 7 7-7 7" />
                </svg>
              </button>
            </SignedOut>

            {isSignedIn && (
              <Link
                href="/app/dashboard"
                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700"
              >
                Dashboard
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition hover:bg-gray-100 md:hidden"
          >
            {open ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </nav>
      </div>

      {/* Mobile Navigation */}
      <div
        className={`overflow-hidden border-t border-gray-100 bg-white transition-all duration-300 md:hidden ${
          open ? "max-h-96 opacity-100" : "max-h-0 border-transparent opacity-0"
        }`}
      >
        <div className="mx-auto max-w-7xl space-y-2 px-5 py-5 sm:px-8">

          <a
            href="/#features"
            onClick={closeMenu}
            className="block rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-600"
          >
            Features
          </a>

          <a
            href="/#pricing"
            onClick={closeMenu}
            className="block rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-600"
          >
            Pricing
          </a>

          <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
            <SignedOut>
              <button
                type="button"
                onClick={openSignIn}
                className="w-full rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Sign in
              </button>

              <button
                type="button"
                onClick={openSignUp}
                className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700"
              >
                Get Started
              </button>
            </SignedOut>

            {isSignedIn && (
              <Link
                href="/app/dashboard"
                onClick={closeMenu}
                className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Dashboard
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
