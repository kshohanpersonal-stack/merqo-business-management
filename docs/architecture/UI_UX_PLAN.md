# UI/UX Plan

## 1. Principles

Light theme only. Optimised for long shifts, small shop counters, 1366×768 laptops and
touch-free keyboard operation. Natural business Bangla; English accepted in every data
field. Every visible control performs a real action; no decorative widgets.

## 2. Design tokens

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#F5F7FA` | app canvas |
| `--surface` | `#FFFFFF` | cards, tables, dialogs |
| `--ink` | `#12233B` | primary text |
| `--muted` | `#64748B` | secondary text |
| `--brand` | `#0F766E` (teal) | primary actions, active nav |
| `--brand-soft` | `#E6F4F1` | selected rows/hovers |
| `--accent` | `#C2410C` (amber/terracotta) | attention/due |
| `--danger` | `#B91C1C` | destructive |
| `--success` | `#15803D` | success |
| `--border` | `#E2E8F0` | 1px dividers |
| `--radius` | 12px | cards; 8px controls |
| `--shadow` | `0 1px 2px rgba(15,23,42,.06), 0 8px 24px rgba(15,23,42,.05)` | cards/dialogs |

Typography: bundled Noto Sans Bengali + system Segoe UI; 14px base, 12px table meta,
20–28px headings, tabular numerals for money. Font sizes are never below 11px.

## 3. Shell

Left sidebar (240px, collapsible to 72px) with Bangla labels and Lucide icons; top bar
with business name, date, greeting, notification bell, user menu and licence badge;
content region with page title, breadcrumb-ish context, actions and scrollable body.
Minimum window 1280×720; sidebar collapses below 1360; dashboard grid uses 4 columns at
≥1600, 3 at ≥1280, 2 at smaller widths so 5-card groups never become an awkward 3+2.

## 4. Component inventory (all functional)

`Button`, `IconButton`, `TextField`, `NumberField`, `Select`, `DatePicker`, `Checkbox`,
`Modal`, `ConfirmDialog`, `DataTable` (server-side sort/filter/pagination), `Toolbar`,
`StatusBadge`, `Toast`, `EmptyState`, `ErrorState`, `Skeleton`, `ProgressBar`, `Card`,
`ChartCard`, `Tabs`, `Tooltip`, `ContextMenu`, `KeyboardHint`, `Money`, `BanglaDate`.

## 5. Screen list

Activation · Login · First-run setup wizard · Dashboard · POS · Sales history · Invoice
preview/reprint · Products · Categories/Brands · Units · Inventory/Stock movements ·
Purchases · Customers · Customer ledger · Suppliers · Supplier ledger · Expenses ·
Expense categories · Finance/Accounts · Returns/Adjustments · Reports (28 families) ·
Backup & Restore · Users/Roles · Notifications · Settings (tabbed) · About.

## 6. POS interaction model

Focus stays in the scanner/search field. Scanner input is distinguished from typing by
inter-key interval (< 40 ms) and Enter terminator. `F2` search, `F3` barcode focus,
`F4` customer, `F5` discount, `F6` hold, `F7` resume, `F8` payment, `F9` print,
`+/-` quantity, `Esc` close dialog — all configurable and conflict-checked in Settings.
Cart totals are computed by `sale.preview` (same core function as commit), so no UI-only
calculation can diverge from stored financial records.

## 7. Responsive and accessibility checklist (executed as tests)

Resize to 1280×720, 1366×768, 1600×900 and 1920×1080; verify no overlapping components,
cropped buttons/icons, hidden text, broken scrollbars or dialogs outside the viewport.
Full keyboard traversal, visible focus rings, labelled inputs, ARIA roles on dialogs and
tables, toast announcements via `aria-live`. Physical display QA on Windows remains an
explicit environment-dependent test.

## 8. Motion

120–200 ms ease-out transitions for page fade, sidebar collapse, modal scale/fade, button
press, card hover, dropdown and toast entrance. `prefers-reduced-motion` disables them.
POS cart updates use no animation to preserve speed.
