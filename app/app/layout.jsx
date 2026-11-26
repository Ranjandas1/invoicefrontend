"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";
import { BrandLoadingScreen } from "@/components/BrandLoader";

export default function AppLayout({ children }) {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [isLoaded, isSignedIn, pathname, router]);

  if (!isLoaded) {
    return <BrandLoadingScreen subtitle="Verifying your session..." />;
  }

  if (!isSignedIn) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
