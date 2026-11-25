"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  businessProfileStyles,
  iconColors,
  customStyles,
} from "@/assets/dummyStyles";
import { useAuth } from "@/context/AuthContext";
import {
  ImageIcon,
  SaveIcon,
  Trash2 as DeleteIcon,
  RotateCcw as ResetIcon,
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

const BusinessProfile = () => {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  const [meta, setMeta] = useState(DEFAULT_META);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    return () => {
      Object.values(previewsRef.current).forEach((src) => {
        if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
      });
    };
  }, []);

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

  useEffect(() => {
    let mounted = true;

    async function fetchProfile() {
      if (!isLoaded || !isSignedIn) return;

      const token = await getAuthToken();
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE}/api/businessProfile/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok || res.status === 204) return;

        const json = await res.json().catch(() => null);
        const data = json?.data;
        if (!data || !mounted) return;

        const serverMeta = {
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
        };

        setMeta(serverMeta);
        setPreviews({
          logo: serverMeta.logoUrl,
          stamp: serverMeta.stampUrl,
          signature: serverMeta.signatureUrl,
        });
      } catch (err) {
        console.error("fetchProfile error:", err);
      }
    }

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [getAuthToken, isLoaded, isSignedIn]);

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

  async function handleSave(e) {
    e?.preventDefault();
    if (saving) return;
    setSaving(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        alert("Login required");
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

      const url = meta.profileId
        ? `${API_BASE}/api/businessProfile/${meta.profileId}`
        : `${API_BASE}/api/businessProfile`;

      const method = meta.profileId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fd,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Save failed");
      }

      const json = await res.json().catch(() => null);
      const saved = json?.data;

      if (saved) {
        Object.values(previews).forEach((src) => {
          if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
        });

        const updatedMeta = {
          businessName: saved.businessName ?? meta.businessName,
          email: saved.email ?? meta.email,
          address: saved.address ?? meta.address,
          phone: saved.phone ?? meta.phone,
          taxId: saved.taxId ?? saved.gst ?? meta.taxId,
          logoUrl: resolveImageUrl(saved.logoUrl),
          stampUrl: resolveImageUrl(saved.stampUrl),
          signatureUrl: resolveImageUrl(saved.signatureUrl),
          signatureOwnerName:
            saved.signatureOwnerName ?? meta.signatureOwnerName,
          signatureOwnerTitle:
            saved.signatureOwnerTitle ?? meta.signatureOwnerTitle,
          defaultTaxPercent: saved.defaultTaxPercent ?? meta.defaultTaxPercent,
          notes: saved.notes ?? meta.notes,
          profileId: saved._id ?? meta.profileId,
        };

        setMeta(updatedMeta);
        setFiles({ logo: null, stamp: null, signature: null });
        setPreviews({
          logo: updatedMeta.logoUrl,
          stamp: updatedMeta.stampUrl,
          signature: updatedMeta.signatureUrl,
        });
      }

      alert("Saved successfully");
    } catch (err) {
      console.error("handleSave error:", err);
      alert(err?.message || "Error saving profile");
    } finally {
      setSaving(false);
    }
  }

  function handleClearProfile() {
    Object.values(previews).forEach((src) => {
      if (src?.startsWith("blob:")) {
        URL.revokeObjectURL(src);
      }
    });

    setMeta((prev) => ({ ...DEFAULT_META, profileId: prev.profileId }));
    setFiles({ logo: null, stamp: null, signature: null });
    setPreviews({ logo: null, stamp: null, signature: null });
  }

  return (
    <div className={businessProfileStyles.pageContainer}>
      <div className={businessProfileStyles.headerContainer}>
        <h1 className={businessProfileStyles.headerTitle}>Business Profile</h1>
        <p className={businessProfileStyles.headerSubtitle}>
          Configure your company details, branding assets and invoice defaults
        </p>

        {!isSignedIn && (
          <div
            style={{
              marginTop: 12,
              color: "#92400e",
              background: "#fff7ed",
              padding: 10,
              borderRadius: 8,
            }}
          >
            You are not signed in. Please sign in to load and save your business
            profile.
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className={businessProfileStyles.pageContainer}>
        <div className={businessProfileStyles.cardContainer}>
          <div className={businessProfileStyles.cardHeaderContainer}>
            <div
              className={`${businessProfileStyles.cardIconContainer} ${iconColors.business}`}
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v-4m0 4h4" />
              </svg>
            </div>
            <h2 className={businessProfileStyles.cardTitle}>
              Business Information
            </h2>
          </div>

          <div className={businessProfileStyles.gridCols2}>
            <div>
              <label className={businessProfileStyles.label}>Business Name</label>
              <input
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
              <label className={businessProfileStyles.gridColSpan2}>Address</label>
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
                placeholder="+17122235638"
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
                        <p className={businessProfileStyles.uploadTextSubtitle}>
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
                        <p className={businessProfileStyles.uploadTextSubtitle}>
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
                <SaveIcon className="w-4 h-4" />{" "}
                {saving ? "Saving..." : "Save Profile"}
              </button>

              <button
                type="button"
                onClick={handleClearProfile}
                className={businessProfileStyles.resetButton}
              >
                <ResetIcon className="w-4 h-4" /> Clear Profile
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default BusinessProfile;
