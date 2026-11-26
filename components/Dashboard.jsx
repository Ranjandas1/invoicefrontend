"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { dashboardStyles } from "@/assets/dummyStyles";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import KpiCard from "@/components/KpiCard";
import { EyeIcon, FileTextIcon } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import AiInvoiceModal from "@/components/AiInvoiceModal";
import GeminiIcon from "@/components/GeminiIcon";
import { DashboardSkeleton } from "@/components/BrandLoader";
import { setNavState } from "@/lib/navState";
import {
  API_BASE,
  normalizeClient,
  currencyFmt,
  formatDate,
  createInvoiceWithAI,
} from "@/lib/invoiceUtils";

function capitalize(s) {
  if (!s) return s;
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

const Dashboard = () => {
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const toast = useToast();

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

  const [storedInvoices, setStoredInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await obtainToken();
      const headers = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/invoices`, {
        method: "GET",
        headers,
      });

      const json = await res.json().catch(() => null);

      if (res.status === 401) {
        setError("Unauthorized. Please sign in.");
        setStoredInvoices([]);
        return;
      }

      if (!res.ok) {
        throw new Error(json?.message || `Failed (${res.status})`);
      }

      const raw = json?.data || [];

      const mapped = (Array.isArray(raw) ? raw : []).map((inv) => {
        const amountVal = Number(inv?.total ?? inv?.amount ?? 0);
        const currency = (inv?.currency || "USD").toUpperCase();

        return {
          ...inv,
          id: inv?.invoiceNumber || inv?._id || String(inv?._id || ""),
          client: normalizeClient(inv?.client),
          amount: amountVal,
          currency,
          status:
            typeof inv?.status === "string"
              ? capitalize(inv.status)
              : inv?.status || "Draft",
        };
      });

      setStoredInvoices(mapped);
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
      setError(err?.message || "Failed to load invoices");
      setStoredInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [obtainToken]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) fetchInvoices();
    });

    function onStorage(e) {
      if (e.key === "invoices_v1") fetchInvoices();
    }

    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, [fetchInvoices, isSignedIn]);

  const kpis = useMemo(() => {
    const totalInvoices = storedInvoices.length;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let paidCount = 0;

    for (const inv of storedInvoices) {
      const amt = inv.amount || 0;
      if (inv.status === "Paid") {
        totalPaid += amt;
        paidCount += 1;
      } else {
        totalUnpaid += amt;
      }
    }

    const paidPercentage =
      totalInvoices > 0 ? (paidCount / totalInvoices) * 100 : 0;

    return { totalInvoices, totalPaid, totalUnpaid, paidCount, paidPercentage };
  }, [storedInvoices]);

  const recent = useMemo(() => storedInvoices.slice(0, 5), [storedInvoices]);

  function getClientName(inv) {
    return inv?.client?.name || "Unknown";
  }

  function getClientInitial(inv) {
    const name = getClientName(inv);
    return name ? name.charAt(0).toUpperCase() : "?";
  }

  function openInvoice(inv) {
    if (!inv?.id) return;
    router.push(`/app/invoices/${inv.id}`);
  }

  async function handleGenerateFromAI(rawText, userData = null) {
    try {
      const token = await obtainToken();
      const created = await createInvoiceWithAI({
        token,
        prompt: rawText,
        userData,
      });
      const targetId = created?.invoiceNumber || created?._id || created?.id;
      await fetchInvoices();
      setAiOpen(false);
      toast.success(
        targetId
          ? `AI invoice ${targetId} generated.`
          : "AI invoice generated successfully."
      );
      if (targetId) {
        setNavState(targetId, { ...created, id: targetId });
        router.push(`/app/invoices/${encodeURIComponent(targetId)}/edit`);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to generate invoice with AI.");
      throw err;
    }
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className={dashboardStyles.pageContainer}>
      <div className={dashboardStyles.headerContainer}>
        <h1 className={dashboardStyles.headerTitle}>Dashboard Overview</h1>
        <p className={dashboardStyles.headerSubtitle}>
          Track your invoicing performance and business insights
        </p>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="text-sm font-medium text-red-700 mb-3">
            Error: {error}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={fetchInvoices}
              className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Retry
            </button>
            {String(error).toLowerCase().includes("unauthorized") && (
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="px-3 py-1.5 text-sm font-medium bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      ) : null}

      <div className={dashboardStyles.kpiGrid}>
        <KpiCard
          title="Total Invoices"
          value={kpis.totalInvoices}
          hint="Active invoices"
          iconType="document"
          trend={8.5}
        />
        <KpiCard
          title="Total Paid"
          value={currencyFmt(kpis.totalPaid, "USD")}
          hint="Received Amount"
          iconType="revenue"
          trend={12.2}
        />
        <KpiCard
          title="Total Unpaid"
          value={currencyFmt(kpis.totalUnpaid, "USD")}
          hint="Outstanding Balance"
          iconType="clock"
          trend={-3.1}
        />
      </div>

      <div className={dashboardStyles.mainGrid}>
        <div className={dashboardStyles.sidebarColumn}>
          <div className={dashboardStyles.quickStatsCard}>
            <h3 className={dashboardStyles.quickStatsTitle}>Quick Stats</h3>
            <div className="space-y-3">
              <div className={dashboardStyles.quickStatsRow}>
                <span className={dashboardStyles.quickStatsLabel}>Paid Rate</span>
                <span className={dashboardStyles.quickStatsValue}>
                  {kpis.paidPercentage.toFixed(1)} %
                </span>
              </div>
              <div className={dashboardStyles.quickStatsRow}>
                <span className={dashboardStyles.quickStatsLabel}>
                  Avg. Invoice
                </span>
                <span className={dashboardStyles.quickStatsValue}>
                  {currencyFmt(
                    kpis.totalInvoices > 0
                      ? (kpis.totalPaid + kpis.totalUnpaid) / kpis.totalInvoices
                      : 0,
                    "USD"
                  )}
                </span>
              </div>
              <div className={dashboardStyles.quickStatsRow}>
                <span className={dashboardStyles.quickStatsLabel}>
                  Collection Eff.
                </span>
                <span className={dashboardStyles.quickStatsValue}>
                  {kpis.paidPercentage.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className={dashboardStyles.cardContainer}>
            <div className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className={dashboardStyles.quickActionsContainer}>
                {/* <button
                  type="button"
                  onClick={() => setAiOpen(true)}
                  className={`${dashboardStyles.quickActionButton} ${dashboardStyles.quickActionBlue}`}
                >
                  <div
                    className={`${dashboardStyles.quickActionIconContainer} ${dashboardStyles.quickActionIconBlue}`}
                  >
                    <GeminiIcon className="w-4 h-4" />
                  </div>
                  <span className={dashboardStyles.quickActionText}>
                    Create with AI
                  </span>
                </button> */}

                <button
                  type="button"
                  onClick={() => router.push("/app/create-invoice")}
                  className={`${dashboardStyles.quickActionButton} ${dashboardStyles.quickActionGray}`}
                >
                  <div
                    className={`${dashboardStyles.quickActionIconContainer} ${dashboardStyles.quickActionIconBlue}`}
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 5v14m-7-7h14" />
                    </svg>
                  </div>
                  <span className={dashboardStyles.quickActionText}>
                    Create Invoice
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/app/invoices")}
                  className={`${dashboardStyles.quickActionButton} ${dashboardStyles.quickActionGray}`}
                >
                  <div
                    className={`${dashboardStyles.quickActionIconContainer} ${dashboardStyles.quickActionIconGray}`}
                  >
                    <FileTextIcon className="w-4 h-4" />
                  </div>
                  <span className={dashboardStyles.quickActionText}>
                    View All Invoices
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/app/business")}
                  className={`${dashboardStyles.quickActionButton} ${dashboardStyles.quickActionGray}`}
                >
                  <div
                    className={`${dashboardStyles.quickActionIconContainer} ${dashboardStyles.quickActionIconGray}`}
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <span className={dashboardStyles.quickActionText}>
                    Business Profile
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={dashboardStyles.contentColumn}>
          <div className={dashboardStyles.cardContainerOverflow}>
            <div className={dashboardStyles.tableHeader}>
              <div className={dashboardStyles.tableHeaderContent}>
                <div>
                  <h3 className={dashboardStyles.tableTitle}>Recent Invoices</h3>
                  <p className={dashboardStyles.tableSubtitle}>
                    Latest 5 invoices from your account
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/app/invoices")}
                  className={dashboardStyles.tableActionButton}
                >
                  View all
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14m-7-7l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className={dashboardStyles.tableContainer}>
              <table className={dashboardStyles.table}>
                <thead>
                  <tr className={dashboardStyles.tableHead}>
                    <th className={dashboardStyles.tableHeaderCell}>
                      Client & ID
                    </th>
                    <th className={dashboardStyles.tableHeaderCell}>Amount</th>
                    <th className={dashboardStyles.tableHeaderCell}>Status</th>
                    <th className={dashboardStyles.tableHeaderCell}>Due Date</th>
                    <th className={dashboardStyles.tableHeaderCell}>Actions</th>
                  </tr>
                </thead>
                <tbody className={dashboardStyles.tableBody}>
                  {recent.map((inv) => {
                    const clientName = getClientName(inv);
                    const clientInitial = getClientInitial(inv);

                    return (
                      <tr
                        key={inv.id}
                        className={dashboardStyles.tableRow}
                        onClick={() => openInvoice(inv)}
                      >
                        <td className={dashboardStyles.tableCell}>
                          <div className="flex items-center gap-3">
                            <div className={dashboardStyles.clientAvatar}>
                              {clientInitial}
                            </div>
                            <div>
                              <div className={dashboardStyles.clientInfo}>
                                {clientName}
                              </div>
                              <div className={dashboardStyles.clientSubInfo}>
                                {inv.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={dashboardStyles.tableCell}>
                          <div className={dashboardStyles.amountCell}>
                            {currencyFmt(inv.amount, inv.currency)}
                          </div>
                        </td>
                        <td className={dashboardStyles.tableCell}>
                          <StatusBadge
                            status={inv.status}
                            size="default"
                            showIcon={true}
                          />
                        </td>
                        <td className={dashboardStyles.tableCell}>
                          <div className={dashboardStyles.dateCell}>
                            {inv.dueDate ? formatDate(inv.dueDate) : "-"}
                          </div>
                        </td>
                        <td className={dashboardStyles.tableCell}>
                          <div className="text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openInvoice(inv);
                              }}
                              className={dashboardStyles.actionButton}
                            >
                              <EyeIcon className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {recent.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className={dashboardStyles.emptyState}>
                        <div className={dashboardStyles.emptyStateText}>
                          <FileTextIcon
                            className={dashboardStyles.emptyStateIcon}
                          />
                          <div className={dashboardStyles.emptyStateMessage}>
                            No invoice yet
                          </div>
                          <button
                            type="button"
                            onClick={() => router.push("/app/create-invoice")}
                            className={dashboardStyles.emptyStateAction}
                          >
                            Create your first Invoice
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <AiInvoiceModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onGenerate={handleGenerateFromAI}
        initialText=""
      />
    </div>
  );
};

export default Dashboard;
