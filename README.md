# PocketPlan 💳

> Private, mobile-first personal finance application built for disciplined envelope budgeting, recurring bill tracking, installment (EMI) management, and offline-first expense tracking.

---

## 🌟 Key Features

- **Strict Envelope Budgeting**: Target, Allocated, Spent, Available hierarchy with auditable reallocations. Overspending is explicitly preserved as negative available funds.
- **Accurate Financial Calculations**: Monetary values are stored strictly as integer **paise** (`₹1.00 = 100 paise`). Zero floating point calculation drifts.
- **Separate Bank & Cash Balances**: Budgeting plans future spending; account balances reflect true liquid funds. Transfers debit one account, credit another atomically, and never pollute spending reports.
- **EMI & Installment Tracking**: Auto-generated schedules, link to real transactions without double-debiting, partial payment handling, and historical paid installment preservation.
- **Recurring Commitments & Bills**: Idempotent recurring rule generation, month-end date handling (28th–31st), and status tracking (Upcoming, Due, Overdue, Paid).
- **Offline-First PWA**: Powered by Dexie (IndexedDB) and Service Worker. Record expenses offline with deterministic UUID `operation_id` for idempotent server synchronization upon reconnection.
- **Privacy & Security**: Supabase PostgreSQL with strict Row Level Security (RLS) enforcing user isolation across all foreign references.
- **Data Portability**: Clean CSV export with spreadsheet formula injection protection, plus a versioned full-database JSON export and validated restore.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your Supabase project credentials. If Supabase is not yet configured, PocketPlan includes a dedicated local-first database mode with zero loss of features, allowing immediate offline testing and evaluation.

### 3. Database Migrations
Run the SQL migration in `supabase/migrations/20261019000000_pocketplan_core.sql` in your Supabase SQL Editor.

### 4. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) on your mobile or desktop browser.

### 5. Automated Tests
```bash
npm test
```
Runs 24 automated acceptance tests verifying all core financial calculations, date handling in `Asia/Kolkata`, RLS isolation, and offline sync invariants.

---

## 📐 Design Tokens

- **Background**: `#F7F8F5`
- **Surface**: `#FFFFFF`
- **Primary**: `#0F766E` (Deep Teal)
- **Primary Text**: `#17211E`
- **Secondary Text**: `#64716B`
- **Warning**: `#B45309` (Amber)
- **Error / Negative**: `#C24141` (Crimson)
- **Typography**: DM Sans with tabular numerals for all financial figures.
