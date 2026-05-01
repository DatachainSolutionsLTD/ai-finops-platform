// =============================================================================
// FinOps Platform Design System v1.1
// ApexCharts Shared Defaults — import in every chart component
// =============================================================================
//
// Colors pulled from ColorPalette.xlsx via finops_tokens.scss CSS variables.
// The chart palette uses 8 palette base swatches for multi-series charts.
// Status-aligned colors map RAG semantics to closest palette equivalents.
// =============================================================================

// ── Brand + Semantic color references (via CSS variables) ───────────────────
// These resolve at render time against the active theme so charts update
// automatically if the theme is ever re-themed at runtime.
export const CHART_COLORS = {
  primary:   'var(--ion-color-primary)',     // #3E6264 Dark Teal
  secondary: 'var(--ion-color-secondary)',   // #423EAF Royal Purple
  tertiary:  'var(--ion-color-tertiary)',    // #45462C Dark Olive
  success:   'var(--ion-color-success)',     // #3E6340 Forest Green
  warning:   'var(--ion-color-warning)',     // #C78E49 Burnt Ochre
  danger:    'var(--ion-color-danger)',      // #95443E Brick Red
  info:      'var(--finops-info)',           // #30455D Slate Navy
  medium:    'var(--ion-color-medium)',      // #595959 Text Tertiary
} as const;

// ── Categorical palette for multi-series charts ─────────────────────────────
// Hardcoded hex here because ApexCharts' `colors` array is evaluated at
// component init — CSS variables don't resolve in that context reliably.
// Rotate through these 8 palette base swatches in order.
export const CHART_PALETTE = [
  '#3E6264',  // 1. Accent 3 — Dark Teal (primary)
  '#423EAF',  // 2. Accent 4 — Royal Purple (secondary)
  '#95443E',  // 3. Accent 6 — Brick Red
  '#3E6340',  // 4. Accent 5 — Forest Green
  '#45462C',  // 5. Accent 1 — Dark Olive
  '#30455D',  // 6. Accent 2 — Slate Navy
  '#C78E49',  // 7. T/B-2 Dark 25% darker — Burnt Ochre
  '#DCB98F',  // 8. T/B-2 Dark base — Warm Tan
];

// ── Status-aligned colors (anomaly severity, health, posture) ───────────────
// When color MUST carry status meaning. Do not use CHART_PALETTE for these —
// viewers expect green=good, red=bad.
export const SEVERITY_COLORS = {
  Critical:      '#95443E',  // Accent 6 — Brick Red
  Warning:       '#C78E49',  // T/B-2 Dark 25% darker — Burnt Ochre
  Informational: '#30455D',  // Accent 2 — Slate Navy
  Healthy:       '#3E6340',  // Accent 5 — Forest Green
} as const;

// ── Tint variants for chart fills (area charts, stacked bars) ───────────────
// Paired with CHART_PALETTE at matching indices. Used for gradient fills
// and softer secondary-series rendering.
export const CHART_PALETTE_SUBTLE = [
  '#D3E3E4',  // Accent 3 lightest
  '#D8D7F0',  // Accent 4 lightest
  '#EDD6D3',  // Accent 6 lightest
  '#D8E8D9',  // Accent 5 lightest
  '#DFE0CD',  // Accent 1 lightest
  '#CED9E6',  // Accent 2 lightest
  '#F8F1E9',  // T/B-2 Dark 80% lighter
  '#F1E3D1',  // T/B-2 Dark 60% lighter
];

// ── Base chart options — spread into every chart config ─────────────────────
export const baseChartOptions = {
  chart: {
    fontFamily: "'IBM Plex Sans Condensed', 'IBM Plex Sans', 'Arial Narrow', sans-serif",
    toolbar: { show: false },
    background: 'transparent',
    foreColor: 'var(--finops-text-secondary)',
  },
  theme: { mode: 'light' as const },
  grid: {
    borderColor: 'var(--finops-border-default)',
    strokeDashArray: 3,
  },
  tooltip: {
    theme: 'light',
    style: {
      fontFamily: "'IBM Plex Sans Condensed', sans-serif",
      fontSize: '13px',
    },
  },
  dataLabels: { enabled: false },
  legend: {
    fontFamily: "'IBM Plex Sans Condensed', sans-serif",
    fontSize: '13px',
    labels: { colors: 'var(--finops-text-secondary)' },
    markers: { size: 6 },
  },
  xaxis: {
    labels: {
      style: {
        fontFamily: "'IBM Plex Sans Condensed', sans-serif",
        fontSize: '12px',
        colors: 'var(--finops-text-tertiary)',
      },
    },
    axisBorder: { color: 'var(--finops-border-default)' },
    axisTicks: { color: 'var(--finops-border-default)' },
  },
  yaxis: {
    labels: {
      style: {
        fontFamily: "'IBM Plex Sans Condensed', sans-serif",
        fontSize: '12px',
        colors: 'var(--finops-text-tertiary)',
      },
    },
  },
};

// ── Currency formatting ─────────────────────────────────────────────────────
// Currency is ALWAYS data-driven — fetched from the tenant's primary currency
// via platform_config + ref_currency join. Never hardcode a currency symbol.
// The formatter accepts the currency code as a parameter.

export interface CurrencyFormatOptions {
  code: string;          // ISO 4217 code: AED, USD, EUR, GBP, etc.
  locale?: string;       // BCP 47 locale: 'en-AE', 'en-US', etc. (default 'en-US')
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
}

/**
 * Format a monetary value with an explicit currency code.
 * Currency is never hardcoded — always passed in from tenant config.
 *
 * @example
 *   formatCurrency(12345.67, { code: 'AED' })  → "AED 12,346"
 *   formatCurrency(12345.67, { code: 'USD', locale: 'en-US', minimumFractionDigits: 2 })
 *                                              → "$12,345.67"
 */
export const formatCurrency = (
  value: number = 0,
  opts: CurrencyFormatOptions = { code: 'USD' },
): string => {
  const locale = opts.locale ?? 'en-US';
  const maximumFractionDigits = opts.maximumFractionDigits ?? 0;
  const minimumFractionDigits = opts.minimumFractionDigits ?? 0;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: opts.code,
    maximumFractionDigits,
    minimumFractionDigits,
    currencyDisplay: 'code',
  }).format(value);
};

/**
 * Format a value without any currency symbol — for cases where the currency
 * label is shown separately (e.g., in a chart axis title or table header).
 */
export const formatAmount = (
  value: number,
  maximumFractionDigits = 0,
): string =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);

/**
 * Format a percentage. Accepts the raw decimal (0.125 → "12.5%") OR a
 * pre-multiplied value (12.5 → "12.5%") — pass alreadyPercent=true for
 * the second case.
 */
export const formatPercent = (
  value: number,
  fractionDigits = 1,
  alreadyPercent = false,
): string => {
  const pct = alreadyPercent ? value : value * 100;
  return `${pct.toFixed(fractionDigits)}%`;
};
