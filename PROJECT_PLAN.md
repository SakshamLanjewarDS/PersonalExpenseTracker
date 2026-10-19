# PocketPlan — Engineering & Implementation Plan

PocketPlan is a private, mobile-first personal finance planner built with Next.js App Router, React, TypeScript (strict), Tailwind CSS, Radix UI accessible primitives, Lucide React icons, TanStack Query, Recharts, Supabase PostgreSQL / Auth / Storage, Dexie (IndexedDB), and Service Worker PWA with Web Push support.

---

## 1. Core Principles & Financial Invariants

1. **Paise Integer Storage**: All monetary values are strictly stored as integer paise (e.g. ₹300.50 = `30050`). No floating-point math for stored currency.
2. **Envelope Budgeting / Category Allocation**:
   - Money must be allocated to categories before spending.
   - *Target*: Desired planned allocation.
   - *Allocated*: Hard money assigned in the period.
   - *Spent*: Recorded net spending (expenses minus refunds).
   - *Available*: Opening rollover + allocations + net reallocations − expenses + refunds.
   - Overspending is retained as a negative available figure (not capped at 0).
   - Moving money between categories (e.g. ₹500 Food → Petrol) reduces Food available, increases Petrol available, and does **not** alter account balances.
3. **Account Balances Distinct from Category Availability**:
   - Accounts (Cash, Bank) represent physical/institutional funds.
   - Allocating money changes the budget envelope, not account balances.
   - Expenses decrease both the account balance and category availability.
   - Income increases the account balance and the unallocated budget pool.
   - Transfers debit one account, credit another atomically, and are excluded from income/expense calculations.
4. **Offline First & Idempotent Sync**:
   - Offline transactions queue in Dexie with UUID `operation_id`.
   - Sync sends batches with server-side idempotency; duplicate operation IDs are rejected or safely deduplicated.
   - Local records clearly transition: `pending` → `synced` / `failed`.
5. **Installment (EMI) & Recurring Engine**:
   - Generated occurrence schedules with idempotency.
   - Marking paid creates or links an actual transaction atomically.
   - Historical paid installments (pre-onboarding) do not double-debit opening account balances.

---

## 2. System Architecture

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── recover/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Home / Summary
│   │   ├── transactions/            # History, filters, splits, edit
│   │   ├── accounts/                # Accounts, opening balances, transfers
│   │   ├── budgets/                 # Monthly allocations, envelope moves
│   │   ├── payments/                # Recurring bills & EMI tracker
│   │   ├── insights/                # Reports, period analysis, Recharts
│   │   └── settings/                # Profile, exports, backup/restore, PWA
│   ├── api/
│   │   ├── sync/                    # Idempotent batch sync
│   │   ├── export/                  # CSV & JSON backup endpoints
│   │   ├── restore/                 # Safe validated JSON restore
│   │   ├── notifications/cron/      # Server scheduler for dues/alerts
│   │   └── webpush/                 # Push subscription registration
│   ├── manifest.ts                  # PWA Manifest
│   ├── sw.ts                        # Service Worker
│   └── layout.tsx                   # Root Shell with Providers
├── components/
│   ├── ui/                          # Button, Input, Modal, Sheet, Toast, etc.
│   └── layout/                      # MobileBottomNav, DesktopSidebar, Header
├── features/
│   ├── accounts/                    # Components & hooks for accounts
│   ├── transactions/                # Quick Add modal, list, filters, split form
│   ├── budgets/                     # Category allocations, envelope reallocation
│   ├── payments/                    # Bill cards, EMI progress & payment dialog
│   ├── insights/                    # Breakdown charts, cashflow trend
│   └── settings/                    # PWA install prompt, CSV/JSON export/import
├── lib/
│   ├── money/                       # Paise math, formatting (en-IN), parsing
│   ├── dates/                       # Asia/Kolkata timezone utils, month periods
│   ├── auth/                        # Supabase Auth client & server helpers
│   ├── db/                          # Supabase DB client & fallback local store
│   ├── offline/                     # Dexie schema, queue, sync manager
│   ├── validation/                  # Zod schemas for all forms & payloads
│   └── notifications/               # Push notification manager & scheduler
├── types/                           # Strict TypeScript models & DTOs
└── tests/                           # Vitest tests covering all 24 acceptance criteria
supabase/
└── migrations/                      # Normalized PostgreSQL schema with RLS
```

---

## 3. Phased Implementation Roadmap

- **Phase 1: Foundation & Scaffold**
  - Next.js 14/15 App Router setup, Tailwind CSS with specified design tokens (`#F7F8F5`, `#0F766E`, `#17211E`, `#64716B`, `#B45309`, `#C24141`).
  - Money engine (`paise.ts`) & Date engine (`dates.ts` for Asia/Kolkata).
  - Supabase PostgreSQL schema with RLS & migration files.
  - Setup validation & offline local database schema (Dexie).

- **Phase 2: First Complete Financial Flow**
  - Account creation (Bank & Cash).
  - Category creation (with standard defaults: Petrol, Rent, Electricity, Food, etc.).
  - Budget allocation (allocate ₹3,000 to Petrol).
  - Record expense (₹300 Petrol from Bank).
  - Verify ₹2,700 remaining in Petrol, Bank debited by ₹300, visible in transaction history.

- **Phase 3: Transactions & Budgets**
  - Income, Transfers (atomic debit/credit, excluded from expense/income), Refunds (restores account & category without inflating income).
  - Splits across categories with validation.
  - Edit, soft delete, restore, undo.
  - Reallocations (Move ₹500 Food to Petrol).
  - Overspending handling (negative available displayed) & rollover settings.
  - Search, date filters, category filters, account filters.

- **Phase 4: Payments (Recurring & EMI)**
  - Recurring rules (Rent, Electricity, Recharge, Subscriptions) & idempotent occurrence generation.
  - Loan & EMI tracking (principal, interest, installment count, historical paid count, remaining schedule).
  - Atomic payment linking without double-debiting.
  - Month-end rules (28/29/30/31st handling).

- **Phase 5: Reports & Portability**
  - Time periods (Today, This Week, This Month, This Year, Custom).
  - Spending trends, category breakdown, net cash flow with clear explanations.
  - CSV export (with formula injection protection).
  - Full versioned JSON backup & safe schema-validated restore.

- **Phase 6: PWA, Offline & Notifications**
  - PWA manifest (`manifest.json`), service worker, icons.
  - IndexedDB offline queue via Dexie with operation IDs.
  - Sync mechanism (retry on reopen, reconnect, manual sync).
  - Push subscription endpoint and reminder schedule logic.

- **Phase 7: QA, Verification & Handover**
  - Comprehensive automated tests matching all 24 scenario requirements.
  - Mobile responsiveness verification (360px, 390px, 430px, desktop).
  - `IMPLEMENTATION_STATUS.md`, `README.md`, `.env.example`.
