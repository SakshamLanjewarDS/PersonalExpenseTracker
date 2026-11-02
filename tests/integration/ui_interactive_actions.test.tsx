import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppProviders } from "@/components/providers/AppProviders";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { QuickAddModal } from "@/components/transactions/QuickAddModal";
import AccountsPage from "@/app/accounts/page";
import BudgetsPage from "@/app/budgets/page";
import PaymentsPage from "@/app/payments/page";
import TransactionsPage from "@/app/transactions/page";
import HomePage from "@/app/page";
import { FinanceRepository } from "@/lib/offline/repository";
import { offlineDB } from "@/lib/offline/db";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/budgets",
  useSearchParams: () => new URLSearchParams(),
}));

describe("PocketPlan UI Interactive Actions & Navigation", () => {
  const userId = "user-primary";

  beforeEach(async () => {
    vi.clearAllMocks();
    await offlineDB.accounts.clear();
    await offlineDB.categories.clear();
    await offlineDB.transactions.clear();
    await offlineDB.allocations.clear();
    await offlineDB.reallocations.clear();
    await offlineDB.loans.clear();
    await offlineDB.installments.clear();
    await offlineDB.occurrences.clear();

    await FinanceRepository.initUserStarterData(userId);
  });

  it("1. Navbar Add button opens QuickAddModal on mobile and desktop", async () => {
    render(
      <AppProviders>
        <DesktopSidebar />
        <MobileBottomNav />
        <QuickAddModal />
      </AppProviders>
    );

    // Modal is initially not visible
    expect(screen.queryByText("Enter amount")).not.toBeInTheDocument();

    // Click Mobile or Desktop Add button
    const addButtons = screen.getAllByRole("button", { name: "Add Transaction" });
    expect(addButtons.length).toBe(2);
    fireEvent.click(addButtons[0]);

    // Modal is now visible
    await waitFor(() => {
      expect(screen.getByText("Enter amount")).toBeInTheDocument();
      expect(screen.getByText("Save expense")).toBeInTheDocument();
    });

    // Close button dismisses modal
    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText("Enter amount")).not.toBeInTheDocument();
    });
  });

  it("2. Accounts page: Add Bank, Transfer, and Reset buttons open their respective modals", async () => {
    render(
      <AppProviders>
        <AccountsPage />
      </AppProviders>
    );

    // Wait for accounts to load
    await waitFor(() => {
      expect(screen.getByText(/TOTAL BALANCE/i)).toBeInTheDocument();
    });

    // 2a. Click "Add Bank" in Quick Actions
    const addBankButtons = screen.getAllByRole("button", { name: /Add Bank/i });
    expect(addBankButtons.length).toBeGreaterThan(0);
    fireEvent.click(addBankButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Add New Account")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e.g. HDFC Savings, Cash Wallet/i)).toBeInTheDocument();
    });

    // Close Add Account modal
    const cancelAddBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelAddBtn);

    await waitFor(() => {
      expect(screen.queryByText("Add New Account")).not.toBeInTheDocument();
    });

    // 2b. Click "Transfer" in Quick Actions
    const transferButtons = screen.getAllByRole("button", { name: /Transfer/i });
    expect(transferButtons.length).toBeGreaterThan(0);
    fireEvent.click(transferButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Transfer Between Accounts")).toBeInTheDocument();
      expect(screen.getByText("Execute Transfer")).toBeInTheDocument();
    });

    // Close Transfer modal
    const cancelTransferBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelTransferBtn);

    await waitFor(() => {
      expect(screen.queryByText("Transfer Between Accounts")).not.toBeInTheDocument();
    });

    // 2c. Click "Reset Data" in Quick Actions
    const resetBtn = screen.getByRole("button", { name: "Reset Data" });
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(screen.getByText("Clear Sample Data")).toBeInTheDocument();
      expect(screen.getByText("Reset Sample Data")).toBeInTheDocument();
    });

    // Close Reset modal
    const cancelResetBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelResetBtn);

    await waitFor(() => {
      expect(screen.queryByText("Clear Sample Data")).not.toBeInTheDocument();
    });

    // 2d. Card-level actions: Transfer, Edit, History
    const cardTransferBtns = screen.getAllByRole("button", { name: /Transfer/i });
    expect(cardTransferBtns.length).toBeGreaterThan(1);
    fireEvent.click(cardTransferBtns[1]); // Click card-level transfer button

    await waitFor(() => {
      expect(screen.getByText("Transfer Between Accounts")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Click card-level Edit button
    const editBtns = screen.getAllByRole("button", { name: /Edit/i });
    expect(editBtns.length).toBeGreaterThan(0);
    fireEvent.click(editBtns[0]);

    await waitFor(() => {
      expect(screen.getByText("Edit Account")).toBeInTheDocument();
      expect(screen.getByText("Save Changes")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Click card-level History button
    const historyBtns = screen.getAllByRole("button", { name: /History/i });
    expect(historyBtns.length).toBeGreaterThan(0);
    fireEvent.click(historyBtns[historyBtns.length - 1]);
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/transactions?account="));

    // 2e. Bottom dashed "Add Another Bank / Cash Account" button
    const bottomAddBankBtn = screen.getByRole("button", { name: /Add Another Bank \/ Cash Account/i });
    fireEvent.click(bottomAddBankBtn);
    await waitFor(() => {
      expect(screen.getByText("Add New Account")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  });

  it("3. Budgets page: Add Budget, Allocate, and Reallocate buttons open modals", async () => {
    render(
      <AppProviders>
        <BudgetsPage />
      </AppProviders>
    );

    // Wait for budgets to load
    await waitFor(() => {
      expect(screen.getByText(/Total Salary/i)).toBeInTheDocument();
    });

    // 3a. Click "Add Budget" button
    const addBudgetButtons = screen.getAllByRole("button", { name: /Add Budget/i });
    expect(addBudgetButtons.length).toBeGreaterThan(0);
    fireEvent.click(addBudgetButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Add Budget Envelope")).toBeInTheDocument();
      expect(screen.getByText("Create & Save Budget")).toBeInTheDocument();
    });

    // Close Add Budget modal
    const cancelAddBudgetBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelAddBudgetBtn);

    await waitFor(() => {
      expect(screen.queryByText("Add Budget Envelope")).not.toBeInTheDocument();
    });

    // 3b. Click "Reallocate" button
    const reallocateBtn = screen.getByRole("button", { name: "Reallocate" });
    fireEvent.click(reallocateBtn);

    await waitFor(() => {
      expect(screen.getByText("Reallocate Envelopes")).toBeInTheDocument();
      expect(screen.getByText("Execute Reallocation")).toBeInTheDocument();
    });

    // Close Reallocate modal
    const cancelReallocBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelReallocBtn);

    await waitFor(() => {
      expect(screen.queryByText("Reallocate Envelopes")).not.toBeInTheDocument();
    });

    // 3c. Edit Salary button on Financial Card
    const editSalaryBtn = screen.getByRole("button", { name: /Edit salary/i });
    fireEvent.click(editSalaryBtn);
    await waitFor(() => {
      expect(screen.getByText("Edit Monthly Salary")).toBeInTheDocument();
      expect(screen.getByText("Save Salary")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Switch to "All" tab to see all category envelope cards
    const allTabBtn = screen.getByRole("button", { name: /^All \(/i });
    fireEvent.click(allTabBtn);

    // 3d. Card-level Edit allocation button on category envelopes
    const cardEditBtns = screen.getAllByRole("button", { name: /^Edit$/i });
    expect(cardEditBtns.length).toBeGreaterThan(0);
    fireEvent.click(cardEditBtns[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/Allocate to/i).length).toBeGreaterThan(0);
      expect(screen.getByText("Save Allocation")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // 3e. Card-level History button
    const cardHistoryBtns = screen.getAllByRole("button", { name: /History/i });
    expect(cardHistoryBtns.length).toBeGreaterThan(0);
    fireEvent.click(cardHistoryBtns[cardHistoryBtns.length - 1]);
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/transactions?category="));

    // 3f. Bottom dashed "Add Another Budget Envelope" button
    const bottomAddBudgetBtn = screen.getByRole("button", { name: /Add Another Budget Envelope/i });
    fireEvent.click(bottomAddBudgetBtn);
    await waitFor(() => {
      expect(screen.getByText("Add Budget Envelope")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  });

  it("4. Payments page: Add plan button opens Add EMI Plan modal", async () => {
    render(
      <AppProviders>
        <PaymentsPage />
      </AppProviders>
    );

    // Click "Add plan"
    const addPlanButtons = await screen.findAllByRole("button", { name: /Add plan/i });
    expect(addPlanButtons.length).toBeGreaterThan(0);
    fireEvent.click(addPlanButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Add EMI Plan")).toBeInTheDocument();
      expect(screen.getByText("Create Plan")).toBeInTheDocument();
    });

    // Close modal
    const cancelPlanBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelPlanBtn);

    await waitFor(() => {
      expect(screen.queryByText("Add EMI Plan")).not.toBeInTheDocument();
    });
  });

  it("5. Transactions page: Filter button opens Filter Transactions sheet", async () => {
    render(
      <AppProviders>
        <TransactionsPage />
      </AppProviders>
    );

    // Wait for page load
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search merchant, notes, amount/i)).toBeInTheDocument();
    });

    // Click Category filter button
    const catFilterBtn = screen.getByRole("button", { name: "Category" });
    fireEvent.click(catFilterBtn);

    await waitFor(() => {
      expect(screen.getByText("Filter Transactions")).toBeInTheDocument();
      expect(screen.getByText("All Categories")).toBeInTheDocument();
    });
  });

  it("6. Home page: Quick actions and NotchedFinancialCard buttons navigate correctly", async () => {
    render(
      <AppProviders>
        <HomePage />
        <QuickAddModal />
      </AppProviders>
    );

    await waitFor(() => {
      expect(screen.getByText(/TOTAL BALANCE/i)).toBeInTheDocument();
    });

    // 6a. Click "Add Expense" quick action
    const addExpenseBtn = screen.getByRole("button", { name: "Add Expense" });
    fireEvent.click(addExpenseBtn);

    await waitFor(() => {
      expect(screen.getByText("Enter amount")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    // 6b. Click "Transfer" quick action
    const transferBtn = screen.getByRole("button", { name: "Transfer" });
    fireEvent.click(transferBtn);
    expect(mockPush).toHaveBeenCalledWith("/accounts");

    // 6c. Click "Budgets" quick action
    const budgetsBtn = screen.getByRole("button", { name: "Budgets" });
    fireEvent.click(budgetsBtn);
    expect(mockPush).toHaveBeenCalledWith("/budgets");

    // 6d. Click "Accounts" quick action
    const accountsBtn = screen.getByRole("button", { name: "Accounts" });
    fireEvent.click(accountsBtn);
    expect(mockPush).toHaveBeenCalledWith("/accounts");

    // 6e. Click NotchedFinancialCard recessed action button
    const cardActionBtn = screen.getByRole("button", { name: /Add account/i });
    fireEvent.click(cardActionBtn);
    expect(mockPush).toHaveBeenCalledWith("/accounts");
  });
});
