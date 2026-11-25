"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { invoicePreviewStyles } from "@/assets/dummyStyles";
import { getNavState, setNavState } from "@/lib/navState";
import {
  API_BASE,
  resolveImageUrl,
  normalizeClient,
  currencyFmt,
  formatDate,
  computeTotals,
  readJSON,
  writeJSON,
} from "@/lib/invoiceUtils";
import { getInvoiceTheme } from "@/lib/invoiceThemes";

const PROFILE_ENDPOINT = `${API_BASE}/api/businessProfile/me`;
const INVOICE_ENDPOINT = (id) => `${API_BASE}/api/invoices/${id}`;

function getStoredInvoices() {
  return readJSON("invoices_v1", []) || [];
}

const defaultProfile = {
  businessName: "",
  email: "",
  address: "",
  phone: "",
  gst: "",
  stampDataUrl: null,
  signatureDataUrl: null,
  logoDataUrl: null,
  defaultTaxPercent: 0,
  signatureName: "",
  signatureTitle: "",
};

const PrintIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 14h12v8H6z" />
  </svg>
);

const EditIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const ArrowLeftIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

function formatStatusLabel(status) {
  return status
    ? status.charAt(0).toUpperCase() + status.slice(1)
    : "Draft";
}

function getStatusColorClass(status, dark = false) {
  if (dark) {
    if (status === "paid") return "text-emerald-300";
    if (status === "unpaid") return "text-amber-300";
    if (status === "overdue") return "text-rose-300";
    return "text-slate-200";
  }
  if (status === "paid") return invoicePreviewStyles.statusPaid;
  if (status === "unpaid") return invoicePreviewStyles.statusUnpaid;
  if (status === "overdue") return invoicePreviewStyles.statusOverdue;
  return invoicePreviewStyles.statusDraft;
}

function ItemsTable({
  items,
  invoiceCurrency,
  headCellClass = "",
  rowClass = "",
  showIndex = false,
  minimalRules = false,
}) {
  const thBase = minimalRules
    ? "border-b-2 border-t border-amber-300 bg-transparent text-amber-900 py-2.5 px-2 text-left text-xs uppercase tracking-wider font-semibold"
    : `print-preview-table-th ${headCellClass}`;
  const tdBorder = minimalRules ? "border-b border-amber-200/80 py-2.5 px-2" : "";

  return (
    <div className="overflow-x-auto">
      <table
        className={
          minimalRules ? "w-full border-collapse my-2 text-sm" : invoicePreviewStyles.table
        }
      >
        <thead>
          <tr>
            {showIndex && (
              <th className={thBase} style={{ width: "8%", minWidth: "40px" }}>
                #
              </th>
            )}
            <th
              className={thBase}
              style={{ width: showIndex ? "44%" : "50%", minWidth: "150px" }}
            >
              Description
            </th>
            <th
              className={thBase}
              style={{ width: "14%", textAlign: "right", minWidth: "65px" }}
            >
              Qty
            </th>
            <th
              className={thBase}
              style={{ width: "19%", textAlign: "right", minWidth: "85px" }}
            >
              Unit Price
            </th>
            <th
              className={thBase}
              style={{ width: "15%", textAlign: "right", minWidth: "80px" }}
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length ? (
            items.map((it, idx) => (
              <tr key={it.id || idx} className={rowClass}>
                {showIndex && (
                  <td className={`${tdBorder} font-mono text-xs text-gray-500`}>
                    {String(idx + 1).padStart(2, "0")}
                  </td>
                )}
                <td className={`${tdBorder} ${invoicePreviewStyles.tableCell}`}>
                  {it.description || "Item Description"}
                </td>
                <td className={tdBorder} style={{ textAlign: "right" }}>
                  {it.qty || 0}
                </td>
                <td className={tdBorder} style={{ textAlign: "right" }}>
                  {currencyFmt(it.unitPrice, invoiceCurrency)}
                </td>
                <td
                  className={tdBorder}
                  style={{ textAlign: "right", fontWeight: "600" }}
                >
                  {currencyFmt(
                    Number(it.qty || 0) * Number(it.unitPrice || 0),
                    invoiceCurrency
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={showIndex ? 5 : 4}
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "#6b7280",
                }}
              >
                No items added to this invoice
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SignatureBlock({
  signature,
  signatureName,
  signatureTitle,
  compact = false,
}) {
  return (
    <div>
      <div className={invoicePreviewStyles.signatureLabel}>
        Authorized Signature
      </div>
      {signature ? (
        <div className={invoicePreviewStyles.signatureContainer}>
          <img
            src={signature}
            alt="Authorized Signature"
            className={invoicePreviewStyles.signatureImage}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          {(signatureName || signatureTitle) && (
            <div className="mt-2 text-sm text-gray-700">
              <div className={invoicePreviewStyles.signatureName}>
                {signatureName}
              </div>
              {signatureTitle && (
                <div className={invoicePreviewStyles.signatureTitle}>
                  {signatureTitle}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          className={`${invoicePreviewStyles.placeholderContainer} ${
            compact ? "h-12 text-xs" : ""
          }`}
        >
          No Signature
        </div>
      )}
    </div>
  );
}

function StampBlock({ stamp, compact = false }) {
  return (
    <div className="text-center">
      <div className={invoicePreviewStyles.stampLabel}>Company Stamp</div>
      {stamp ? (
        <img
          src={stamp}
          alt="Company Stamp"
          className={invoicePreviewStyles.stampImage}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div
          className={`${invoicePreviewStyles.placeholderContainer} ${
            compact ? "h-12 text-xs" : ""
          }`}
        >
          No Stamp
        </div>
      )}
    </div>
  );
}

function TotalsBox({
  subtotal,
  taxPercent,
  tax,
  total,
  invoiceCurrency,
  boxClass = invoicePreviewStyles.totalsContainer,
  dividerClass = invoicePreviewStyles.totalDivider,
  labelClass = "text-gray-700",
  valueClass = "text-gray-900",
  totalLabelClass = invoicePreviewStyles.totalAmountLabel,
  totalValueClass = invoicePreviewStyles.totalAmountValue,
}) {
  return (
    <div className={boxClass}>
      <div className="space-y-2">
        <div className={invoicePreviewStyles.totalsRow}>
          <span className={`text-sm font-medium ${labelClass}`}>Subtotal</span>
          <span className={`text-sm font-medium ${valueClass}`}>
            {currencyFmt(subtotal, invoiceCurrency)}
          </span>
        </div>
        <div className={invoicePreviewStyles.totalsRow}>
          <span className={`text-sm font-medium ${labelClass}`}>
            Tax ({taxPercent}%)
          </span>
          <span className={`text-sm font-medium ${valueClass}`}>
            {currencyFmt(tax, invoiceCurrency)}
          </span>
        </div>
        <div className={dividerClass}>
          <div className={invoicePreviewStyles.totalsRow}>
            <span className={totalLabelClass}>Total Amount</span>
            <span className={totalValueClass}>
              {currencyFmt(total, invoiceCurrency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvoicePreview() {
  const { id } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();

  const [initialState] = useState(() => (id ? getNavState(id) : null));
  const [invoice, setInvoice] = useState(() => initialState);
  const [loadingInvoice, setLoadingInvoice] = useState(
    !initialState && Boolean(id)
  );
  const [invoiceError, setInvoiceError] = useState(null);

  const [profile, setProfile] = useState(
    () => readJSON("business_profile", defaultProfile) || defaultProfile
  );
  const [profileLoading, setProfileLoading] = useState(false);

  const prevTitleRef = useRef(
    typeof document !== "undefined" ? document.title : ""
  );
  const printTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (printTimerRef.current) clearTimeout(printTimerRef.current);
    };
  }, []);

  const obtainToken = useCallback(async () => {
    if (typeof getToken !== "function") return null;
    try {
      let token = await getToken({ template: "default" }).catch(() => null);
      if (!token) {
        token = await getToken({ forceRefresh: true }).catch(() => null);
      }
      return token;
    } catch {
      return null;
    }
  }, [getToken]);

  useEffect(() => {
    let mounted = true;
    async function fetchInvoice() {
      if (!id || initialState) return;
      setLoadingInvoice(true);
      setInvoiceError(null);
      try {
        const token = await obtainToken();
        const headers = { Accept: "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(INVOICE_ENDPOINT(id), {
          method: "GET",
          headers,
        });
        if (res.ok) {
          const json = await res.json().catch(() => null);
          const data = json?.data ?? json ?? null;
          if (mounted && data) {
            const normalized = {
              ...data,
              id: data._id ?? data.id ?? id,
              items: Array.isArray(data.items) ? data.items : [],
              invoiceNumber: data.invoiceNumber ?? "",
              currency: data.currency || "USD",
            };
            setInvoice(normalized);
            return;
          }
        } else {
          console.warn("Failed to fetch invoice from server:", res.status);
        }
      } catch (err) {
        console.warn("Error fetching invoice:", err);
      } finally {
        if (mounted) setLoadingInvoice(false);
      }

      if (!mounted) return;
      const all = getStoredInvoices();
      const found = all.find(
        (x) => x && (x.id === id || x._id === id || x.invoiceNumber === id)
      );
      if (found) setInvoice(found);
      else setInvoiceError("Invoice not found");
    }
    fetchInvoice();
    return () => {
      mounted = false;
    };
  }, [id, initialState, obtainToken]);

  useEffect(() => {
    let mounted = true;
    async function fetchProfile() {
      const token = await obtainToken();
      if (!token) return;
      if (mounted) setProfileLoading(true);
      try {
        const headers = {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        };

        const res = await fetch(PROFILE_ENDPOINT, { method: "GET", headers });
        if (!res.ok || res.status === 204) {
          return;
        }
        const json = await res.json().catch(() => null);
        const data = json?.data ?? null;
        if (mounted && data && typeof data === "object") {
          const normalized = {
            businessName:
              data.businessName ?? data.name ?? defaultProfile.businessName,
            email: data.email ?? defaultProfile.email,
            address: data.address ?? defaultProfile.address,
            phone: data.phone ?? defaultProfile.phone,
            taxId: data.taxId ?? data.gst ?? "",
            gst: data.gst ?? data.taxId ?? defaultProfile.gst,
            stampDataUrl:
              resolveImageUrl(data.stampUrl ?? data.stampDataUrl) ??
              defaultProfile.stampDataUrl,
            signatureDataUrl:
              resolveImageUrl(data.signatureUrl ?? data.signatureDataUrl) ??
              defaultProfile.signatureDataUrl,
            logoDataUrl:
              resolveImageUrl(data.logoUrl ?? data.logoDataUrl) ??
              defaultProfile.logoDataUrl,
            defaultTaxPercent: Number.isFinite(Number(data.defaultTaxPercent))
              ? Number(data.defaultTaxPercent)
              : defaultProfile.defaultTaxPercent,
            signatureName:
              data.signatureOwnerName ??
              data.signatureName ??
              defaultProfile.signatureName,
            signatureTitle:
              data.signatureOwnerTitle ??
              data.signatureTitle ??
              defaultProfile.signatureTitle,
          };
          setProfile(normalized);
          writeJSON("business_profile", normalized);
        }
      } catch (err) {
        console.warn("Error fetching profile:", err);
      } finally {
        if (mounted) setProfileLoading(false);
      }
    }

    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [obtainToken]);

  useEffect(() => {
    if (!invoice) return;
    const invoiceNumber =
      invoice.invoiceNumber || invoice.id || `invoice-${Date.now()}`;
    const safe = `Invoice-${String(invoiceNumber).replace(
      /[^\w\-_.() ]/g,
      "_"
    )}`;
    const prev = prevTitleRef.current ?? document.title;
    if (document.title !== safe) document.title = safe;
    return () => {
      try {
        document.title = prev;
      } catch {
        /* ignore */
      }
    };
  }, [invoice]);

  const handlePrint = useCallback(() => {
    const invoiceNumber =
      (invoice && (invoice.invoiceNumber || invoice.id)) ||
      `invoice-${Date.now()}`;
    const safe = `Invoice-${String(invoiceNumber).replace(
      /[^\w\-_.() ]/g,
      "_"
    )}`;

    const prevTitle = document.title;
    document.title = safe;
    window.print();

    if (printTimerRef.current) clearTimeout(printTimerRef.current);
    printTimerRef.current = setTimeout(() => {
      document.title = prevTitle;
    }, 500);
  }, [invoice]);

  if (!invoice && (loadingInvoice || profileLoading)) {
    return <div className="p-6">Loading…</div>;
  }

  if (!invoice) {
    return (
      <div className={invoicePreviewStyles.pageContainer}>
        <div className={invoicePreviewStyles.emptyStateContainer}>
          <div className={invoicePreviewStyles.emptyStateCard}>
            <div className={invoicePreviewStyles.emptyStateIconContainer}>
              <svg
                className={invoicePreviewStyles.emptyStateIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h3 className={invoicePreviewStyles.emptyStateTitle}>
              {invoiceError || "Invoice Not Found"}
            </h3>
            <p className={invoicePreviewStyles.emptyStateMessage}>
              The invoice you&apos;re looking for doesn&apos;t exist or may have
              been deleted.
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => router.back()}
                className={invoicePreviewStyles.emptyStateButton}
              >
                <ArrowLeftIcon className="w-4 h-4" /> Back to Invoices
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const items = (
    invoice.items && Array.isArray(invoice.items) ? invoice.items : []
  ).filter(Boolean);
  const taxPercent = Number(
    invoice.taxPercent ?? profile.defaultTaxPercent ?? 0
  );
  const { subtotal, tax, total } = computeTotals(items, taxPercent);

  const logo = resolveImageUrl(
    invoice.logoDataUrl ?? profile.logoDataUrl ?? null
  );
  const stamp = resolveImageUrl(
    invoice.stampDataUrl ?? profile.stampDataUrl ?? null
  );
  const signature = resolveImageUrl(
    invoice.signatureDataUrl ?? profile.signatureDataUrl ?? null
  );

  const signatureName = invoice.signatureName ?? profile.signatureName ?? "";
  const signatureTitle = invoice.signatureTitle ?? profile.signatureTitle ?? "";

  const client = normalizeClient(invoice.client);
  const invoiceCurrency = invoice.currency || "USD";
  const theme = getInvoiceTheme(invoice.templateStyle);
  const invoiceNum = invoice.invoiceNumber || invoice.id;

  const fromName = invoice.fromBusinessName || profile.businessName || "—";
  const fromAddress = invoice.fromAddress || profile.address || "—";
  const fromEmail = invoice.fromEmail || profile.email;
  const fromPhone = invoice.fromPhone || profile.phone;
  const fromTaxId =
    invoice.fromTaxId || invoice.fromGst || profile.taxId || profile.gst;
  const footerText =
    invoice.terms ||
    invoice.footnote ||
    "Thank you for your business. We appreciate your trust in our services.";

  function goToEdit() {
    setNavState(invoice.id, invoice);
    router.push(`/app/invoices/${invoice.id}/edit`);
  }

  function renderInvoiceBody() {
    switch (theme.layout) {
      /* 1. Executive Indigo: Gradient Banner + 4-Metric Strip + Split Notes & Totals */
      case "banner-strip":
        return (
          <>
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl p-6 mb-5 flex flex-col sm:flex-row print:flex-row justify-between items-start gap-4">
              <div className="flex items-start gap-4">
                {logo && (
                  <img
                    src={logo}
                    alt="Company Logo"
                    className="max-h-14 max-w-[120px] object-contain bg-white rounded-lg p-1.5"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <div>
                  <div className="text-xs uppercase tracking-wider text-indigo-100 font-semibold">
                    From
                  </div>
                  <div className="text-xl font-bold text-white">{fromName}</div>
                  <div className="text-xs text-indigo-100 mt-1">{fromAddress}</div>
                  <div className="text-xs text-indigo-100 mt-1 flex flex-wrap gap-3">
                    {fromEmail && <span>{fromEmail}</span>}
                    {fromPhone && <span>{fromPhone}</span>}
                    {fromTaxId && <span>Tax ID: {fromTaxId}</span>}
                  </div>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-xs uppercase tracking-widest text-indigo-200 font-semibold">
                  Official Invoice
                </div>
                <div className="text-3xl font-extrabold tracking-tight">
                  INVOICE
                </div>
                <div className="inline-block mt-1 px-3 py-0.5 rounded-full bg-white/15 text-sm font-semibold">
                  #{invoiceNum}
                </div>
              </div>
            </div>

            {/* 4-column summary strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-3 mb-5">
              <div className="rounded-lg bg-indigo-50/70 border border-indigo-100 p-3">
                <div className="text-[11px] uppercase font-semibold text-indigo-600">
                  Issue Date
                </div>
                <div className="text-sm font-bold text-gray-900 mt-0.5">
                  {invoice.issueDate ? formatDate(invoice.issueDate) : "—"}
                </div>
              </div>
              <div className="rounded-lg bg-indigo-50/70 border border-indigo-100 p-3">
                <div className="text-[11px] uppercase font-semibold text-indigo-600">
                  Due Date
                </div>
                <div className="text-sm font-bold text-gray-900 mt-0.5">
                  {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                </div>
              </div>
              <div className="rounded-lg bg-indigo-50/70 border border-indigo-100 p-3">
                <div className="text-[11px] uppercase font-semibold text-indigo-600">
                  Status
                </div>
                <div
                  className={`text-sm font-bold mt-0.5 ${getStatusColorClass(
                    invoice.status
                  )}`}
                >
                  {formatStatusLabel(invoice.status)}
                </div>
              </div>
              <div className="rounded-lg bg-indigo-600 text-white p-3">
                <div className="text-[11px] uppercase font-semibold text-indigo-100">
                  Amount Due
                </div>
                <div className="text-sm font-extrabold mt-0.5">
                  {currencyFmt(total, invoiceCurrency)}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-white p-4 mb-5 flex flex-col sm:flex-row justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
                  Bill To
                </div>
                <div className="font-bold text-gray-900">
                  {client.name || "Client Name"}
                </div>
                {client.address && (
                  <div className="text-sm text-gray-600">{client.address}</div>
                )}
                <div className="text-sm text-gray-600 flex flex-wrap gap-3 mt-0.5">
                  {client.email && <span>{client.email}</span>}
                  {client.phone && <span>{client.phone}</span>}
                </div>
              </div>
              <div className="sm:text-right">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
                  Currency
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {invoiceCurrency}
                </div>
              </div>
            </div>

            <div className="print-preview-section">
              <ItemsTable
                items={items}
                invoiceCurrency={invoiceCurrency}
                headCellClass="!bg-indigo-600 !text-white !border-indigo-600"
                rowClass="even:bg-indigo-50/30"
              />
            </div>

            <div className="print-preview-section grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 gap-5 items-start">
              <div className="md:col-span-7 print:col-span-7">
                {invoice.notes && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-1.5">
                      Notes & Terms
                    </div>
                    <div className="text-sm text-indigo-950 bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100">
                      {invoice.notes}
                    </div>
                  </div>
                )}
              </div>
              <div className="md:col-span-5 print:col-span-5">
                <TotalsBox
                  subtotal={subtotal}
                  taxPercent={taxPercent}
                  tax={tax}
                  total={total}
                  invoiceCurrency={invoiceCurrency}
                  boxClass="bg-indigo-50 border border-indigo-200 rounded-xl p-4"
                  dividerClass="border-t border-indigo-200 my-2 pt-2"
                  totalLabelClass="text-base font-bold text-indigo-950"
                  totalValueClass="text-lg font-extrabold text-indigo-700"
                />
              </div>
            </div>

            <div className="print-preview-section border-t border-indigo-100 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
              <SignatureBlock
                signature={signature}
                signatureName={signatureName}
                signatureTitle={signatureTitle}
                compact
              />
              <StampBlock stamp={stamp} compact />
              <div className="text-xs text-gray-500 sm:text-right max-w-xs">
                <div>{footerText}</div>
                <div className="text-gray-400 mt-1">
                  Generated by PromptToInvoice • {formatDate(new Date())}
                </div>
              </div>
            </div>
          </>
        );

      /* 2. Emerald Modern: 2-Column Left Sidebar + Right Main Invoice */
      case "sidebar-split":
        return (
          <div className="grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 gap-6">
            {/* Left Sidebar Panel */}
            <div className="md:col-span-4 print:col-span-4 bg-emerald-900 text-white rounded-xl p-5 flex flex-col justify-between gap-5">
              <div className="space-y-4">
                {logo && (
                  <img
                    src={logo}
                    alt="Company Logo"
                    className="max-h-14 max-w-[140px] object-contain bg-white rounded-lg p-1.5"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-emerald-300 font-semibold">
                    Issued By
                  </div>
                  <div className="text-lg font-bold mt-0.5">{fromName}</div>
                  <div className="text-xs text-emerald-100 mt-1">
                    {fromAddress}
                  </div>
                  {fromEmail && (
                    <div className="text-xs text-emerald-100 mt-1">
                      {fromEmail}
                    </div>
                  )}
                  {fromPhone && (
                    <div className="text-xs text-emerald-100">{fromPhone}</div>
                  )}
                  {fromTaxId && (
                    <div className="text-xs text-emerald-200 mt-1">
                      Tax ID: {fromTaxId}
                    </div>
                  )}
                </div>

                <div className="border-t border-emerald-700 pt-4">
                  <div className="text-[11px] uppercase tracking-widest text-emerald-300 font-semibold">
                    Billed To
                  </div>
                  <div className="text-base font-semibold mt-0.5">
                    {client.name || "Client Name"}
                  </div>
                  {client.address && (
                    <div className="text-xs text-emerald-100 mt-1">
                      {client.address}
                    </div>
                  )}
                  {client.email && (
                    <div className="text-xs text-emerald-100 mt-1">
                      {client.email}
                    </div>
                  )}
                  {client.phone && (
                    <div className="text-xs text-emerald-100">
                      {client.phone}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-emerald-700 pt-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-emerald-300">Issued</span>
                  <span className="font-semibold">
                    {invoice.issueDate ? formatDate(invoice.issueDate) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-300">Due Date</span>
                  <span className="font-semibold">
                    {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-300">Currency</span>
                  <span className="font-semibold">{invoiceCurrency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-300">Status</span>
                  <span
                    className={`font-bold ${getStatusColorClass(
                      invoice.status,
                      true
                    )}`}
                  >
                    {formatStatusLabel(invoice.status)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Main Body */}
            <div className="md:col-span-8 print:col-span-8 flex flex-col justify-between gap-4">
              <div>
                <div className="flex justify-between items-baseline border-b-2 border-emerald-600 pb-3 mb-4">
                  <h2 className="text-3xl font-extrabold text-emerald-950 tracking-tight">
                    INVOICE
                  </h2>
                  <span className="text-sm font-mono font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    #{invoiceNum}
                  </span>
                </div>

                <ItemsTable
                  items={items}
                  invoiceCurrency={invoiceCurrency}
                  headCellClass="!bg-emerald-50 !text-emerald-950 !border-emerald-200"
                  rowClass="even:bg-emerald-50/40"
                />
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div>
                    {invoice.notes && (
                      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950">
                        <div className="font-bold uppercase tracking-wider text-emerald-700 mb-1">
                          Notes
                        </div>
                        {invoice.notes}
                      </div>
                    )}
                  </div>
                  <TotalsBox
                    subtotal={subtotal}
                    taxPercent={taxPercent}
                    tax={tax}
                    total={total}
                    invoiceCurrency={invoiceCurrency}
                    boxClass="bg-emerald-50 border border-emerald-200 rounded-xl p-4"
                    dividerClass="border-t border-emerald-300 my-2 pt-2"
                    totalLabelClass="text-base font-bold text-emerald-950"
                    totalValueClass="text-lg font-extrabold text-emerald-700"
                  />
                </div>

                <div className="border-t border-emerald-200 pt-4 flex flex-wrap justify-between items-end gap-4">
                  <SignatureBlock
                    signature={signature}
                    signatureName={signatureName}
                    signatureTitle={signatureTitle}
                    compact
                  />
                  <StampBlock stamp={stamp} compact />
                  <div className="text-[11px] text-gray-500 max-w-[200px] sm:text-right">
                    {footerText}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      /* 3. Royal Navy: Centered Crest + Navy Ribbon + Boxed Cards */
      case "centered-crest":
        return (
          <>
            <div className="text-center pb-4 mb-4">
              {logo && (
                <img
                  src={logo}
                  alt="Company Logo"
                  className="max-h-16 max-w-[160px] object-contain mx-auto mb-2"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
              <div className="text-2xl font-bold text-slate-900">{fromName}</div>
              <div className="text-xs text-slate-600 mt-1">
                {fromAddress}
                {fromEmail ? ` • ${fromEmail}` : ""}
                {fromPhone ? ` • ${fromPhone}` : ""}
                {fromTaxId ? ` • Tax ID: ${fromTaxId}` : ""}
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-xl px-5 py-3.5 mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-amber-400 font-black tracking-widest text-xl">
                  INVOICE
                </span>
                <span className="ml-3 text-sm text-slate-300">#{invoiceNum}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span>
                  <strong className="text-slate-400">Issued:</strong>{" "}
                  {invoice.issueDate ? formatDate(invoice.issueDate) : "—"}
                </span>
                <span>
                  <strong className="text-slate-400">Due:</strong>{" "}
                  {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                </span>
                <span>
                  <strong className="text-slate-400">Status:</strong>{" "}
                  <span className={getStatusColorClass(invoice.status, true)}>
                    {formatStatusLabel(invoice.status)}
                  </span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 mb-5">
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                  Bill To
                </div>
                <div className="font-bold text-slate-900">
                  {client.name || "Client Name"}
                </div>
                {client.address && (
                  <div className="text-sm text-slate-600">{client.address}</div>
                )}
                {client.email && (
                  <div className="text-sm text-slate-600">{client.email}</div>
                )}
                {client.phone && (
                  <div className="text-sm text-slate-600">{client.phone}</div>
                )}
              </div>
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 flex flex-col justify-center">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                  Summary
                </div>
                <div className="flex justify-between text-sm py-1">
                  <span className="text-slate-600">Currency</span>
                  <span className="font-semibold text-slate-900">
                    {invoiceCurrency}
                  </span>
                </div>
                <div className="flex justify-between text-sm py-1">
                  <span className="text-slate-600">Total Payable</span>
                  <span className="font-bold text-slate-900">
                    {currencyFmt(total, invoiceCurrency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="print-preview-section">
              <ItemsTable
                items={items}
                invoiceCurrency={invoiceCurrency}
                headCellClass="!bg-slate-800 !text-white !border-slate-700"
                rowClass="even:bg-slate-50"
              />
            </div>

            <div className="print-preview-section grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 gap-5 items-start">
              <div className="md:col-span-7 print:col-span-7 space-y-4">
                {invoice.notes && (
                  <div className="border border-slate-200 bg-slate-50 rounded-lg p-3.5 text-sm text-slate-700">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Notes
                    </div>
                    {invoice.notes}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <SignatureBlock
                    signature={signature}
                    signatureName={signatureName}
                    signatureTitle={signatureTitle}
                    compact
                  />
                  <StampBlock stamp={stamp} compact />
                </div>
              </div>
              <div className="md:col-span-5 print:col-span-5">
                <TotalsBox
                  subtotal={subtotal}
                  taxPercent={taxPercent}
                  tax={tax}
                  total={total}
                  invoiceCurrency={invoiceCurrency}
                  boxClass="bg-slate-900 text-white rounded-xl p-5"
                  dividerClass="border-t border-slate-700 my-2.5 pt-2.5"
                  labelClass="text-slate-300"
                  valueClass="text-white"
                  totalLabelClass="text-base font-bold text-white"
                  totalValueClass="text-xl font-extrabold text-amber-400"
                />
              </div>
            </div>

            <div className="print-preview-section border-t border-slate-200 pt-3 text-center text-xs text-slate-500">
              {footerText} • PromptToInvoice
            </div>
          </>
        );

      /* 4. Amber Editorial: Serif Letterhead + Borderless Minimal Rules + Inline Meta Bar */
      case "editorial":
        return (
          <div className="border-t-4 border-b-4 border-amber-500 py-5">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-amber-200 pb-4 mb-4">
              <div className="flex items-center gap-4">
                {logo && (
                  <img
                    src={logo}
                    alt="Company Logo"
                    className="max-h-14 max-w-[120px] object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <div>
                  <div className="text-2xl font-serif font-bold text-stone-900">
                    {fromName}
                  </div>
                  <div className="text-xs text-stone-600 mt-0.5">
                    {fromAddress}
                  </div>
                  <div className="text-xs text-stone-500">
                    {[fromEmail, fromPhone, fromTaxId && `Tax ID: ${fromTaxId}`]
                      .filter(Boolean)
                      .join("  |  ")}
                  </div>
                </div>
              </div>
              <div className="sm:text-right">
                <div className="text-3xl font-serif tracking-wide text-amber-700 font-bold">
                  INVOICE
                </div>
                <div className="text-sm font-medium text-stone-600">
                  No. {invoiceNum}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-3 bg-amber-50/70 border border-amber-200 rounded px-4 py-2.5 mb-5 text-xs text-stone-700">
              <span>
                <strong>Client:</strong> {client.name || "Client Name"}
              </span>
              <span>
                <strong>Issued:</strong>{" "}
                {invoice.issueDate ? formatDate(invoice.issueDate) : "—"}
              </span>
              <span>
                <strong>Due:</strong>{" "}
                {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
              </span>
              <span>
                <strong>Currency:</strong> {invoiceCurrency}
              </span>
              <span className={`font-bold ${getStatusColorClass(invoice.status)}`}>
                {formatStatusLabel(invoice.status)}
              </span>
            </div>

            {(client.address || client.email || client.phone) && (
              <div className="text-xs text-stone-600 mb-4">
                <strong className="uppercase tracking-wider text-amber-800 mr-2">
                  Bill To:
                </strong>
                {[client.address, client.email, client.phone]
                  .filter(Boolean)
                  .join(" • ")}
              </div>
            )}

            <div className="print-preview-section">
              <ItemsTable
                items={items}
                invoiceCurrency={invoiceCurrency}
                minimalRules
                rowClass="even:bg-amber-50/30"
              />
            </div>

            <div className="print-preview-section grid grid-cols-1 sm:grid-cols-12 gap-5 items-start mt-4">
              <div className="sm:col-span-7">
                {invoice.notes && (
                  <div className="border-l-2 border-amber-500 pl-3 text-sm text-stone-700 italic">
                    {invoice.notes}
                  </div>
                )}
              </div>
              <div className="sm:col-span-5">
                <TotalsBox
                  subtotal={subtotal}
                  taxPercent={taxPercent}
                  tax={tax}
                  total={total}
                  invoiceCurrency={invoiceCurrency}
                  boxClass="bg-amber-50/80 border border-amber-200 rounded p-4"
                  dividerClass="border-t border-amber-300 my-2 pt-2"
                  totalLabelClass="text-base font-serif font-bold text-stone-900"
                  totalValueClass="text-lg font-serif font-bold text-amber-800"
                />
              </div>
            </div>

            <div className="print-preview-section border-t border-amber-200 pt-4 flex flex-wrap justify-between items-end gap-4">
              <SignatureBlock
                signature={signature}
                signatureName={signatureName}
                signatureTitle={signatureTitle}
                compact
              />
              <StampBlock stamp={stamp} compact />
              <div className="text-xs text-stone-500 sm:text-right max-w-xs">
                {footerText}
              </div>
            </div>
          </div>
        );

      /* 5. Violet Studio: Bento Grid Cards */
      case "bento-cards":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-12 print:grid-cols-12 gap-4">
              <div className="sm:col-span-7 print:col-span-7 rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-200 p-5 flex items-start gap-4">
                {logo && (
                  <img
                    src={logo}
                    alt="Company Logo"
                    className="max-h-14 max-w-[110px] object-contain bg-white rounded-xl p-1.5 border border-violet-100"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600">
                    Studio / Sender
                  </span>
                  <div className="text-xl font-bold text-violet-950">
                    {fromName}
                  </div>
                  <div className="text-xs text-violet-800 mt-1">
                    {fromAddress}
                  </div>
                  <div className="text-xs text-violet-700 mt-1 flex flex-wrap gap-2">
                    {fromEmail && <span>{fromEmail}</span>}
                    {fromPhone && <span>• {fromPhone}</span>}
                    {fromTaxId && <span>• Tax ID: {fromTaxId}</span>}
                  </div>
                </div>
              </div>

              <div className="sm:col-span-5 print:col-span-5 rounded-2xl bg-violet-700 text-white p-5 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-violet-200">
                      Invoice
                    </div>
                    <div className="text-lg font-bold">#{invoiceNum}</div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20">
                    {formatStatusLabel(invoice.status)}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-xs text-violet-200">Total Amount</div>
                  <div className="text-2xl font-extrabold">
                    {currencyFmt(total, invoiceCurrency)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-violet-100 bg-purple-50/30 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-violet-600 mb-1">
                  Bill To
                </div>
                <div className="font-bold text-gray-900">
                  {client.name || "Client Name"}
                </div>
                {client.address && (
                  <div className="text-xs text-gray-600 mt-0.5">
                    {client.address}
                  </div>
                )}
                {(client.email || client.phone) && (
                  <div className="text-xs text-gray-600 mt-0.5">
                    {[client.email, client.phone].filter(Boolean).join(" • ")}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-violet-100 bg-purple-50/30 p-4 grid grid-cols-3 gap-2 items-center">
                <div>
                  <div className="text-[11px] text-violet-600 font-semibold uppercase">
                    Issued
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {invoice.issueDate ? formatDate(invoice.issueDate) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-violet-600 font-semibold uppercase">
                    Due
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-violet-600 font-semibold uppercase">
                    Currency
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {invoiceCurrency}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-violet-100 p-3">
              <ItemsTable
                items={items}
                invoiceCurrency={invoiceCurrency}
                headCellClass="!bg-violet-100 !text-violet-950 !border-violet-200"
                rowClass="even:bg-violet-50/30"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
              <div className="md:col-span-4 rounded-2xl border border-violet-100 p-4 flex flex-col justify-center">
                <SignatureBlock
                  signature={signature}
                  signatureName={signatureName}
                  signatureTitle={signatureTitle}
                  compact
                />
              </div>
              <div className="md:col-span-3 rounded-2xl border border-violet-100 p-4 flex flex-col justify-center">
                <StampBlock stamp={stamp} compact />
              </div>
              <div className="md:col-span-5 print:col-span-5">
                <TotalsBox
                  subtotal={subtotal}
                  taxPercent={taxPercent}
                  tax={tax}
                  total={total}
                  invoiceCurrency={invoiceCurrency}
                  boxClass="h-full rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-200 p-4 flex flex-col justify-center"
                  dividerClass="border-t border-violet-300 my-2 pt-2"
                  totalLabelClass="text-base font-bold text-violet-950"
                  totalValueClass="text-lg font-extrabold text-violet-700"
                />
              </div>
            </div>

            {invoice.notes && (
              <div className="rounded-2xl bg-violet-50/60 border border-violet-200 p-3.5 text-sm text-violet-950">
                <strong className="text-xs uppercase tracking-wider text-violet-700 mr-2">
                  Notes:
                </strong>
                {invoice.notes}
              </div>
            )}

            <div className="text-center text-xs text-gray-500 pt-1">
              {footerText}
            </div>
          </div>
        );

      /* 6. Slate Minimal: Swiss Typographic Grid + Index Numbers + Black Total Bar */
      case "swiss-grid":
        return (
          <div className="border-2 border-gray-900 p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-gray-900 pb-4 mb-4 gap-4">
              <div>
                <div className="text-4xl font-black tracking-[0.18em] text-gray-900">
                  INVOICE
                </div>
                <div className="font-mono text-sm text-gray-600 mt-1">
                  REF // {invoiceNum}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {logo && (
                  <img
                    src={logo}
                    alt="Company Logo"
                    className="max-h-12 max-w-[110px] object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <div className="text-left sm:text-right font-mono text-xs space-y-1">
                  <div>
                    ISSUED: {invoice.issueDate ? formatDate(invoice.issueDate) : "—"}
                  </div>
                  <div>
                    DUE: {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                  </div>
                  <div className="uppercase font-bold">
                    STATUS: {formatStatusLabel(invoice.status)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 border-b-2 border-gray-900 pb-4 mb-4 gap-4 text-xs">
              <div>
                <div className="font-bold uppercase tracking-widest text-gray-500 mb-1">
                  01 / From
                </div>
                <div className="font-bold text-sm text-gray-900">{fromName}</div>
                <div className="text-gray-600 mt-0.5">{fromAddress}</div>
                {fromEmail && <div className="text-gray-600">{fromEmail}</div>}
                {fromPhone && <div className="text-gray-600">{fromPhone}</div>}
              </div>
              <div>
                <div className="font-bold uppercase tracking-widest text-gray-500 mb-1">
                  02 / Bill To
                </div>
                <div className="font-bold text-sm text-gray-900">
                  {client.name || "Client Name"}
                </div>
                {client.address && (
                  <div className="text-gray-600 mt-0.5">{client.address}</div>
                )}
                {client.email && (
                  <div className="text-gray-600">{client.email}</div>
                )}
                {client.phone && (
                  <div className="text-gray-600">{client.phone}</div>
                )}
              </div>
              <div>
                <div className="font-bold uppercase tracking-widest text-gray-500 mb-1">
                  03 / Terms
                </div>
                <div>Currency: {invoiceCurrency}</div>
                {fromTaxId && <div>Tax ID: {fromTaxId}</div>}
                <div>Tax Rate: {taxPercent}%</div>
              </div>
            </div>

            <div className="print-preview-section">
              <ItemsTable
                items={items}
                invoiceCurrency={invoiceCurrency}
                headCellClass="!bg-gray-900 !text-white !border-gray-900"
                rowClass="even:bg-gray-50"
                showIndex
              />
            </div>

            <div className="bg-gray-900 text-white px-5 py-3.5 flex flex-wrap justify-between items-center gap-4 my-4">
              <div className="text-xs font-mono space-x-4 text-gray-300">
                <span>SUBTOTAL: {currencyFmt(subtotal, invoiceCurrency)}</span>
                <span>TAX ({taxPercent}%): {currencyFmt(tax, invoiceCurrency)}</span>
              </div>
              <div className="text-lg font-black tracking-wide">
                TOTAL DUE: {currencyFmt(total, invoiceCurrency)}
              </div>
            </div>

            {invoice.notes && (
              <div className="border border-gray-300 bg-gray-50 p-3 text-xs text-gray-800 mb-4">
                <strong className="uppercase tracking-wider mr-2">Notes:</strong>
                {invoice.notes}
              </div>
            )}

            <div className="border-t border-gray-300 pt-4 flex flex-wrap justify-between items-end gap-4">
              <SignatureBlock
                signature={signature}
                signatureName={signatureName}
                signatureTitle={signatureTitle}
                compact
              />
              <StampBlock stamp={stamp} compact />
              <div className="text-[11px] font-mono text-gray-500 sm:text-right max-w-xs">
                {footerText}
              </div>
            </div>
          </div>
        );

      /* Default Predefined Template */
      default:
        return (
          <>
            <div className={invoicePreviewStyles.printHeader}>
              <div className={invoicePreviewStyles.companyInfo}>
                {logo && (
                  <img
                    src={logo}
                    alt="Company Logo"
                    className={invoicePreviewStyles.logo}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <div>
                  <div className={invoicePreviewStyles.invoiceFromLabel}>
                    Invoice From
                  </div>
                  <div className={invoicePreviewStyles.companyName}>
                    {fromName}
                  </div>
                  <div className={invoicePreviewStyles.companyAddress}>
                    {fromAddress}
                  </div>
                  <div className={invoicePreviewStyles.companyContact}>
                    {fromEmail ? (
                      <div>
                        <strong>Email:</strong> {fromEmail}
                      </div>
                    ) : null}
                    {fromPhone ? (
                      <div>
                        <strong>Phone:</strong> {fromPhone}
                      </div>
                    ) : null}
                    {fromTaxId ? (
                      <div>
                        <strong>Tax ID:</strong> {fromTaxId}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className={invoicePreviewStyles.invoiceInfo}>
                <div className={invoicePreviewStyles.invoiceTitle}>INVOICE</div>
                <div className={invoicePreviewStyles.invoiceNumber}>
                  #{invoiceNum}
                </div>

                <div className={invoicePreviewStyles.invoiceDetails}>
                  <div className={invoicePreviewStyles.invoiceDetailRow}>
                    <span className={invoicePreviewStyles.invoiceDetailLabel}>
                      Invoice Date:
                    </span>
                    <span className={invoicePreviewStyles.invoiceDetailValue}>
                      {invoice.issueDate ? formatDate(invoice.issueDate) : "—"}
                    </span>
                  </div>
                  <div className={invoicePreviewStyles.invoiceDetailRow}>
                    <span className={invoicePreviewStyles.invoiceDetailLabel}>
                      Due Date:
                    </span>
                    <span className={invoicePreviewStyles.invoiceDetailValue}>
                      {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                    </span>
                  </div>
                  <div className={invoicePreviewStyles.invoiceDetailRow}>
                    <span className={invoicePreviewStyles.invoiceDetailLabel}>
                      Status:
                    </span>
                    <span
                      className={`${
                        invoicePreviewStyles.invoiceDetailValue
                      } ${getStatusColorClass(invoice.status)}`}
                    >
                      {formatStatusLabel(invoice.status)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={invoicePreviewStyles.section}>
              <div className={invoicePreviewStyles.flexContainer}>
                <div className="flex-1">
                  <div className={invoicePreviewStyles.billToLabel}>Bill To</div>
                  <div className={invoicePreviewStyles.clientDetails}>
                    <div className={invoicePreviewStyles.clientName}>
                      {client.name || "Client Name"}
                    </div>
                    {client.address && (
                      <div className={invoicePreviewStyles.clientText}>
                        {client.address}
                      </div>
                    )}
                    {client.email && (
                      <div className={invoicePreviewStyles.clientText}>
                        {client.email}
                      </div>
                    )}
                    {client.phone && (
                      <div className={invoicePreviewStyles.clientText}>
                        {client.phone}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1">
                  <div className={invoicePreviewStyles.paymentDetailsLabel}>
                    Payment Details
                  </div>
                  <div className={invoicePreviewStyles.paymentDetails}>
                    <div className={invoicePreviewStyles.paymentDetailRow}>
                      <span className={invoicePreviewStyles.paymentDetailLabel}>
                        Currency:
                      </span>
                      <span className={invoicePreviewStyles.paymentDetailValue}>
                        {invoiceCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={invoicePreviewStyles.section}>
              <ItemsTable items={items} invoiceCurrency={invoiceCurrency} />
            </div>

            {invoice.notes && (
              <div className={invoicePreviewStyles.section}>
                <div className={invoicePreviewStyles.notesLabel}>Notes</div>
                <div className={invoicePreviewStyles.notesContent}>
                  {invoice.notes}
                </div>
              </div>
            )}

            <div className={invoicePreviewStyles.section}>
              <div className={invoicePreviewStyles.flexContainer}>
                <div className="flex-1">
                  <SignatureBlock
                    signature={signature}
                    signatureName={signatureName}
                    signatureTitle={signatureTitle}
                  />
                </div>
                <div className="flex-1">
                  <StampBlock stamp={stamp} />
                </div>
                <div className="flex-1">
                  <TotalsBox
                    subtotal={subtotal}
                    taxPercent={taxPercent}
                    tax={tax}
                    total={total}
                    invoiceCurrency={invoiceCurrency}
                  />
                </div>
              </div>
            </div>

            <div className={invoicePreviewStyles.footer}>
              <div className={invoicePreviewStyles.footerText}>
                {footerText}
              </div>
              <div className={invoicePreviewStyles.footerSubText}>
                Invoice generated by PromptToInvoice • {formatDate(new Date())}
              </div>
            </div>
          </>
        );
    }
  }

  return (
    <div
      className={`${invoicePreviewStyles.pageContainer} print:min-h-0 print:p-0 print:bg-white`}
    >
      <div
        className={`${invoicePreviewStyles.container} print:max-w-none print:m-0`}
      >
        <div
          className={`${invoicePreviewStyles.headerContainer} ${invoicePreviewStyles.noPrint}`}
        >
          <div>
            <h1 className={invoicePreviewStyles.headerTitle}>
              Invoice Preview
            </h1>
            <p className={invoicePreviewStyles.headerSubtitle}>
              Review invoice{" "}
              <span className={invoicePreviewStyles.headerInvoiceNumber}>
                #{invoiceNum}
              </span>
              <span
                className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  theme.isAi
                    ? "bg-indigo-100 text-indigo-800"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {theme.isAi ? `AI Design: ${theme.label}` : theme.label}
              </span>
            </p>
          </div>

          <div className={invoicePreviewStyles.headerActions}>
            <button
              type="button"
              onClick={goToEdit}
              className={invoicePreviewStyles.editInvoiceButton}
            >
              <EditIcon className="w-4 h-4" /> Edit Invoice
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className={invoicePreviewStyles.printButton}
            >
              <PrintIcon className="w-4 h-4" /> Print / Save as PDF
            </button>
          </div>
        </div>

        <div id="print-area" className={invoicePreviewStyles.printArea}>
          {renderInvoiceBody()}
        </div>
      </div>
    </div>
  );
}
