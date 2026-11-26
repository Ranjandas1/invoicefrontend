"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  businessProfileStyles,
  iconColors,
  customStyles,
} from "@/assets/dummyStyles";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import ConfirmModal from "@/components/ConfirmModal";
import { BusinessProfileSkeleton } from "@/components/BrandLoader";
import {
  ImageIcon,
  SaveIcon,
  Trash2 as DeleteIcon,
  RotateCcw as ResetIcon,
  Building2,
  Plus,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { API_BASE, resolveImageUrl } from "@/lib/invoiceUtils";

const DEFAULT_META = {
  businessName: "",
  email: "",
  address: "",
  phone: "",
  taxId: "", // EIN for US, VAT for Europe
  logoUrl: null,
  stampUrl: null,
  signatureUrl: null,
  signatureOwnerName: "",
  signatureOwnerTitle: "",
  defaultTaxPercent: 0, // US sales tax varies by state
  notes: "",
  profileId: null,
  isDefault: false,
};

const UploadIcon = ({ className = "w-5 h-5" }) => (
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

function mapServerProfileToMeta(data) {
  if (!data) return { ...DEFAULT_META };
  return {
    businessName: data.businessName ?? "",
    email: data.email ?? "",
    address: data.address ?? "",
    phone: data.phone ?? "",
    taxId: data.taxId ?? data.gst ?? "",
    logoUrl: resolveImageUrl(data.logoUrl),
    stampUrl: resolveImageUrl(data.stampUrl),
    signatureUrl: resolveImageUrl(data.signatureUrl),
    signatureOwnerName: data.signatureOwnerName ?? "",
    signatureOwnerTitle: data.signatureOwnerTitle ?? "",
    defaultTaxPercent: data.defaultTaxPercent ?? 0,
    notes: data.notes ?? "",
    profileId: data._id ?? null,
    isDefault: Boolean(data.isDefault),
  };
}

function syncActiveProfileCache(list) {
  try {
    const active = list.find((p) => p.isDefault) || list[0] || null;
    if (active) {
      localStorage.setItem("business_profile", JSON.stringify(active));
    } else {
      localStorage.removeItem("business_profile");
    }
    window.dispatchEvent(new Event("business-profile-updated"));
  } catch {
    // ignore storage errors
  }
}

const BusinessProfile = () => {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const toast = useToast();

  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [meta, setMeta] = useState(DEFAULT_META);
  const [saving, setSaving] = useState(false);
  const [switchingId, setSwitchingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [files, setFiles] = useState({
    logo: null,
    stamp: null,
    signature: null,
  });

  const [previews, setPreviews] = useState({
    logo: null,
    stamp: null,
    signature: null,
  });

  const previewsRef = useRef(previews);
  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  const revokeBlobPreviews = useCallback((currentPreviews) => {
    Object.values(currentPreviews || {}).forEach((src) => {
      if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
    });
  }, []);

  useEffect(() => {
    return () => {
      revokeBlobPreviews(previewsRef.current);
    };
  }, [revokeBlobPreviews]);

  const getAuthToken = useCallback(async () => {
    if (!isLoaded || !isSignedIn || typeof getToken !== "function") return null;

    try {
      let t = await getToken().catch(() => null);
      if (!t) t = await getToken({ forceRefresh: true }).catch(() => null);
      return t || null;
    } catch {
      return null;
    }
  }, [getToken, isLoaded, isSignedIn]);

  const applyProfileToForm = useCallback(
    (profileData) => {
      revokeBlobPreviews(previewsRef.current);
      const nextMeta = mapServerProfileToMeta(profileData);
      setMeta(nextMeta);
      setFiles({ logo: null, stamp: null, signature: null });
      setPreviews({
        logo: nextMeta.logoUrl,
        stamp: nextMeta.stampUrl,
        signature: nextMeta.signatureUrl,
      });
    },
    [revokeBlobPreviews]
  );

  const fetchProfiles = useCallback(
    async (preferredId = null) => {
      if (!isLoaded) return;
      if (!isSignedIn) {
        setProfiles([]);
        setLoadingProfiles(false);
        return;
      }

      const token = await getAuthToken();
      if (!token) {
        setLoadingProfiles(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/businessProfile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to load business profiles");
        }

        const json = await res.json().catch(() => null);
        const list = Array.isArray(json?.data) ? json.data : [];
        setProfiles(list);
        syncActiveProfileCache(list);

        if (list.length > 0) {
          const target =
            (preferredId && list.find((p) => p._id === preferredId)) ||
            list.find((p) => p.isDefault) ||
            list[0];
          applyProfileToForm(target);
        } else {
          applyProfileToForm(null);
        }
      } catch (err) {
        console.error("fetchProfiles error:", err);
        toast.error(err?.message || "Could not load business profiles.");
      } finally {
        setLoadingProfiles(false);
      }
    },
    [applyProfileToForm, getAuthToken, isLoaded, isSignedIn, toast]
  );

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (!cancelled) {
        fetchProfiles();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fetchProfiles]);

  function updateMeta(field, value) {
    setMeta((prev) => ({ ...prev, [field]: value }));
  }

  function handleLocalFilePick(kind, file) {
    if (!file) return;

    if (previews[kind]?.startsWith("blob:")) {
      URL.revokeObjectURL(previews[kind]);
    }

    const objUrl = URL.createObjectURL(file);

    setFiles((prev) => ({ ...prev, [kind]: file }));
    setPreviews((prev) => ({ ...prev, [kind]: objUrl }));

    updateMeta(
      kind === "logo" ? "logoUrl" : kind === "stamp" ? "stampUrl" : "signatureUrl",
      objUrl
    );
  }

  function removeLocalFile(kind) {
    if (previews[kind]?.startsWith("blob:")) {
      URL.revokeObjectURL(previews[kind]);
    }

    setFiles((prev) => ({ ...prev, [kind]: null }));
    setPreviews((prev) => ({ ...prev, [kind]: null }));

    updateMeta(
      kind === "logo" ? "logoUrl" : kind === "stamp" ? "stampUrl" : "signatureUrl",
      null
    );
  }

  function handleSelectProfile(profile) {
    applyProfileToForm(profile);
  }

  function handleNewProfile() {
    applyProfileToForm(null);
    toast.info("Enter details below to create a new business profile.");
  }

  async function handleSetActiveProfile(profileId) {
    if (!profileId || switchingId) return;
    setSwitchingId(profileId);

    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error("Sign in required to switch profiles.");
        return;
      }

      const res = await fetch(
        `${API_BASE}/api/businessProfile/${profileId}/active`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || "Failed to switch active profile");
      }

      await fetchProfiles(profileId);
      toast.success(
        `${json?.data?.businessName || "Profile"} is now your active business profile.`
      );
    } catch (err) {
      console.error("handleSetActiveProfile error:", err);
      toast.error(err?.message || "Failed to activate profile.");
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleConfirmDeleteProfile() {
    if (!deleteTarget?._id || deleting) return;
    setDeleting(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error("Sign in required to delete profiles.");
        return;
      }

      const res = await fetch(
        `${API_BASE}/api/businessProfile/${deleteTarget._id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || "Failed to delete profile");
      }

      const deletedName = deleteTarget.businessName || "Business profile";
      setDeleteTarget(null);
      await fetchProfiles();
      toast.success(`${deletedName} deleted.`);
    } catch (err) {
      console.error("handleConfirmDeleteProfile error:", err);
      toast.error(err?.message || "Failed to delete business profile.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave(e) {
    e?.preventDefault();
    if (saving) return;

    if (!String(meta.businessName || "").trim()) {
      toast.error("Business name is required.");
      return;
    }

    setSaving(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error("Please sign in to save your business profile.");
        return;
      }

      const fd = new FormData();
      const textFields = [
        "businessName",
        "email",
        "address",
        "phone",
        "taxId",
        "signatureOwnerName",
        "signatureOwnerTitle",
        "defaultTaxPercent",
        "notes",
      ];
      for (const key of textFields) {
        if (meta[key] !== null && meta[key] !== undefined) {
          fd.append(key, meta[key]);
        }
      }

      const assetMap = [
        { kind: "logo", urlKey: "logoUrl" },
        { kind: "stamp", urlKey: "stampUrl" },
        { kind: "signature", urlKey: "signatureUrl" },
      ];
      for (const { kind, urlKey } of assetMap) {
        if (files[kind]) {
          fd.append(kind, files[kind]);
        } else if (meta[urlKey] === null) {
          fd.append(urlKey, "");
        } else if (meta[urlKey] && !String(meta[urlKey]).startsWith("blob:")) {
          fd.append(urlKey, meta[urlKey]);
        }
      }

      const isUpdate = Boolean(meta.profileId);
      const url = isUpdate
        ? `${API_BASE}/api/businessProfile/${meta.profileId}`
        : `${API_BASE}/api/businessProfile`;

      const method = isUpdate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fd,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || "Save failed");
      }

      const saved = json?.data;
      await fetchProfiles(saved?._id || meta.profileId);
      toast.success(
        isUpdate
          ? "Business profile updated."
          : "Business profile created."
      );
    } catch (err) {
      console.error("handleSave error:", err);
      toast.error(err?.message || "Error saving profile.");
    } finally {
      setSaving(false);
    }
  }

  function handleClearProfile() {
    revokeBlobPreviews(previews);
    setMeta((prev) => ({
      ...DEFAULT_META,
      profileId: prev.profileId,
      isDefault: prev.isDefault,
    }));
    setFiles({ logo: null, stamp: null, signature: null });
    setPreviews({ logo: null, stamp: null, signature: null });
    toast.info("Form fields cleared. Save to apply changes.");
  }

  if (loadingProfiles) {
    return <BusinessProfileSkeleton />;
  }

  return (
    <div className={businessProfileStyles.pageContainer}>
      <div className={businessProfileStyles.headerContainer}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className={businessProfileStyles.headerTitle}>
              Business Profiles
            </h1>
            <p className={businessProfileStyles.headerSubtitle}>
              Manage multiple company profiles, switch your active profile, and
              customize branding assets
            </p>
          </div>

          <button
            type="button"
            onClick={handleNewProfile}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-sm hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Profile
          </button>
        </div>

        {!isSignedIn && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You are not signed in. Please sign in to load and save your
            business profiles.
          </div>
        )}
      </div>

      {/* Profile Switcher Section */}
      <div className={businessProfileStyles.cardContainer}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`${businessProfileStyles.cardIconContainer} ${iconColors.business}`}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className={businessProfileStyles.cardTitle}>
                Available Profiles ({profiles.length})
              </h2>
              <p className="text-xs text-slate-500">
                The active profile is automatically used as the default sender
                when creating invoices.
              </p>
            </div>
          </div>
        </div>

        {profiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
            <p className="text-sm font-medium text-slate-700">
              No business profiles saved yet
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Fill out the form below to create your first business profile.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((profile) => {
              const isSelected = meta.profileId === profile._id;
              const isActive = Boolean(profile.isDefault);
              const logoSrc = resolveImageUrl(profile.logoUrl);

              return (
                <div
                  key={profile._id}
                  onClick={() => handleSelectProfile(profile)}
                  className={`group relative rounded-xl border p-4 transition-all cursor-pointer ${
                    isSelected
                      ? "border-blue-500 bg-blue-50/40 ring-2 ring-blue-100"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg border border-slate-200 bg-white flex items-center justify-center shrink-0 overflow-hidden">
                      {logoSrc ? (
                        <img
                          src={logoSrc}
                          alt={profile.businessName}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <Building2 className="w-5 h-5 text-slate-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {profile.businessName}
                        </h3>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {profile.email || profile.phone || profile.taxId || "No contact info"}
                      </p>
                    </div>
                  </div>

                  <div
                    className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      {!isActive ? (
                        <button
                          type="button"
                          onClick={() => handleSetActiveProfile(profile._id)}
                          disabled={switchingId === profile._id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer"
                        >
                          {switchingId === profile._id && (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          )}
                          Set Active
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-emerald-700">
                          Default for invoices
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSelectProfile(profile)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        {isSelected ? "Editing" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(profile)}
                        className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                        title={`Delete ${profile.businessName}`}
                      >
                        <DeleteIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Profile Editor Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className={businessProfileStyles.cardContainer}>
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className={businessProfileStyles.cardHeaderContainer + " !mb-0"}>
              <div
                className={`${businessProfileStyles.cardIconContainer} ${iconColors.business}`}
              >
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className={businessProfileStyles.cardTitle}>
                  {meta.profileId
                    ? "Edit Business Information"
                    : "Create New Business Profile"}
                </h2>
              </div>
            </div>
            {meta.profileId && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Editing existing profile
              </span>
            )}
          </div>

          <div className={businessProfileStyles.gridCols2}>
            <div>
              <label className={businessProfileStyles.label}>
                Business Name *
              </label>
              <input
                required
                className={businessProfileStyles.input}
                value={meta.businessName}
                onChange={(e) => updateMeta("businessName", e.target.value)}
                placeholder="Enter your business name"
              />
            </div>

            <div>
              <label className={businessProfileStyles.label}>Email</label>
              <input
                className={businessProfileStyles.input}
                value={meta.email}
                onChange={(e) => updateMeta("email", e.target.value)}
                placeholder="business@example.com"
              />
            </div>

            <div>
              <label className={businessProfileStyles.gridColSpan2}>
                Address
              </label>
              <textarea
                rows={3}
                className={businessProfileStyles.textarea}
                value={meta.address}
                onChange={(e) => updateMeta("address", e.target.value)}
                placeholder="Enter your business address"
              />
            </div>

            <div>
              <label className={businessProfileStyles.label}>Phone</label>
              <input
                className={businessProfileStyles.input}
                value={meta.phone}
                onChange={(e) => updateMeta("phone", e.target.value)}
                placeholder="+1 555 010 2030"
              />
            </div>

            <div>
              <label className={businessProfileStyles.label}>
                Tax ID (EIN/VAT)
              </label>
              <input
                className={businessProfileStyles.input}
                value={meta.taxId}
                onChange={(e) => updateMeta("taxId", e.target.value)}
                placeholder="12-3456789 (US EIN) or GB123456789 (EU VAT)"
              />
            </div>
          </div>
        </div>

        <div className={businessProfileStyles.cardContainer}>
          <div className={businessProfileStyles.cardHeaderContainer}>
            <div
              className={`${businessProfileStyles.cardIconContainer} ${iconColors.branding}`}
            >
              <ImageIcon className="w-5 h-5" />
            </div>
            <h2 className={businessProfileStyles.cardTitle}>
              Branding & Default
            </h2>
          </div>

          <div className={businessProfileStyles.gridCols2Lg}>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Company Logo
                </h3>

                <div className={businessProfileStyles.uploadArea}>
                  {previews.logo ? (
                    <div className={businessProfileStyles.imagePreviewContainer}>
                      <div className={businessProfileStyles.logoPreview}>
                        <img
                          src={previews.logo}
                          alt="logo preview"
                          className="object-contain w-full h-full"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            console.warn(
                              "[BusinessProfile] logo preview failed to load:",
                              previews.logo
                            );
                          }}
                        />
                      </div>

                      <div className={businessProfileStyles.buttonGroup}>
                        <label className={businessProfileStyles.changeButton}>
                          <UploadIcon className="w-4 h-4" />
                          Change
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              handleLocalFilePick("logo", e.target.files?.[0])
                            }
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => removeLocalFile("logo")}
                          className={businessProfileStyles.removeButton}
                        >
                          <DeleteIcon className="w-4 h-4" /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <div
                        className={`${businessProfileStyles.imagePreviewContainer} ${businessProfileStyles.hoverScale}`}
                      >
                        <div
                          className={businessProfileStyles.uploadIconContainer}
                        >
                          <UploadIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <p className={businessProfileStyles.uploadTextTitle}>
                            Upload Logo
                          </p>
                          <p
                            className={businessProfileStyles.uploadTextSubtitle}
                          >
                            PNG, JPG up to 5MB
                          </p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleLocalFilePick("logo", e.target.files?.[0])
                          }
                          className="hidden"
                        />
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Tax Setting
                </h3>

                <div className={businessProfileStyles.taxContainer}>
                  <label className={businessProfileStyles.label}>
                    Default Tax Percentage
                  </label>

                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      className={businessProfileStyles.taxInput}
                      value={meta.defaultTaxPercent}
                      onChange={(e) =>
                        updateMeta(
                          "defaultTaxPercent",
                          Number(e.target.value || 0)
                        )
                      }
                    />
                    <span className={customStyles.taxPercentage}>%</span>
                  </div>

                  <p className={businessProfileStyles.taxHelpText}>
                    This tax rate will be prefixed in new invoices. You can
                    adjust it per invoice as needed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={businessProfileStyles.cardContainer}>
          <div className={businessProfileStyles.cardHeaderContainer}>
            <div
              className={`${businessProfileStyles.cardIconContainer} ${iconColors.assets}`}
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
              </svg>
            </div>
            <h2 className={businessProfileStyles.cardTitle}>Digital Assets</h2>
          </div>

          <div className={businessProfileStyles.gridCols2Lg}>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Digital Stamp
              </h3>

              <div className={businessProfileStyles.uploadArea}>
                {previews.stamp ? (
                  <div className={businessProfileStyles.imagePreviewContainer}>
                    <div className={businessProfileStyles.stampPreview}>
                      <img
                        src={previews.stamp}
                        alt="stamp preview"
                        className="object-contain w-full h-full"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          console.warn(
                            "[BusinessProfile] stamp preview failed to load:",
                            previews.stamp
                          );
                        }}
                      />
                    </div>

                    <div className={businessProfileStyles.buttonGroup}>
                      <label className={businessProfileStyles.changeButton}>
                        <UploadIcon className="w-4 h-4" /> Change
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleLocalFilePick("stamp", e.target.files?.[0])
                          }
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => removeLocalFile("stamp")}
                        className={businessProfileStyles.removeButton}
                      >
                        <DeleteIcon className="w-4 h-4" /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <div
                      className={`${businessProfileStyles.imagePreviewContainer} ${businessProfileStyles.hoverScale}`}
                    >
                      <div
                        className={
                          businessProfileStyles.uploadSmallIconContainer
                        }
                      >
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className={businessProfileStyles.uploadTextTitle}>
                          Upload Stamp
                        </p>
                        <p
                          className={businessProfileStyles.uploadTextSubtitle}
                        >
                          PNG with transparent background
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          handleLocalFilePick("stamp", e.target.files?.[0])
                        }
                        className="hidden"
                      />
                    </div>
                  </label>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Digital Signature
              </h3>

              <div className={businessProfileStyles.uploadArea}>
                {previews.signature ? (
                  <div className={businessProfileStyles.imagePreviewContainer}>
                    <div className={businessProfileStyles.signaturePreview}>
                      <img
                        src={previews.signature}
                        alt="signature preview"
                        className="object-contain w-full h-full"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          console.warn(
                            "[BusinessProfile] signature preview failed to load:",
                            previews.signature
                          );
                        }}
                      />
                    </div>

                    <div className={businessProfileStyles.buttonGroup}>
                      <label className={businessProfileStyles.changeButton}>
                        <UploadIcon className="w-4 h-4" /> Change
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleLocalFilePick(
                              "signature",
                              e.target.files?.[0]
                            )
                          }
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => removeLocalFile("signature")}
                        className={businessProfileStyles.removeButton}
                      >
                        <DeleteIcon className="w-4 h-4" /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <div
                      className={`${businessProfileStyles.imagePreviewContainer} ${businessProfileStyles.hoverScale}`}
                    >
                      <div
                        className={
                          businessProfileStyles.uploadSmallIconContainer
                        }
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
                      <div>
                        <p className={businessProfileStyles.uploadTextTitle}>
                          Upload Signature
                        </p>
                        <p
                          className={businessProfileStyles.uploadTextSubtitle}
                        >
                          PNG with transparent background
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          handleLocalFilePick("signature", e.target.files?.[0])
                        }
                        className="hidden"
                      />
                    </div>
                  </label>
                )}
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className={businessProfileStyles.label}>
                    Signature Owner Name
                  </label>
                  <input
                    placeholder="John Doe"
                    value={meta.signatureOwnerName}
                    onChange={(e) =>
                      updateMeta("signatureOwnerName", e.target.value)
                    }
                    className={`${businessProfileStyles.input} ${customStyles.inputPlaceholder}`}
                  />
                </div>

                <div>
                  <label className={businessProfileStyles.label}>
                    Signature Title / Designation
                  </label>
                  <input
                    placeholder="Director / CEO"
                    value={meta.signatureOwnerTitle}
                    onChange={(e) =>
                      updateMeta("signatureOwnerTitle", e.target.value)
                    }
                    className={`${businessProfileStyles.input} ${customStyles.inputPlaceholder}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={businessProfileStyles.actionContainer}>
          <div className={businessProfileStyles.actionInnerContainer}>
            <div className={businessProfileStyles.actionButtonGroup}>
              <button
                type="submit"
                disabled={saving}
                className={businessProfileStyles.saveButton}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <SaveIcon className="w-4 h-4" />
                )}
                {saving
                  ? "Saving..."
                  : meta.profileId
                  ? "Update Profile"
                  : "Create Profile"}
              </button>

              <button
                type="button"
                onClick={handleClearProfile}
                className={businessProfileStyles.resetButton}
              >
                <ResetIcon className="w-4 h-4" /> Clear Fields
              </button>
            </div>
          </div>
        </div>
      </form>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Business Profile"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.businessName}"? Existing invoices will keep their saved sender details, but this profile will no longer appear in your profile switcher.`
            : ""
        }
        confirmLabel="Delete Profile"
        cancelLabel="Cancel"
        loading={deleting}
        onConfirm={handleConfirmDeleteProfile}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
};

export default BusinessProfile;
