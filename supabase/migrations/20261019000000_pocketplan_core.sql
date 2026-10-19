-- PocketPlan Core Database Schema & Migrations
-- Generated for Supabase PostgreSQL
-- All monetary columns are BIGINT (paise, 1 INR = 100 paise)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  locale TEXT NOT NULL DEFAULT 'en-IN',
  time_zone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. ACCOUNTS (Cash & Bank)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash', 'bank')),
  opening_balance_paise BIGINT NOT NULL DEFAULT 0,
  opening_date DATE NOT NULL,
  description TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_accounts_user_id UNIQUE (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON public.accounts(user_id);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts"
  ON public.accounts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts"
  ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
  ON public.accounts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts"
  ON public.accounts FOR DELETE USING (auth.uid() = user_id);

-- 3. CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Tag',
  color TEXT NOT NULL DEFAULT '#0F766E',
  sort_order INT NOT NULL DEFAULT 0,
  target_paise BIGINT NOT NULL DEFAULT 0,
  rollover_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_categories_user_id UNIQUE (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories(user_id);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own categories"
  ON public.categories FOR ALL USING (auth.uid() = user_id);

-- 4. BUDGET ALLOCATIONS
CREATE TABLE IF NOT EXISTS public.budget_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL, -- Format YYYY-MM
  category_id UUID NOT NULL,
  allocated_paise BIGINT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_allocations_category FOREIGN KEY (user_id, category_id) REFERENCES public.categories(user_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_allocations_period_category UNIQUE (user_id, period_key, category_id)
);

CREATE INDEX IF NOT EXISTS idx_allocations_period ON public.budget_allocations(user_id, period_key);
ALTER TABLE public.budget_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own allocations"
  ON public.budget_allocations FOR ALL USING (auth.uid() = user_id);

-- 5. CATEGORY REALLOCATIONS (Envelope Money Moves)
CREATE TABLE IF NOT EXISTS public.category_reallocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  from_category_id UUID NOT NULL,
  to_category_id UUID NOT NULL,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_realloc_from FOREIGN KEY (user_id, from_category_id) REFERENCES public.categories(user_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_realloc_to FOREIGN KEY (user_id, to_category_id) REFERENCES public.categories(user_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_realloc_period ON public.category_reallocations(user_id, period_key);
ALTER TABLE public.category_reallocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reallocations"
  ON public.category_reallocations FOR ALL USING (auth.uid() = user_id);

-- 6. TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer', 'refund')),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  date DATE NOT NULL,
  time TIME,
  account_id UUID NOT NULL,
  to_account_id UUID,
  category_id UUID,
  payment_method TEXT CHECK (payment_method IN ('cash', 'upi', 'debit_card', 'bank_transfer')),
  merchant TEXT,
  note TEXT,
  is_split BOOLEAN NOT NULL DEFAULT FALSE,
  refunded_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  linked_installment_id UUID,
  linked_occurrence_id UUID,
  receipt_url TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_trans_account FOREIGN KEY (user_id, account_id) REFERENCES public.accounts(user_id, id),
  CONSTRAINT fk_trans_to_account FOREIGN KEY (user_id, to_account_id) REFERENCES public.accounts(user_id, id),
  CONSTRAINT fk_trans_category FOREIGN KEY (user_id, category_id) REFERENCES public.categories(user_id, id),
  CONSTRAINT uq_trans_operation UNIQUE (user_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_trans_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_trans_account ON public.transactions(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_trans_category ON public.transactions(user_id, category_id);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own transactions"
  ON public.transactions FOR ALL USING (auth.uid() = user_id);

-- 7. TRANSACTION SPLITS
CREATE TABLE IF NOT EXISTS public.transaction_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  category_id UUID NOT NULL,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_splits_trans ON public.transaction_splits(transaction_id);
ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own transaction splits"
  ON public.transaction_splits FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_splits.transaction_id AND t.user_id = auth.uid()
    )
  );

-- 8. RECURRING RULES (Bills & Subscriptions)
CREATE TABLE IF NOT EXISTS public.recurring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id UUID NOT NULL,
  expected_amount_paise BIGINT NOT NULL CHECK (expected_amount_paise > 0),
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'weekly', 'yearly', 'quarterly')),
  due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  start_date DATE NOT NULL,
  end_date DATE,
  preferred_account_id UUID,
  preferred_payment_method TEXT,
  reminder_days_before INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_recurring_category FOREIGN KEY (user_id, category_id) REFERENCES public.categories(user_id, id),
  CONSTRAINT fk_recurring_account FOREIGN KEY (user_id, preferred_account_id) REFERENCES public.accounts(user_id, id)
);

ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own recurring rules"
  ON public.recurring_rules FOR ALL USING (auth.uid() = user_id);

-- 9. PAYMENT OCCURRENCES
CREATE TABLE IF NOT EXISTS public.payment_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.recurring_rules(id) ON DELETE CASCADE,
  loan_id UUID,
  name TEXT NOT NULL,
  category_id UUID NOT NULL,
  period_key TEXT NOT NULL, -- YYYY-MM
  expected_date DATE NOT NULL,
  expected_amount_paise BIGINT NOT NULL CHECK (expected_amount_paise > 0),
  actual_amount_paise BIGINT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'due', 'overdue', 'partly_paid', 'paid', 'skipped', 'cancelled')),
  linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_rule_period UNIQUE (user_id, rule_id, period_key)
);

ALTER TABLE public.payment_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own occurrences"
  ON public.payment_occurrences FOR ALL USING (auth.uid() = user_id);

-- 10. LOANS & INSTALLMENT PLANS (EMI)
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lender TEXT NOT NULL,
  installment_amount_paise BIGINT NOT NULL CHECK (installment_amount_paise > 0),
  total_installments INT NOT NULL CHECK (total_installments > 0),
  historical_paid_count INT NOT NULL DEFAULT 0 CHECK (historical_paid_count >= 0),
  start_month_key TEXT NOT NULL,
  due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  preferred_account_id UUID,
  linked_category_id UUID NOT NULL,
  principal_paise BIGINT,
  interest_rate_annual NUMERIC,
  reference_number TEXT,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_loans_account FOREIGN KEY (user_id, preferred_account_id) REFERENCES public.accounts(user_id, id),
  CONSTRAINT fk_loans_category FOREIGN KEY (user_id, linked_category_id) REFERENCES public.categories(user_id, id)
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own loans"
  ON public.loans FOR ALL USING (auth.uid() = user_id);

-- 11. INSTALLMENTS
CREATE TABLE IF NOT EXISTS public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  installment_number INT NOT NULL CHECK (installment_number > 0),
  period_key TEXT NOT NULL,
  due_date DATE NOT NULL,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'due', 'overdue', 'partly_paid', 'paid', 'skipped')),
  paid_amount_paise BIGINT NOT NULL DEFAULT 0,
  linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  paid_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_loan_installment_no UNIQUE (loan_id, installment_number)
);

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own installments"
  ON public.installments FOR ALL USING (auth.uid() = user_id);

-- 12. IDEMPOTENCY RECEIPTS
CREATE TABLE IF NOT EXISTS public.idempotency_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,
  action TEXT NOT NULL,
  response_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_idempotency_user_op UNIQUE (user_id, operation_id)
);

ALTER TABLE public.idempotency_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own idempotency"
  ON public.idempotency_receipts FOR ALL USING (auth.uid() = user_id);

-- 13. PUSH SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_push_user_endpoint UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own push subscriptions"
  ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- 14. NOTIFICATION DELIVERIES
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurrence_id UUID REFERENCES public.payment_occurrences(id) ON DELETE CASCADE,
  installment_id UUID REFERENCES public.installments(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_notif_delivery UNIQUE (user_id, occurrence_id, notification_type)
);

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notification deliveries"
  ON public.notification_deliveries FOR ALL USING (auth.uid() = user_id);
