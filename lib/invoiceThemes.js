export const INVOICE_THEMES = {
  default: {
    id: "default",
    layout: "default",
    label: "Default Template",
    isAi: false,
  },
  "executive-indigo": {
    id: "executive-indigo",
    layout: "banner-strip",
    label: "Executive Indigo",
    isAi: true,
  },
  "emerald-modern": {
    id: "emerald-modern",
    layout: "sidebar-split",
    label: "Emerald Modern",
    isAi: true,
  },
  "royal-navy": {
    id: "royal-navy",
    layout: "centered-crest",
    label: "Royal Navy",
    isAi: true,
  },
  "amber-editorial": {
    id: "amber-editorial",
    layout: "editorial",
    label: "Amber Editorial",
    isAi: true,
  },
  "violet-studio": {
    id: "violet-studio",
    layout: "bento-cards",
    label: "Violet Studio",
    isAi: true,
  },
  "slate-minimal": {
    id: "slate-minimal",
    layout: "swiss-grid",
    label: "Slate Minimal",
    isAi: true,
  },
};

export function getInvoiceTheme(styleId) {
  if (typeof styleId === "string") {
    const key = styleId.trim().toLowerCase();
    if (INVOICE_THEMES[key]) return INVOICE_THEMES[key];
  }
  return INVOICE_THEMES.default;
}
