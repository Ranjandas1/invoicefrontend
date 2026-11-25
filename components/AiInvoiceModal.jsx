"use client";

import React, { useState } from "react";
import { aiInvoiceModalStyles } from "@/assets/dummyStyles";
import GeminiIcon from "./GeminiIcon";
import AnimatedButton from "@/assets/GenerateBtn/Gbtn";

function buildInitialFields(initialUserData) {
  const src = initialUserData && typeof initialUserData === "object" ? initialUserData : {};
  const client = src.client && typeof src.client === "object" ? src.client : {};
  return {
    clientName: client.name || "",
    clientEmail: client.email || "",
    clientPhone: client.phone || "",
    clientAddress: client.address || "",
    currency: src.currency || "USD",
    taxPercent:
      src.taxPercent !== undefined && src.taxPercent !== null
        ? String(src.taxPercent)
        : "",
    dueDate: src.dueDate || "",
    notes: src.notes || "",
  };
}

function hasFormContext(initialUserData) {
  if (!initialUserData || typeof initialUserData !== "object") return false;
  const items = Array.isArray(initialUserData.items)
    ? initialUserData.items.filter(
        (it) => it && typeof it.description === "string" && it.description.trim()
      )
    : [];
  const client = initialUserData.client || {};
  return Boolean(
    initialUserData.fromBusinessName ||
      client.name ||
      client.email ||
      items.length > 0 ||
      initialUserData.notes
  );
}

const AiInvoiceModalContent = ({
  onClose,
  onGenerate,
  initialText = "",
  initialUserData = null,
}) => {
  const [text, setText] = useState(initialText || "");
  const [fields, setFields] = useState(() => buildInitialFields(initialUserData));
  const [showFields, setShowFields] = useState(() =>
    Boolean(initialUserData)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(key, value) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerateClick() {
    setError("");
    const row = (text || "").trim();

    const base =
      initialUserData && typeof initialUserData === "object"
        ? initialUserData
        : {};
    const validFormItems = Array.isArray(base.items)
      ? base.items.filter(
          (it) =>
            it &&
            ((typeof it.description === "string" && it.description.trim()) ||
              Number(it.unitPrice) > 0)
        )
      : [];

    const userDataPayload = {
      ...base,
      dueDate: fields.dueDate.trim(),
      currency: fields.currency || "USD",
      taxPercent:
        fields.taxPercent !== "" ? Number(fields.taxPercent) : base.taxPercent,
      notes: fields.notes.trim(),
      client: {
        ...(base.client && typeof base.client === "object" ? base.client : {}),
        name: fields.clientName.trim(),
        email: fields.clientEmail.trim(),
        phone: fields.clientPhone.trim(),
        address: fields.clientAddress.trim(),
      },
      items: validFormItems,
    };

    const hasUserFields = Boolean(
      userDataPayload.client.name ||
        userDataPayload.client.email ||
        userDataPayload.client.phone ||
        userDataPayload.client.address ||
        userDataPayload.dueDate ||
        userDataPayload.notes ||
        userDataPayload.fromBusinessName ||
        validFormItems.length > 0
    );

    if (!row && !hasUserFields) {
      setError(
        "Please paste invoice text or fill in user field data to generate with AI"
      );
      return;
    }

    try {
      setLoading(true);

      const maybePromise = onGenerate && onGenerate(row, userDataPayload);

      if (maybePromise && typeof maybePromise.then === "function") {
        await maybePromise;
      }
    } catch (err) {
      console.error("onGenerate handler failed:", err);
      const msg =
        err &&
        (err.message ||
          (typeof err === "string" ? err : JSON.stringify(err)));

      setError(msg || "Failed to generate. Try again");
    } finally {
      setLoading(false);
    }
  }

  const formContextAttached = hasFormContext(initialUserData);

  return (
    <div className={aiInvoiceModalStyles.overlay}>
      <div
        className={aiInvoiceModalStyles.backdrop}
        onClick={() => onClose && onClose()}
      ></div>

      <div
        className={`${aiInvoiceModalStyles.modal} max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className={aiInvoiceModalStyles.title}>
              <GeminiIcon className="w-6 h-6 group-hover:scale-110 transition-transform flex-none" />
              Create Invoice with AI
            </h3>
            <p className={aiInvoiceModalStyles.description}>
              Paste invoice text, fill in user field data below, or combine both
              to generate a structured invoice with AI.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onClose && onClose()}
            className={aiInvoiceModalStyles.closeButton}
          >
            ✕
          </button>
        </div>

        {formContextAttached && (
          <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
            Your current form field data (business info, client, items, and
            settings) is attached and will be used by AI.
          </div>
        )}

        <div className="mt-4">
          <label className={aiInvoiceModalStyles.label}>
            Invoice text / AI instructions {formContextAttached ? "(optional)" : ""}
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`eg. A person wants a logo design for her organic brand "GreenVibe."
Quoted for $120 for 2 logo options and final delivery in PNG and vector format`}
            rows={5}
            className={aiInvoiceModalStyles.textarea}
          ></textarea>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setShowFields((s) => !s)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            {showFields
              ? "▾ Hide User Field Data"
              : "▸ Add / Edit User Field Data (Client, Currency, Tax, Due Date, Notes)"}
          </button>

          {showFields && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div>
                <label className={aiInvoiceModalStyles.label}>Client Name</label>
                <input
                  type="text"
                  value={fields.clientName}
                  onChange={(e) => updateField("clientName", e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
                />
              </div>
              <div>
                <label className={aiInvoiceModalStyles.label}>
                  Client Email
                </label>
                <input
                  type="email"
                  value={fields.clientEmail}
                  onChange={(e) => updateField("clientEmail", e.target.value)}
                  placeholder="billing@acme.com"
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
                />
              </div>
              <div>
                <label className={aiInvoiceModalStyles.label}>
                  Client Phone
                </label>
                <input
                  type="text"
                  value={fields.clientPhone}
                  onChange={(e) => updateField("clientPhone", e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
                />
              </div>
              <div>
                <label className={aiInvoiceModalStyles.label}>
                  Client Address
                </label>
                <input
                  type="text"
                  value={fields.clientAddress}
                  onChange={(e) => updateField("clientAddress", e.target.value)}
                  placeholder="123 Market St, San Francisco, CA"
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
                />
              </div>
              <div>
                <label className={aiInvoiceModalStyles.label}>Currency</label>
                <select
                  value={fields.currency}
                  onChange={(e) => updateField("currency", e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
              <div>
                <label className={aiInvoiceModalStyles.label}>Tax (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={fields.taxPercent}
                  onChange={(e) => updateField("taxPercent", e.target.value)}
                  placeholder="0"
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
                />
              </div>
              <div>
                <label className={aiInvoiceModalStyles.label}>Due Date</label>
                <input
                  type="date"
                  value={fields.dueDate}
                  onChange={(e) => updateField("dueDate", e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
                />
              </div>
              <div>
                <label className={aiInvoiceModalStyles.label}>Notes</label>
                <input
                  type="text"
                  value={fields.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Net 15 payment terms"
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className={aiInvoiceModalStyles.error} role="alert">
            {String(error)
              .split("\n")
              .map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            {(/quota|exhausted|resource_exhausted/i.test(String(error)) && (
              <div style={{ marginTop: 8, fontSize: 13, color: "#374151" }}>
                Tip: AI is temporarily unavailable (quota). Try again in a few
                minutes, or create the invoice manually.
              </div>
            )) || null}
          </div>
        )}

        <div className={aiInvoiceModalStyles.actions}>
          <AnimatedButton
            onClick={handleGenerateClick}
            isLoading={loading}
            disabled={loading}
            label="Generate"
          />
        </div>
      </div>
    </div>
  );
};

const AiInvoiceModal = ({
  open,
  onClose,
  onGenerate,
  initialText = "",
  initialUserData = null,
}) => {
  if (!open) return null;
  return (
    <AiInvoiceModalContent
      key={`${initialText}-${Boolean(initialUserData)}`}
      onClose={onClose}
      onGenerate={onGenerate}
      initialText={initialText}
      initialUserData={initialUserData}
    />
  );
};

export default AiInvoiceModal;
