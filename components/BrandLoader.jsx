"use client";

import React from "react";

export function BrandLoadingScreen({
  title = "PromptToInvoice",
  subtitle = "Preparing your workspace...",
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/40 px-4">
      <div className="relative flex flex-col items-center rounded-3xl border border-gray-200/80 bg-white/90 px-10 py-9 shadow-xl backdrop-blur-xl">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-2xl border-2 border-blue-200" />
          <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-blue-600 border-r-indigo-600 animate-spin" />
          <img
            src="/logo.png"
            alt="PromptToInvoice"
            className="h-10 w-10 object-contain"
          />
        </div>
        <h2 className="mt-4 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          {title}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        <div className="mt-5 h-1.5 w-44 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function PulseBlock({ className = "" }) {
  return (
    <div className={`animate-pulse rounded-lg bg-gray-200/80 ${className}`} />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <PulseBlock className="h-10 w-10 rounded-xl" />
              <PulseBlock className="h-6 w-16 rounded-full" />
            </div>
            <PulseBlock className="h-4 w-28" />
            <PulseBlock className="h-8 w-36" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-1 space-y-6">
          <div className="rounded-2xl border border-gray-200/70 bg-white p-6 space-y-3">
            <PulseBlock className="h-5 w-28" />
            <PulseBlock className="h-4 w-full" />
            <PulseBlock className="h-4 w-full" />
            <PulseBlock className="h-4 w-4/5" />
          </div>
          <div className="rounded-2xl border border-gray-200/70 bg-white p-6 space-y-3">
            <PulseBlock className="h-5 w-32" />
            <PulseBlock className="h-11 w-full rounded-xl" />
            <PulseBlock className="h-11 w-full rounded-xl" />
          </div>
        </div>
        <div className="xl:col-span-3 rounded-2xl border border-gray-200/70 bg-white p-6 space-y-4">
          <PulseBlock className="h-6 w-40" />
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4 py-2">
              <div className="flex items-center gap-3 flex-1">
                <PulseBlock className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <PulseBlock className="h-4 w-36" />
                  <PulseBlock className="h-3 w-24" />
                </div>
              </div>
              <PulseBlock className="h-4 w-20" />
              <PulseBlock className="h-6 w-16 rounded-full" />
              <PulseBlock className="h-8 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function InvoicesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-200/70 bg-white p-5 space-y-2"
          >
            <PulseBlock className="h-7 w-14" />
            <PulseBlock className="h-4 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 space-y-4">
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3 last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <PulseBlock className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <PulseBlock className="h-4 w-40" />
                <PulseBlock className="h-3 w-28" />
              </div>
            </div>
            <PulseBlock className="h-4 w-20" />
            <PulseBlock className="h-6 w-16 rounded-full" />
            <div className="flex gap-2">
              <PulseBlock className="h-8 w-16 rounded-lg" />
              <PulseBlock className="h-8 w-16 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BusinessProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <PulseBlock className="h-6 w-48" />
          <PulseBlock className="h-9 w-36 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <PulseBlock key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 space-y-4">
        <PulseBlock className="h-6 w-44" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PulseBlock className="h-10 w-full rounded-xl" />
          <PulseBlock className="h-10 w-full rounded-xl" />
          <PulseBlock className="h-20 w-full rounded-xl md:col-span-2" />
          <PulseBlock className="h-10 w-full rounded-xl" />
          <PulseBlock className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function InvoicePreviewSkeleton() {
  return (
    <div className="max-w-4xl mx-auto rounded-2xl border border-gray-200 bg-white p-8 shadow-sm space-y-6">
      <div className="flex justify-between items-start gap-6">
        <div className="space-y-3 flex-1">
          <PulseBlock className="h-12 w-32 rounded-xl" />
          <PulseBlock className="h-6 w-48" />
          <PulseBlock className="h-4 w-64" />
        </div>
        <div className="space-y-2 w-40">
          <PulseBlock className="h-8 w-full" />
          <PulseBlock className="h-4 w-3/4 ml-auto" />
          <PulseBlock className="h-4 w-2/3 ml-auto" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <PulseBlock className="h-24 w-full rounded-xl" />
        <PulseBlock className="h-24 w-full rounded-xl" />
      </div>
      <div className="space-y-3">
        <PulseBlock className="h-10 w-full" />
        <PulseBlock className="h-10 w-full" />
        <PulseBlock className="h-10 w-full" />
      </div>
    </div>
  );
}
