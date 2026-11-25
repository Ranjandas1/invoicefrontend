export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export function resolveImageUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (!s || s === "null" || s === "undefined") return null;

  if (s.startsWith("data:") || s.startsWith("blob:")) return s;

  if (/^https?:\/\//i.test(s)) {
    try {
      const parsed = new URL(s);
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        const path =
          parsed.pathname + (parsed.search || "") + (parsed.hash || "");
        return `${API_BASE.replace(/\/+$/, "")}${path}`;
      }
      return parsed.href;
    } catch {
      const path = s.replace(/^https?:\/\/[^/]+/, "");
      return `${API_BASE.replace(/\/+$/, "")}${path}`;
    }
  }

  return `${API_BASE.replace(/\/+$/, "")}/${s.replace(/^\/+/, "")}`;
}

export function normalizeClient(raw) {
  if (!raw) return { name: "", email: "", address: "", phone: "" };
  if (typeof raw === "string") {
    return { name: raw, email: "", address: "", phone: "" };
  }
  if (typeof raw === "object") {
    return {
      name: raw.name ?? raw.company ?? raw.client ?? "",
      email: raw.email ?? raw.emailAddress ?? "",
      address: raw.address ?? raw.addr ?? raw.clientAddress ?? "",
      phone: raw.phone ?? raw.contact ?? raw.mobile ?? "",
    };
  }
  return { name: "", email: "", address: "", phone: "" };
}

export function currencyFmt(amount = 0, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
}

export function formatDate(dateInput) {
  if (!dateInput) return "—";
  const d = dateInput instanceof Date ? dateInput : new Date(String(dateInput));
  if (Number.isNaN(d.getTime())) return "—";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export function computeTotals(items = [], taxPercent = 0) {
  const safe = Array.isArray(items) ? items.filter(Boolean) : [];
  const subtotal = safe.reduce(
    (sum, item) =>
      sum + Number(item.qty || 0) * Number(item.unitPrice || 0),
    0
  );
  const tax = (subtotal * Number(taxPercent || 0)) / 100;
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

export function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (error) {
    console.warn("Failed to write localStorage:", error);
  }
}

export async function generateInvoiceWithAI({
  token,
  prompt,
  userData = null,
  mode = "generate",
}) {
  if (!token) {
    throw new Error("Please sign in to generate an invoice with AI.");
  }

  const aiRes = await fetch(`${API_BASE}/api/ai/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt, userData, mode }),
  });

  const bodyText = await aiRes.text().catch(() => null);
  let bodyJson = null;
  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    bodyJson = null;
  }

  if (!aiRes.ok) {
    const serverMessage =
      (bodyJson &&
        [bodyJson.message, bodyJson.detail]
          .filter((part, idx, arr) => part && arr.indexOf(part) === idx)
          .join(" — ")) ||
      bodyText ||
      `AI generate failed (${aiRes.status})`;

    if (
      aiRes.status === 429 ||
      /quota|exhausted|resource_exhausted/i.test(serverMessage)
    ) {
      throw new Error(`AI provider quota/exhausted: ${serverMessage}`);
    }

    throw new Error(serverMessage);
  }

  const aiInvoice =
    bodyJson && typeof bodyJson.data === "object" && bodyJson.data !== null
      ? bodyJson.data
      : bodyJson;
  if (!aiInvoice || typeof aiInvoice !== "object") {
    throw new Error("AI returned no invoice data (unexpected response).");
  }

  return aiInvoice;
}

export async function createInvoiceWithAI({ token, prompt, userData = null }) {
  const aiInvoice = await generateInvoiceWithAI({ token, prompt, userData });

  const createRes = await fetch(`${API_BASE}/api/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...aiInvoice,
      applyBusinessDefaults: true,
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => null);
    let errJson = null;
    try {
      errJson = errText ? JSON.parse(errText) : null;
    } catch {
      /* ignore */
    }
    const errMsg =
      (errJson &&
        [errJson.message, errJson.detail]
          .filter((part, idx, arr) => part && arr.indexOf(part) === idx)
          .join(" — ")) ||
      errText ||
      `Create failed (${createRes.status})`;
    throw new Error(errMsg);
  }

  const createJson = await createRes.json().catch(() => null);
  const saved =
    createJson && typeof createJson.data === "object" && createJson.data !== null
      ? createJson.data
      : createJson;
  if (!saved || typeof saved !== "object" || (!saved._id && !saved.id && !saved.invoiceNumber)) {
    throw new Error("Invoice was not returned by server after creation.");
  }
  return saved;
}
