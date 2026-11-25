"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import StatusBadge from "@/components/StatusBadge";
import AiInvoiceModal from "@/components/AiInvoiceModal";
import GeminiIcon from "@/components/GeminiIcon";
import { getNavState, setNavState } from "@/lib/navState";
import {
  createInvoiceStyles,
  createInvoiceIconColors,
  createInvoiceCustomStyles,
  invoicesStyles,
} from "@/assets/dummyStyles";

import {
  API_BASE,
  resolveImageUrl,
  currencyFmt,
  computeTotals,
  readJSON,
  writeJSON,
  generateInvoiceWithAI,
  normalizeClient,
} from "@/lib/invoiceUtils";

/* ---------- local invoices helpers (fallback) ---------- */
function getStoredInvoices() {
  return readJSON("invoices_v1", []) || [];
}
function saveStoredInvoices(arr) {
  writeJSON("invoices_v1", arr);
}

/* ---------- util ---------- */
function uid() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (error) {
    console.warn("Failed to generate uuid:", error);
  }
  return Math.random().toString(36).slice(2, 9);
}
function normalizeInvoiceItems(rawItems) {
  const items = Array.isArray(rawItems)
    ? rawItems
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: item.id || item._id || uid(),
          description:
            [item.description, item.name, item.itemName, item.title].find(
              (value) => typeof value === "string" && value.trim(),
            ) ?? "",
          qty: item.qty ?? item.quantity ?? 1,
          unitPrice: item.unitPrice ?? item.price ?? item.rate ?? 0,
        }))
    : [];

  return items.length
    ? items
    : [{ id: uid(), description: "Service / Item", qty: 1, unitPrice: 0 }];
}

/* ---------- icons ---------- (kept same as before) */
const PreviewIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const SaveIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);
const UploadIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const DeleteIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const AddIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 5v14m-7-7h14" />
  </svg>
);

function buildDefaultInvoice() {
  const localId = uid();
  return {
    id: localId, // local preview id (server will return _id after save)
    invoiceNumber: "", // will be set on creation by generator
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    fromBusinessName: "",
    fromEmail: "",
    fromAddress: "",
    fromPhone: "",
    fromTaxId: "", // EIN for US, VAT for Europe
    client: { name: "", email: "", address: "", phone: "" },
    items: [{ id: uid(), description: "", qty: 1, unitPrice: "" }],
    currency: "USD",
    status: "draft",
    templateStyle: "default",
    stampDataUrl: null,
    signatureDataUrl: null,
    logoDataUrl: null,
    signatureName: "",
    signatureTitle: "",
    // leave taxPercent undefined so business profile default can fill it
    taxPercent: undefined,
    notes: "",
  };
}

function mergeProfileDefaults(prev, profile, { force = false } = {}) {
  if (!prev || !profile) return prev;
  const pickText = (current, fallback) => {
    if (force) return fallback || current || "";
    return !current || !String(current).trim() ? fallback || "" : current;
  };
  const pickAsset = (current, fallback) => {
    const resolved = resolveImageUrl(fallback) || null;
    if (force) return resolved ?? current ?? null;
    return current || resolved || null;
  };

  return {
    ...prev,
    fromBusinessName: pickText(prev.fromBusinessName, profile.businessName),
    fromEmail: pickText(prev.fromEmail, profile.email),
    fromAddress: pickText(prev.fromAddress, profile.address),
    fromPhone: pickText(prev.fromPhone, profile.phone),
    fromTaxId: pickText(prev.fromTaxId, profile.taxId),
    logoDataUrl: pickAsset(prev.logoDataUrl, profile.logoUrl),
    stampDataUrl: pickAsset(prev.stampDataUrl, profile.stampUrl),
    signatureDataUrl: pickAsset(prev.signatureDataUrl, profile.signatureUrl),
    signatureName: pickText(prev.signatureName, profile.signatureOwnerName),
    signatureTitle: pickText(prev.signatureTitle, profile.signatureOwnerTitle),
    taxPercent: force
      ? Number(profile.defaultTaxPercent ?? prev.taxPercent ?? 0)
      : prev.taxPercent !== undefined && prev.taxPercent !== null
        ? prev.taxPercent
        : Number(profile.defaultTaxPercent ?? 0),
  };
}

/* ---------- Component (Create / Edit Invoice) ---------- */
export default function CreateInvoice() {
  const router = useRouter();
  const { id } = useParams(); // if editing, id will be present
  const [invoiceFromState] = useState(() => (id ? getNavState(id) : null));
  const isEditing = Boolean(id && id !== "new");

  // Auth hooks
  const { getToken, isSignedIn } = useAuth();

  // helper to obtain token with a retry
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

  const [invoice, setInvoice] = useState(() => buildDefaultInvoice());
  const [businessProfile, setBusinessProfile] = useState(null);
  const businessProfileRef = useRef(null);
  const items = invoice?.items || [];
  const [loading, setLoading] = useState(false);
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiEnhanceError, setAiEnhanceError] = useState("");
  const [aiOpen, setAiOpen] = useState(false);

  // profile fetched from server

  /* ---------- helpers for invoice editing ---------- */
  function updateInvoiceField(field, value) {
    setInvoice((inv) => (inv ? { ...inv, [field]: value } : inv));
  }
  function updateClient(field, value) {
    setInvoice((inv) =>
      inv ? { ...inv, client: { ...(inv.client || {}), [field]: value } } : inv,
    );
  }

  function updateItem(idx, key, value) {
    setInvoice((inv) => {
      if (!inv) return inv;
      const nextItems = (inv.items || []).slice();
      nextItems[idx] = { ...(nextItems[idx] || {}), [key]: value };
      return { ...inv, items: nextItems };
    });
  }
  function addItem() {
    const it = { id: uid(), description: "", qty: 1, unitPrice: '' };
    setInvoice((inv) => {
      if (!inv) return inv;
      return { ...inv, items: [...(inv.items || []), it] };
    });
  }
  function removeItem(idx) {
    const emptyItem = { id: uid(), description: "", qty: 1, unitPrice: '' };
    setInvoice((inv) => {
      if (!inv) return inv;
      const next = (inv.items || []).filter((_, i) => i !== idx);
      return { ...inv, items: next.length ? next : [emptyItem] };
    });
  }

  /* status & currency handlers */
  function handleStatusChange(newStatus) {
    setInvoice((inv) => (inv ? { ...inv, status: newStatus } : inv));
  }
  function handleCurrencyChange(newCurrency) {
    setInvoice((inv) => (inv ? { ...inv, currency: newCurrency } : inv));
  }

  /* images - keep as data URLs in the invoice object */
  function handleImageUpload(file, kind = "logo") {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ({ target }) => {
      const dataUrl = target?.result;
      if (!dataUrl) return;
      setInvoice((inv) =>
        inv
          ? {
              ...inv,
              [`${kind}DataUrl`]: dataUrl,
            }
          : inv,
      );
    };
    reader.readAsDataURL(file);
  }
  function removeImage(kind = "logo") {
    setInvoice((inv) =>
      inv
        ? {
            ...inv,
            [`${kind}DataUrl`]: null,
          }
        : inv,
    );
  }

  /* ---------- helper: check candidate invoiceNumber exists on server/local ---------- */
  const checkInvoiceExists = useCallback(
    async (candidate) => {
      // Check local storage first
      const local = getStoredInvoices();
      if (local.some((x) => x && x.invoiceNumber === candidate)) return true;

      // If we have token, ask server
      try {
        const token = await obtainToken();
        const headers = { Accept: "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(
          `${API_BASE}/api/invoices?invoiceNumber=${encodeURIComponent(
            candidate,
          )}`,
          { method: "GET", headers },
        );
        if (!res.ok) {
          // if unauthorized or server error, treat as "not found" to avoid blocking generation;
          // collisions will still be caught on save (server returns 409).
          return false;
        }
        const json = await res.json().catch(() => null);
        const data = json?.data || json || [];
        if (Array.isArray(data) && data.length > 0) return true;
        return false;
      } catch {
        // network / other error -> assume not exists (we rely on server-side check on save)
        return false;
      }
    },
    [obtainToken],
  );

  /* ---------- generator: create a candidate and ensure uniqueness (tries up to N times) ---------- */
  const generateUniqueInvoiceNumber = useCallback(
    async (attempts = 10) => {
      for (let i = 0; i < attempts; i++) {
        const datePart = new Date()
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "");
        const rand = Math.floor(Math.random() * 9000) + 1000; // 4 digit
        const candidate = `INV-${datePart}-${rand}`;
        // quick local check first
        const exists = await checkInvoiceExists(candidate);
        if (!exists) return candidate;
        // else loop to try again
      }
      // fallback: use uid suffix if all attempts collide (very unlikely)
      return `INV-${new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "")}-${uid().slice(0, 4)}`;
    },
    [checkInvoiceExists],
  );

  /* ---------- fetch business profile as soon as page loads (when signed in) ---------- */
  useEffect(() => {
    let mounted = true;

    async function fetchBusinessProfile() {
      if (!isSignedIn) return;
      try {
        const token = await obtainToken();
        if (!token) return;
        const res = await fetch(`${API_BASE}/api/businessProfile/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });
        if (!res.ok || res.status === 204) {
          return;
        }
        const json = await res.json().catch(() => null);
        const data = json?.data ?? null;
        if (!data || !mounted) return;

        const serverProfile = {
          businessName: data.businessName ?? "",
          email: data.email ?? "",
          address: data.address ?? "",
          phone: data.phone ?? "",
          taxId: data.taxId ?? data.gst ?? "", // Support legacy GST field
          defaultTaxPercent: data.defaultTaxPercent ?? 0,
          signatureOwnerName: data.signatureOwnerName ?? "",
          signatureOwnerTitle: data.signatureOwnerTitle ?? "",
          logoUrl: data.logoUrl ?? null,
          stampUrl: data.stampUrl ?? null,
          signatureUrl: data.signatureUrl ?? null,
        };

        businessProfileRef.current = serverProfile;
        setBusinessProfile(serverProfile);
        setInvoice((prev) => mergeProfileDefaults(prev, serverProfile));
      } catch (err) {
        console.warn("Failed to fetch business profile:", err);
      }
    }

    fetchBusinessProfile();

    return () => {
      mounted = false;
    };
  }, [isSignedIn, obtainToken]);

  /* ---------- load invoice when editing (server first, fallback local) ---------- */
  useEffect(() => {
    let mounted = true;

    async function prepare() {
      // If AI/Gemini/preview handoff passed an invoice via sessionStorage
      if (invoiceFromState) {
        // merge then normalize any image URLs that may be `http://localhost:...`
        const base = { ...buildDefaultInvoice(), ...invoiceFromState };
        base.items = normalizeInvoiceItems(invoiceFromState.items);

        base.logoDataUrl =
          resolveImageUrl(base.logoDataUrl ?? base.logoUrl ?? base.logo) ||
          null;
        base.stampDataUrl =
          resolveImageUrl(base.stampDataUrl ?? base.stampUrl ?? base.stamp) ||
          null;
        base.signatureDataUrl =
          resolveImageUrl(
            base.signatureDataUrl ?? base.signatureUrl ?? base.signature,
          ) || null;

        setInvoice(mergeProfileDefaults(base, businessProfileRef.current));

        return;
      }

      // If editing and no invoiceFromState then fetch from server (or local fallback)
      if (isEditing && !invoiceFromState) {
        setLoading(true);
        try {
          const token = await obtainToken();
          const headers = { Accept: "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const res = await fetch(`${API_BASE}/api/invoices/${id}`, {
            method: "GET",
            headers,
          });
          if (res.ok) {
            const json = await res.json().catch(() => null);
            const data = json?.data || json || null;
            if (data && mounted) {
              const merged = { ...buildDefaultInvoice(), ...data };
              merged.id = data._id ?? data.id ?? merged.id;
              merged.invoiceNumber = data.invoiceNumber ?? merged.invoiceNumber;
              merged.items = normalizeInvoiceItems(data.items);

              // normalize server-returned image fields (rewrite localhost/relative -> API_BASE)
              merged.logoDataUrl =
                resolveImageUrl(
                  data.logoDataUrl ?? data.logoUrl ?? data.logo,
                ) ||
                merged.logoDataUrl ||
                null;
              merged.stampDataUrl =
                resolveImageUrl(
                  data.stampDataUrl ?? data.stampUrl ?? data.stamp,
                ) ||
                merged.stampDataUrl ||
                null;
              merged.signatureDataUrl =
                resolveImageUrl(
                  data.signatureDataUrl ?? data.signatureUrl ?? data.signature,
                ) ||
                merged.signatureDataUrl ||
                null;

              setInvoice(
                mergeProfileDefaults(merged, businessProfileRef.current),
              );
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          // ignore and fallback
          console.warn(
            "Server invoice fetch failed, will fallback to local:",
            err,
          );
        } finally {
          setLoading(false);
        }

        // fallback to local storage
        const all = getStoredInvoices();
        const found = all.find(
          (x) => x && (x.id === id || x._id === id || x.invoiceNumber === id),
        );
        if (found && mounted) {
          const fixed = { ...buildDefaultInvoice(), ...found };
          fixed.items = normalizeInvoiceItems(found.items);

          fixed.logoDataUrl =
            resolveImageUrl(found.logoDataUrl ?? found.logoUrl ?? found.logo) ||
            fixed.logoDataUrl ||
            null;
          fixed.stampDataUrl =
            resolveImageUrl(
              found.stampDataUrl ?? found.stampUrl ?? found.stamp,
            ) ||
            fixed.stampDataUrl ||
            null;
          fixed.signatureDataUrl =
            resolveImageUrl(
              found.signatureDataUrl ?? found.signatureUrl ?? found.signature,
            ) ||
            fixed.signatureDataUrl ||
            null;

          setInvoice(mergeProfileDefaults(fixed, businessProfileRef.current));
        }

        return;
      }

      // Creating new (neither editing nor invoiceFromState)
      setInvoice((prev) =>
        mergeProfileDefaults(
          { ...buildDefaultInvoice(), ...prev },
          businessProfileRef.current,
        ),
      );

      // generate unique invoice number for new invoices
      if (!isEditing) {
        try {
          const candidate = await generateUniqueInvoiceNumber(10);
          if (mounted) {
            setInvoice((inv) =>
              inv ? { ...inv, invoiceNumber: candidate } : inv,
            );
          }
        } catch (err) {
          // ignore, keep empty (server will handle on save)
          console.warn("Invoice number generation failed:", err);
        }
      }
    }

    prepare();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditing, obtainToken, generateUniqueInvoiceNumber]);

  /* ---------- Save invoice to backend (POST or PUT) using auth token ---------- */
  async function handleSave({ preview = false, overrideInvoice = null } = {}) {
    const activeInvoice = overrideInvoice || invoice;
    if (!activeInvoice) return;

    const activeItems = activeInvoice.items || [];
    const validItems = activeItems.filter(
      (it) => it && typeof it.description === "string" && it.description.trim().length > 0,
    );
    if (!validItems.length) {
      alert("Please add at least one invoice item with a description.");
      return;
    }

    setLoading(true);

    try {
      const taxPercentValue = Number(activeInvoice.taxPercent ?? 0);
      const computedTotals = computeTotals(validItems, taxPercentValue);

      // Build prepared object but OMIT invoiceNumber when empty so server auto-generates.
      const prepared = {
        issueDate: activeInvoice.issueDate || "",
        dueDate: activeInvoice.dueDate || "",
        fromBusinessName: activeInvoice.fromBusinessName || "",
        fromEmail: activeInvoice.fromEmail || "",
        fromAddress: activeInvoice.fromAddress || "",
        fromPhone: activeInvoice.fromPhone || "",
        fromTaxId: activeInvoice.fromTaxId || activeInvoice.fromGst || "", // Support legacy GST field
        client: activeInvoice.client || {},
        items: validItems,
        currency: activeInvoice.currency || "USD",
        status: activeInvoice.status || "draft",
        templateStyle: activeInvoice.templateStyle || "default",
        taxPercent: taxPercentValue,
        subtotal: computedTotals.subtotal,
        tax: computedTotals.tax,
        total: computedTotals.total,
        logoDataUrl: activeInvoice.logoDataUrl || null,
        stampDataUrl: activeInvoice.stampDataUrl || null,
        signatureDataUrl: activeInvoice.signatureDataUrl || null,
        signatureName: activeInvoice.signatureName || "",
        signatureTitle: activeInvoice.signatureTitle || "",
        notes: activeInvoice.notes || "",
        localId: activeInvoice.id,
      };

      // include invoiceNumber only if provided (we prefill for new invoices)
      if (
        activeInvoice.invoiceNumber &&
        String(activeInvoice.invoiceNumber).trim().length > 0
      ) {
        prepared.invoiceNumber = String(activeInvoice.invoiceNumber).trim();
      }

      const endpoint =
        isEditing && activeInvoice.id
          ? `${API_BASE}/api/invoices/${activeInvoice.id}`
          : `${API_BASE}/api/invoices`;
      const method = isEditing && activeInvoice.id ? "PUT" : "POST";

      // try to obtain auth token; if present include Authorization
      const token = await obtainToken();
      if (!token) {
        const authErr = new Error("Please sign in to save this invoice.");
        authErr.isHttp = true;
        throw authErr;
      }
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify(prepared),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.message || `Save failed (${res.status})`;
        const httpErr = new Error(msg);
        httpErr.isHttp = true;
        httpErr.status = res.status;
        throw httpErr;
      }

      const saved = json?.data || json || null;
      const savedId = saved?._id ?? saved?.id ?? activeInvoice.id;
      const savedItems = normalizeInvoiceItems(
        Array.isArray(saved?.items) ? saved.items : validItems,
      );

      // Use server-provided invoiceNumber (if server generated one)
      const merged = {
        ...prepared,
        id: savedId,
        items: savedItems,
        invoiceNumber:
          saved?.invoiceNumber ??
          prepared.invoiceNumber ??
          activeInvoice.invoiceNumber,
        subtotal: saved?.subtotal ?? prepared.subtotal,
        tax: saved?.tax ?? prepared.tax,
        total: saved?.total ?? prepared.total,
      };

      setInvoice((inv) => ({ ...inv, ...merged }));

      // update local stored invoices (keep local fallback in sync)
      const all = getStoredInvoices();
      if (isEditing) {
        const idx = all.findIndex(
          (x) =>
            x &&
            (x.id === activeInvoice.id ||
              x._id === activeInvoice.id ||
              x.invoiceNumber === activeInvoice.invoiceNumber),
        );
        if (idx >= 0) all[idx] = merged;
        else all.unshift(merged);
      } else {
        // For newly created, use server's invoiceNumber/id if provided
        all.unshift(merged);
      }
      saveStoredInvoices(all);

      if (preview) {
        setNavState(savedId, merged);
        router.push(`/app/invoices/${encodeURIComponent(savedId)}/preview`);
        return;
      }

      alert(`Invoice ${isEditing ? "updated" : "created"} successfully.`);
      router.push("/app/invoices");
    } catch (err) {
      console.error("Failed to save invoice to server:", err);

      if (err?.isHttp || preview) {
        alert(err?.message || "Failed to save invoice.");
        return;
      }

      // Network fallback: save locally only when server is unreachable
      try {
        const all = getStoredInvoices();
        const localTotals = computeTotals(validItems, activeInvoice.taxPercent ?? 0);
        const preparedLocal = {
          ...activeInvoice,
          items: validItems,
          subtotal: localTotals.subtotal,
          tax: localTotals.tax,
          total: localTotals.total,
        };
        if (isEditing) {
          const idx = all.findIndex(
            (x) =>
              x &&
              (x.id === activeInvoice.id ||
                x._id === activeInvoice.id ||
                x.invoiceNumber === activeInvoice.invoiceNumber),
          );
          if (idx >= 0) all[idx] = preparedLocal;
          else all.unshift(preparedLocal);
        } else {
          all.unshift(preparedLocal);
        }
        saveStoredInvoices(all);
        alert("Saved locally as fallback (network offline).");
        router.push("/app/invoices");
      } catch (localErr) {
        console.error("Local fallback failed:", localErr);
        alert(err?.message || "Save failed. See console.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handlePreview() {
    return handleSave({ preview: true });
  }

  function handleCreateDefaultInvoice() {
    setAiEnhanceError("");
    const defaultStyled = { ...invoice, templateStyle: "default" };
    setInvoice(defaultStyled);
    return handleSave({ preview: true, overrideInvoice: defaultStyled });
  }

  function handleApplyBusinessProfile() {
    if (!businessProfile) {
      alert("No saved business profile found. Configure one in Business Profile first.");
      return;
    }
    setInvoice((prev) => mergeProfileDefaults(prev, businessProfile, { force: true }));
  }

  function mergeAiDataIntoInvoice(baseInvoice, aiData) {
    const base = baseInvoice || buildDefaultInvoice();
    const profile = businessProfileRef.current;
    const aiClient = normalizeClient(aiData.client);
    const nextItems = normalizeInvoiceItems(aiData.items);

    return {
      ...base,
      invoiceNumber:
        (typeof aiData.invoiceNumber === "string" &&
          aiData.invoiceNumber.trim()) ||
        base.invoiceNumber,
      issueDate: aiData.issueDate || base.issueDate,
      dueDate: aiData.dueDate || base.dueDate,
      fromBusinessName:
        aiData.fromBusinessName || base.fromBusinessName || profile?.businessName || "",
      fromEmail: aiData.fromEmail || base.fromEmail || profile?.email || "",
      fromAddress: aiData.fromAddress || base.fromAddress || profile?.address || "",
      fromPhone: aiData.fromPhone || base.fromPhone || profile?.phone || "",
      fromTaxId: aiData.fromTaxId || base.fromTaxId || profile?.taxId || "",
      client: {
        name: aiClient.name || base.client?.name || "",
        email: aiClient.email || base.client?.email || "",
        address: aiClient.address || base.client?.address || "",
        phone: aiClient.phone || base.client?.phone || "",
      },
      items: nextItems,
      currency: aiData.currency || base.currency || "USD",
      status: aiData.status || base.status || "draft",
      templateStyle:
        aiData.templateStyle || base.templateStyle || "executive-indigo",
      taxPercent:
        aiData.taxPercent !== undefined && aiData.taxPercent !== null
          ? Number(aiData.taxPercent)
          : base.taxPercent ?? profile?.defaultTaxPercent ?? 0,
      logoDataUrl:
        resolveImageUrl(aiData.logoDataUrl) ||
        base.logoDataUrl ||
        resolveImageUrl(profile?.logoUrl) ||
        null,
      stampDataUrl:
        resolveImageUrl(aiData.stampDataUrl) ||
        base.stampDataUrl ||
        resolveImageUrl(profile?.stampUrl) ||
        null,
      signatureDataUrl:
        resolveImageUrl(aiData.signatureDataUrl) ||
        base.signatureDataUrl ||
        resolveImageUrl(profile?.signatureUrl) ||
        null,
      signatureName:
        aiData.signatureName || base.signatureName || profile?.signatureOwnerName || "",
      signatureTitle:
        aiData.signatureTitle || base.signatureTitle || profile?.signatureOwnerTitle || "",
      notes: aiData.notes || base.notes || "",
    };
  }

  async function handleGenerateWithAI(rawText, userDataPayload = null) {
    const token = await obtainToken();
    const aiData = await generateInvoiceWithAI({
      token,
      prompt: rawText,
      userData: userDataPayload || invoice,
    });

    setInvoice((prev) => mergeAiDataIntoInvoice(prev, aiData));
    setAiOpen(false);
  }

  async function handleEnhanceAndCreateWithAI() {
    if (!invoice) return;

    const validItems = (items || []).filter(
      (it) => it && typeof it.description === "string" && it.description.trim().length > 0,
    );
    if (!validItems.length) {
      const msg = "Please add at least one invoice item with a description before generating with AI.";
      setAiEnhanceError(msg);
      alert(msg);
      return;
    }

    setAiEnhanceError("");
    setAiEnhancing(true);

    try {
      const token = await obtainToken();
      const aiData = await generateInvoiceWithAI({
        token,
        prompt: "",
        userData: { ...invoice, items: validItems },
        mode: "enhance",
      });

      const enhancedInvoice = {
        ...mergeAiDataIntoInvoice(invoice, aiData),
        items: validItems,
      };
      setInvoice(enhancedInvoice);
      await handleSave({ preview: true, overrideInvoice: enhancedInvoice });
    } catch (err) {
      console.error("Generate with AI failed:", err);
      setAiEnhanceError(err?.message || "Failed to generate invoice with AI.");
    } finally {
      setAiEnhancing(false);
    }
  }

  const totals = computeTotals(items, invoice?.taxPercent ?? 0);

  /* ---------- JSX (kept structure, invoiceNumber input prefills generated value) ---------- */
  return (
    <div className={createInvoiceStyles.pageContainer}>
      {/* Header Section */}
      <div className={createInvoiceStyles.headerContainer}>
        <div>
          <h1 className={createInvoiceStyles.headerTitle}>
            {isEditing ? "Edit Invoice" : "Create New Invoice"}
          </h1>
          <p className={createInvoiceStyles.headerSubtitle}>
            {isEditing
              ? "Update invoice details and items below"
              : "Fill in invoice details, add line items, and configure branding"}
          </p>
        </div>

        <div className={createInvoiceStyles.headerButtonContainer}>
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            disabled={loading || aiEnhancing}
            className={invoicesStyles.aiButton}
          >
            <GeminiIcon className="w-5 h-5 flex-none" />
            Fill with AI
          </button>
          <button
            type="button"
            onClick={() => handlePreview()}
            disabled={loading || aiEnhancing}
            className={createInvoiceStyles.previewButton}
          >
            <PreviewIcon className="w-4 h-4" />
            {loading ? "Saving..." : "Preview"}
          </button>
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={loading || aiEnhancing}
            className={createInvoiceStyles.saveButton}
          >
            <SaveIcon className="w-4 h-4" />
            {loading
              ? "Saving..."
              : isEditing
                ? "Update Invoice"
                : "Create Invoice"}
          </button>
        </div>
      </div>
      {/* Invoice Header Section */}
      <div className={createInvoiceStyles.cardContainer}>
        <div className={createInvoiceStyles.cardHeaderContainer}>
          <div
            className={`${createInvoiceStyles.cardIconContainer} ${createInvoiceIconColors.invoice}`}
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h2 className={createInvoiceStyles.cardTitle}>Invoice Details</h2>
        </div>

        <div className={createInvoiceStyles.gridCols3}>
          <div>
            <label className={createInvoiceStyles.label}>Invoice Number</label>
            <input
              value={invoice?.invoiceNumber || ""}
              onChange={(e) =>
                updateInvoiceField("invoiceNumber", e.target.value)
              }
              className={createInvoiceStyles.inputMedium}
            />
          </div>

          <div>
            <label className={createInvoiceStyles.label}>Invoice Date</label>
            <input
              type="date"
              value={invoice?.issueDate || ""}
              onChange={(e) => updateInvoiceField("issueDate", e.target.value)}
              className={createInvoiceStyles.input}
            />
          </div>

          <div>
            <label className={createInvoiceStyles.label}>Due Date</label>
            <input
              type="date"
              value={invoice?.dueDate || ""}
              onChange={(e) => updateInvoiceField("dueDate", e.target.value)}
              className={createInvoiceStyles.input}
            />
          </div>
        </div>

        {/* Currency and Status Section */}
        <div className={createInvoiceStyles.currencyStatusGrid}>
          {/* Currency Selection */}
          <div>
            <label className={createInvoiceStyles.labelWithMargin}>
              Currency
            </label>
            <div className={createInvoiceStyles.currencyContainer}>
              <button
                onClick={() => handleCurrencyChange("USD")}
                className={`${createInvoiceStyles.currencyButton} ${
                  invoice.currency === "USD"
                    ? createInvoiceStyles.currencyButtonActive1
                    : createInvoiceStyles.currencyButtonInactive
                }`}
              >
                <span className={createInvoiceCustomStyles.currencySymbol}>
                  $
                </span>
                <div className="text-left">
                  <div className="font-medium">US Dollar</div>
                  <div className="text-xs opacity-70">USD</div>
                </div>
              </button>

              <button
                onClick={() => handleCurrencyChange("EUR")}
                className={`${createInvoiceStyles.currencyButton} ${
                  invoice.currency === "EUR"
                    ? createInvoiceStyles.currencyButtonActive2
                    : createInvoiceStyles.currencyButtonInactive
                }`}
              >
                <span className={createInvoiceCustomStyles.currencySymbol}>
                  €
                </span>
                <div className="text-left">
                  <div className="font-medium">Euro</div>
                  <div className="text-xs opacity-70">EUR</div>
                </div>
              </button>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className={createInvoiceStyles.labelWithMargin}>
              Status
            </label>
            <div className={createInvoiceStyles.statusContainer}>
              {[
                { value: "draft", label: "Draft" },
                { value: "unpaid", label: "Unpaid" },
                { value: "paid", label: "Paid" },
                { value: "overdue", label: "Overdue" },
              ].map((status) => (
                <button
                  key={status.value}
                  onClick={() => handleStatusChange(status.value)}
                  className={`${createInvoiceStyles.statusButton} ${
                    invoice.status === status.value
                      ? createInvoiceStyles.statusButtonActive
                      : createInvoiceStyles.statusButtonInactive
                  }`}
                >
                  <StatusBadge
                    status={status.label}
                    size="default"
                    showIcon={true}
                  />
                </button>
              ))}
            </div>

            <div className={createInvoiceStyles.statusDropdown}>
              <select
                value={invoice.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full"
              >
                <option value="draft">Draft</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      {/* Main Content Grid - left & right columns remain unchanged except they use `invoice` state */}
      <div className={createInvoiceStyles.mainGrid}>
        <div className={createInvoiceStyles.leftColumn}>
          {/* Bill From */}
          <div className={createInvoiceStyles.cardContainer}>
            <div className={createInvoiceStyles.cardHeaderWithButton}>
              <div className={createInvoiceStyles.cardHeaderLeft}>
                <div
                  className={`${createInvoiceStyles.cardIconContainer} ${createInvoiceIconColors.billFrom}`}
                >
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <h3 className={createInvoiceStyles.cardTitle}>Bill From</h3>
              </div>
              {businessProfile && (
                <button
                  type="button"
                  onClick={handleApplyBusinessProfile}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  Apply Profile Defaults
                </button>
              )}
            </div>

            <div className={createInvoiceStyles.gridCols2}>
              <div>
                <label className={createInvoiceStyles.label}>
                  Business Name
                </label>
                <input
                  value={invoice?.fromBusinessName ?? ""}
                  onChange={(e) =>
                    updateInvoiceField("fromBusinessName", e.target.value)
                  }
                  placeholder="Your Business Name"
                  className={createInvoiceStyles.input}
                />
              </div>
              <div>
                <label className={createInvoiceStyles.label}>Email</label>
                <input
                  value={invoice?.fromEmail ?? ""}
                  onChange={(e) =>
                    updateInvoiceField("fromEmail", e.target.value)
                  }
                  placeholder="business@email.com"
                  className={createInvoiceStyles.input}
                />
              </div>
              <div className={createInvoiceStyles.gridColSpan2}>
                <label className={createInvoiceStyles.label}>Address</label>
                <textarea
                  value={invoice?.fromAddress ?? ""}
                  onChange={(e) =>
                    updateInvoiceField("fromAddress", e.target.value)
                  }
                  placeholder="Business Address"
                  rows={3}
                  className={createInvoiceStyles.textarea}
                />
              </div>
              <div>
                <label className={createInvoiceStyles.label}>Phone</label>
                <input
                  value={invoice?.fromPhone ?? ""}
                  onChange={(e) =>
                    updateInvoiceField("fromPhone", e.target.value)
                  }
                  placeholder="+1 (555) 123-4567"
                  className={createInvoiceStyles.input}
                />
              </div>
              <div>
                <label className={createInvoiceStyles.label}>
                  Tax ID (EIN/VAT)
                </label>
                <input
                  value={invoice?.fromTaxId ?? invoice?.fromGst ?? ""}
                  onChange={(e) =>
                    updateInvoiceField("fromTaxId", e.target.value)
                  }
                  placeholder="12-3456789 (US EIN) or GB123456789 (EU VAT)"
                  className={createInvoiceStyles.input}
                />
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div className={createInvoiceStyles.cardContainer}>
            <div className={createInvoiceStyles.cardHeaderContainer}>
              <div
                className={`${createInvoiceStyles.cardIconContainer} ${createInvoiceIconColors.billTo}`}
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h3 className={createInvoiceStyles.cardTitle}>Bill To</h3>
            </div>

            <div className={createInvoiceStyles.gridCols2}>
              <div>
                <label className={createInvoiceStyles.label}>Client Name</label>
                <input
                  value={invoice?.client?.name || ""}
                  onChange={(e) => updateClient("name", e.target.value)}
                  placeholder="Client Name"
                  className={createInvoiceStyles.input}
                />
              </div>
              <div>
                <label className={createInvoiceStyles.label}>
                  Client Email
                </label>
                <input
                  value={invoice?.client?.email || ""}
                  onChange={(e) => updateClient("email", e.target.value)}
                  placeholder="client@email.com"
                  className={createInvoiceStyles.input}
                />
              </div>
              <div className={createInvoiceStyles.gridColSpan2}>
                <label className={createInvoiceStyles.label}>
                  Client Address
                </label>
                <textarea
                  value={invoice?.client?.address || ""}
                  onChange={(e) => updateClient("address", e.target.value)}
                  placeholder="Client Address"
                  rows={3}
                  className={createInvoiceStyles.textarea}
                />
              </div>
              <div>
                <label className={createInvoiceStyles.label}>
                  Client Phone
                </label>
                <input
                  value={invoice?.client?.phone || ""}
                  onChange={(e) => updateClient("phone", e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className={createInvoiceStyles.input}
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className={createInvoiceStyles.cardContainer}>
            <div className={createInvoiceStyles.cardHeaderWithButton}>
              <div className={createInvoiceStyles.cardHeaderLeft}>
                <div className={createInvoiceStyles.cardIconContainer}>
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                  </svg>
                </div>
                <h3 className={createInvoiceStyles.cardTitle}>
                  Items & Services
                </h3>
              </div>
              <div className={createInvoiceStyles.currencyBadge}>
                All amounts in {invoice.currency}
              </div>
            </div>

            {/* Items list */}
            <div className={createInvoiceStyles.itemsListWrapper}>
              {items.map((it, idx) => {
                const totalValue =
                  Number(it?.qty || 0) * Number(it?.unitPrice || 0);
                const totalLabel = currencyFmt(totalValue, invoice.currency);

                return (
                  <div
                    key={it?.id ?? idx}
                    className={`${createInvoiceStyles.itemsTableRow} ${createInvoiceStyles.itemRow}`}
                  >
                    {/* item name */}
                    <div className={createInvoiceStyles.itemColDescription}>
                      <label
                        className={createInvoiceStyles.itemsFieldLabel}
                        htmlFor={`desc-${idx}`}
                      >
                        Item Name
                      </label>
                      <input
                        id={`desc-${idx}`}
                        className={createInvoiceStyles.itemsInput}
                        value={it?.description ?? ""}
                        onChange={(e) =>
                          updateItem(idx, "description", e.target.value)
                        }
                        placeholder="Item name"
                        title={it?.description ?? ""}
                        aria-label={`Item ${idx + 1} name`}
                      />
                    </div>

                    {/* Quantity */}
                    <div className={createInvoiceStyles.itemColQuantity}>
                      <label
                        className={createInvoiceStyles.itemsFieldLabel}
                        htmlFor={`qty-${idx}`}
                      >
                        Quantity
                      </label>

                      <input
                        id={`qty-${idx}`}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="1"
                        className={createInvoiceStyles.itemsNumberInput}
                        value={it?.qty ?? ""}
                        onChange={(e) => updateItem(idx, "qty", e.target.value)}
                        placeholder="Quantity"
                        aria-label={`Item ${idx + 1} quantity`}
                      />
                    </div>

                    {/* Unit Price */}
                    <div className={createInvoiceStyles.itemColUnitPrice}>
                      <label
                        className={createInvoiceStyles.itemsFieldLabel}
                        htmlFor={`price-${idx}`}
                      >
                        Unit Price
                      </label>

                      <input
                        id={`price-${idx}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        className={createInvoiceStyles.itemsNumberInput}
                        value={it?.unitPrice ?? ""}
                        onChange={(e) =>
                          updateItem(idx, "unitPrice", e.target.value)
                        }
                        placeholder="Unit Price"
                        aria-label={`Item ${idx + 1} unit price`}
                      />
                    </div>

                    {/* Total */}
                    <div className={createInvoiceStyles.itemColTotal}>
                      <label
                        className={createInvoiceStyles.itemsFieldLabel}
                        aria-hidden
                      >
                        Total
                      </label>
                      <div
                        className={createInvoiceStyles.itemsTotal}
                        title={totalLabel}
                        aria-label={`Item ${idx + 1} total`}
                      >
                        {totalLabel}
                      </div>
                    </div>

                    {/* Remove */}
                    <div className={createInvoiceStyles.itemColRemove}>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className={createInvoiceStyles.itemsRemoveButton}
                        aria-label={`Remove item ${idx + 1}`}
                        title="Remove item"
                      >
                        <DeleteIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={addItem}
                className={createInvoiceStyles.addItemButton}
              >
                <AddIcon
                  className={`w-4 h-4 ${createInvoiceStyles.iconHover}`}
                />{" "}
                Add Item
              </button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className={createInvoiceStyles.rightColumn}>
          {/* Logo & Branding */}
          <div className={createInvoiceStyles.cardSmallContainer}>
            <h3 className={createInvoiceStyles.cardSubtitle}>Branding</h3>

            <div className="space-y-4">
              <div>
                <label className={createInvoiceStyles.label}>
                  Company Logo
                </label>
                <div className={createInvoiceStyles.uploadSmallArea}>
                  {invoice?.logoDataUrl ? (
                    <div className={createInvoiceStyles.imagePreviewContainer}>
                      <div className={createInvoiceStyles.logoPreview}>
                        <img
                          src={invoice.logoDataUrl}
                          alt="logo"
                          className="object-contain w-full h-full"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            console.warn(
                              "[CreateInvoice] failed to load logo preview:",
                              invoice.logoDataUrl,
                            );
                          }}
                        />
                      </div>
                      <div className={createInvoiceStyles.buttonGroup}>
                        <label className={createInvoiceStyles.changeButton}>
                          <UploadIcon className="w-4 h-4" /> Change
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              handleImageUpload(
                                e.target.files && e.target.files[0],
                                "logo",
                              )
                            }
                            className="hidden"
                          />
                        </label>
                        <button
                          onClick={() => removeImage("logo")}
                          className={createInvoiceStyles.removeButton}
                        >
                          <DeleteIcon className="w-4 h-4" /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <div
                        className={`${createInvoiceStyles.imagePreviewContainer} ${createInvoiceStyles.hoverScale}`}
                      >
                        <div
                          className={createInvoiceStyles.uploadIconContainer}
                        >
                          <UploadIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={createInvoiceStyles.uploadTextTitle}>
                            Upload Logo
                          </p>
                          <p className={createInvoiceStyles.uploadTextSubtitle}>
                            PNG, JPG up to 5MB
                          </p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleImageUpload(
                              e.target.files && e.target.files[0],
                              "logo",
                            )
                          }
                          className="hidden"
                        />
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Summary & Tax */}
          <div className={createInvoiceStyles.cardSmallContainer}>
            <h3 className={createInvoiceStyles.cardSubtitle}>Summary & Tax</h3>
            <div className="space-y-4">
              <div className={createInvoiceStyles.summaryRow}>
                <div className={createInvoiceStyles.summaryLabel}>Subtotal</div>
                <div className={createInvoiceStyles.summaryValue}>
                  {currencyFmt(totals.subtotal, invoice.currency)}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className={createInvoiceStyles.label}>
                    Tax Percentage
                  </label>
                  <input
                    type="number"
                    value={invoice.taxPercent ?? 0}
                    onChange={(e) =>
                      updateInvoiceField(
                        "taxPercent",
                        Number(e.target.value || 0),
                      )
                    }
                    className={createInvoiceStyles.inputCenter}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>

                <div className={createInvoiceStyles.taxRow}>
                  <div className="text-sm text-gray-600">Tax Amount</div>
                  <div className="font-medium text-gray-900">
                    {currencyFmt(totals.tax, invoice.currency)}
                  </div>
                </div>
              </div>

              <div className={createInvoiceStyles.totalRow}>
                <div className={createInvoiceStyles.totalLabel}>Total</div>
                <div className={createInvoiceStyles.totalValue}>
                  {currencyFmt(totals.total, invoice.currency)}
                </div>
              </div>

              <div>
                <label className={createInvoiceStyles.label}>Notes</label>
                <textarea
                  rows={3}
                  value={invoice?.notes ?? ""}
                  onChange={(e) => updateInvoiceField("notes", e.target.value)}
                  placeholder="Payment terms or additional notes..."
                  className={createInvoiceStyles.textarea}
                />
              </div>
            </div>
          </div>

          {/* Stamp & Signature */}
          <div className={createInvoiceStyles.cardSmallContainer}>
            <h3 className={createInvoiceStyles.cardSubtitle}>
              Stamp & Signature
            </h3>

            <div className="space-y-6">
              {/* Stamp */}
              <div>
                <label className={createInvoiceStyles.label}>
                  Digital Stamp
                </label>
                <div className={createInvoiceStyles.uploadSmallArea}>
                  {invoice.stampDataUrl ? (
                    <div className={createInvoiceStyles.imagePreviewContainer}>
                      <div className={createInvoiceStyles.stampPreview}>
                        <img
                          src={invoice.stampDataUrl}
                          alt="stamp"
                          className="object-contain w-full h-full"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            console.warn(
                              "[CreateInvoice] failed to load stamp preview:",
                              invoice.stampDataUrl,
                            );
                          }}
                        />
                      </div>
                      <div className={createInvoiceStyles.buttonGroup}>
                        <label className={createInvoiceStyles.changeButton}>
                          <UploadIcon className="w-4 h-4" /> Change
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              handleImageUpload(
                                e.target.files && e.target.files[0],
                                "stamp",
                              )
                            }
                            className="hidden"
                          />
                        </label>
                        <button
                          onClick={() => removeImage("stamp")}
                          className={createInvoiceStyles.removeButton}
                        >
                          <DeleteIcon className="w-4 h-4" /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <div
                        className={`${createInvoiceStyles.imagePreviewContainer} ${createInvoiceStyles.hoverScale}`}
                      >
                        <div
                          className={
                            createInvoiceStyles.uploadSmallIconContainer
                          }
                        >
                          <UploadIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className={createInvoiceStyles.uploadTextTitle}>
                            Upload Stamp
                          </p>
                          <p className={createInvoiceStyles.uploadTextSubtitle}>
                            PNG with transparency
                          </p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleImageUpload(
                              e.target.files && e.target.files[0],
                              "stamp",
                            )
                          }
                          className="hidden"
                        />
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Signature */}
              <div>
                <label className={createInvoiceStyles.label}>
                  Digital Signature
                </label>
                <div className={createInvoiceStyles.uploadSmallArea}>
                  {invoice.signatureDataUrl ? (
                    <div className={createInvoiceStyles.imagePreviewContainer}>
                      <div className={createInvoiceStyles.signaturePreview}>
                        <img
                          src={invoice.signatureDataUrl}
                          alt="signature"
                          className="object-contain w-full h-full"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            console.warn(
                              "[CreateInvoice] failed to load signature preview:",
                              invoice.signatureDataUrl,
                            );
                          }}
                        />
                      </div>
                      <div className={createInvoiceStyles.buttonGroup}>
                        <label className={createInvoiceStyles.changeButton}>
                          <UploadIcon className="w-4 h-4" /> Change
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              handleImageUpload(
                                e.target.files && e.target.files[0],
                                "signature",
                              )
                            }
                            className="hidden"
                          />
                        </label>
                        <button
                          onClick={() => removeImage("signature")}
                          className={createInvoiceStyles.removeButton}
                        >
                          <DeleteIcon className="w-4 h-4" /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <div
                        className={`${createInvoiceStyles.imagePreviewContainer} ${createInvoiceStyles.hoverScale}`}
                      >
                        <div
                          className={
                            createInvoiceStyles.uploadSmallIconContainer
                          }
                        >
                          <UploadIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className={createInvoiceStyles.uploadTextTitle}>
                            Upload Signature
                          </p>
                          <p className={createInvoiceStyles.uploadTextSubtitle}>
                            PNG with transparency
                          </p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleImageUpload(
                              e.target.files && e.target.files[0],
                              "signature",
                            )
                          }
                          className="hidden"
                        />
                      </div>
                    </label>
                  )}
                </div>

                {/* Signature Details */}
                <div className="mt-4 space-y-3">
                  <div>
                    <label className={createInvoiceStyles.label}>
                      Signature Owner Name
                    </label>
                    <input
                      placeholder="John Doe"
                      value={invoice.signatureName || ""}
                      onChange={(e) =>
                        updateInvoiceField("signatureName", e.target.value)
                      }
                      className={`${createInvoiceStyles.inputSmall} ${createInvoiceCustomStyles.inputPlaceholder}`}
                    />
                  </div>
                  <div>
                    <label className={createInvoiceStyles.label}>
                      Signature Title / Designation
                    </label>
                    <input
                      placeholder="Director / CEO"
                      value={invoice.signatureTitle || ""}
                      onChange={(e) =>
                        updateInvoiceField("signatureTitle", e.target.value)
                      }
                      className={`${createInvoiceStyles.inputSmall} ${createInvoiceCustomStyles.inputPlaceholder}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>{" "}
      {/* end main grid */}

      {/* Invoice Creation Options */}
      <div className={createInvoiceStyles.cardContainer}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className={createInvoiceStyles.cardTitle}>
              Choose Invoice Creation Option
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Use the standard predefined invoice template directly, or let
              Gemini AI create a unique invoice design and payment notes while
              keeping your item names and prices unchanged.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCreateDefaultInvoice}
              disabled={loading || aiEnhancing}
              className={createInvoiceStyles.saveButton}
            >
              <SaveIcon className="w-4 h-4" />
              {loading && !aiEnhancing ? "Creating..." : "Default Invoice"}
            </button>

            <button
              type="button"
              onClick={handleEnhanceAndCreateWithAI}
              disabled={loading || aiEnhancing}
              className={invoicesStyles.aiButton}
            >
              <GeminiIcon className="w-5 h-5 flex-none" />
              {aiEnhancing ? "Generating with AI..." : "Generate with AI"}
            </button>
          </div>
        </div>

        {aiEnhanceError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {aiEnhanceError}
          </div>
        )}
      </div>

      <AiInvoiceModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onGenerate={handleGenerateWithAI}
        initialText=""
        initialUserData={invoice}
      />
    </div>
  );
}
