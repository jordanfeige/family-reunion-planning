import {
  createExpenseAction,
  deleteContributionAction,
  deleteExpenseAction,
  markContributionPaidAction,
  markContributionPendingAction,
  syncBudgetHouseholdsAction,
  updateExpenseAction,
  upsertContributionAction,
  type TripBudgetSnapshot,
} from "@/app/actions/trips";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  SPLIT_METHODS,
  SPLIT_METHOD_LABELS,
  formatCents,
  type ExpenseCategory,
  type SplitMethod,
} from "@/lib/budget";

function centsToInputDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function TripBudgetPanel({
  slug,
  budget,
}: {
  slug: string;
  budget: TripBudgetSnapshot;
}) {
  const { expenses, contributions, totals, perHouseholdEstimateCents, confirmedHouseholdCount } =
    budget;

  return (
    <div className="stack trip-budget-panel">
      <div>
        <h3 style={{ margin: "0 0 0.35rem", color: "var(--color-fjord)" }}>Trip budget</h3>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
          Track shared costs and who has paid in. Amounts are stored in cents; family sees totals
          only on the plan you publish elsewhere.
        </p>
      </div>

      <div className="card trip-budget-summary" style={{ padding: "1rem" }}>
        <div className="trip-budget-summary-grid">
          <div>
            <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
              Total cost
            </p>
            <p className="trip-budget-summary-value">{formatCents(totals.totalExpenseCents)}</p>
          </div>
          <div>
            <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
              Collected
            </p>
            <p className="trip-budget-summary-value">{formatCents(totals.totalCollectedCents)}</p>
          </div>
          <div>
            <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
              Outstanding
            </p>
            <p className="trip-budget-summary-value">{formatCents(totals.totalOutstandingCents)}</p>
          </div>
          <div>
            <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
              Per household
            </p>
            <p className="trip-budget-summary-value">
              {confirmedHouseholdCount > 0
                ? formatCents(perHouseholdEstimateCents)
                : "—"}
            </p>
            <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.75rem" }}>
              {confirmedHouseholdCount > 0
                ? `Even split across ${confirmedHouseholdCount} confirmed household${
                    confirmedHouseholdCount === 1 ? "" : "s"
                  }`
                : "Add confirmed RSVPs to estimate"}
            </p>
          </div>
        </div>
      </div>

      <section className="stack" style={{ gap: "0.75rem" }}>
        <h4 style={{ margin: 0, color: "var(--color-fjord)", fontSize: "1rem" }}>Expenses</h4>

        {expenses.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            No shared costs yet—add lodging, meals, or activities below.
          </p>
        ) : (
          <ul className="trip-budget-expense-list">
            {expenses.map((expense) => (
              <li key={expense.id} className="card trip-budget-expense-card">
                <form action={updateExpenseAction} className="stack trip-budget-expense-form">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="expense_id" value={expense.id} />
                  <div className="field">
                    <label htmlFor={`exp_title_${expense.id}`}>Title</label>
                    <input
                      id={`exp_title_${expense.id}`}
                      name="title"
                      defaultValue={expense.title}
                      required
                    />
                  </div>
                  <div className="grid-2">
                    <div className="field">
                      <label htmlFor={`exp_cat_${expense.id}`}>Category</label>
                      <select
                        id={`exp_cat_${expense.id}`}
                        name="category"
                        defaultValue={expense.category}
                      >
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`exp_amt_${expense.id}`}>Amount ($)</label>
                      <input
                        id={`exp_amt_${expense.id}`}
                        name="amount_dollars"
                        type="text"
                        inputMode="decimal"
                        defaultValue={centsToInputDollars(expense.amountCents)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="field">
                      <label htmlFor={`exp_split_${expense.id}`}>Split</label>
                      <select
                        id={`exp_split_${expense.id}`}
                        name="split_method"
                        defaultValue={expense.splitMethod}
                      >
                        {SPLIT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {SPLIT_METHOD_LABELS[m as SplitMethod]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`exp_paid_${expense.id}`}>Paid by (optional)</label>
                      <input
                        id={`exp_paid_${expense.id}`}
                        name="paid_by_name"
                        defaultValue={expense.paidByName ?? ""}
                        placeholder="Who fronted this"
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor={`exp_notes_${expense.id}`}>Notes (optional)</label>
                    <input
                      id={`exp_notes_${expense.id}`}
                      name="notes"
                      defaultValue={expense.notes ?? ""}
                    />
                  </div>
                  <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                    <button type="submit" className="btn btn-secondary btn-sm">
                      Save
                    </button>
                  </div>
                </form>
                <form action={deleteExpenseAction} style={{ marginTop: "0.5rem" }}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="expense_id" value={expense.id} />
                  <button type="submit" className="btn btn-secondary btn-sm">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={createExpenseAction} className="stack card" style={{ padding: "1rem" }}>
          <input type="hidden" name="slug" value={slug} />
          <p style={{ margin: 0, fontWeight: 600, color: "var(--color-fjord)" }}>Add expense</p>
          <div className="field">
            <label htmlFor="new_exp_title">Title</label>
            <input id="new_exp_title" name="title" required placeholder="Cabin rental" />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="new_exp_cat">Category</label>
              <select id="new_exp_cat" name="category" defaultValue="lodging">
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {EXPENSE_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="new_exp_amt">Amount ($)</label>
              <input
                id="new_exp_amt"
                name="amount_dollars"
                type="text"
                inputMode="decimal"
                required
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="new_exp_split">Split</label>
              <select id="new_exp_split" name="split_method" defaultValue="even_per_household">
                {SPLIT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {SPLIT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="new_exp_paid">Paid by (optional)</label>
              <input id="new_exp_paid" name="paid_by_name" placeholder="Jordan" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="new_exp_notes">Notes (optional)</label>
            <input id="new_exp_notes" name="notes" />
          </div>
          <button type="submit" className="btn btn-berry" style={{ alignSelf: "flex-start" }}>
            Add expense
          </button>
        </form>
      </section>

      <div className="divider" />

      <section className="stack" style={{ gap: "0.75rem" }}>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <h4 style={{ margin: 0, color: "var(--color-fjord)", fontSize: "1rem" }}>
            Household contributions
          </h4>
          <form action={syncBudgetHouseholdsAction}>
            <input type="hidden" name="slug" value={slug} />
            <button type="submit" className="btn btn-secondary btn-sm">
              Sync from RSVPs
            </button>
          </form>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
          Rows are prefilled from confirmed final RSVPs when you open this step. Set each
          household&apos;s share and mark paid when money arrives.
        </p>

        {contributions.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            No households yet—confirm RSVPs in the previous step, then click Sync from RSVPs.
          </p>
        ) : (
          <ul className="trip-budget-contribution-list">
            {contributions.map((row) => (
              <li key={row.id} className="card trip-budget-contribution-card">
                <form action={upsertContributionAction} className="stack">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="contribution_id" value={row.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={row.status}
                  />
                  <div className="grid-2">
                    <div className="field">
                      <label htmlFor={`hh_name_${row.id}`}>Household</label>
                      <input
                        id={`hh_name_${row.id}`}
                        name="household_name"
                        defaultValue={row.householdName}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`hh_amt_${row.id}`}>Amount ($)</label>
                      <input
                        id={`hh_amt_${row.id}`}
                        name="amount_dollars"
                        type="text"
                        inputMode="decimal"
                        defaultValue={centsToInputDollars(row.amountCents)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="field">
                      <label htmlFor={`hh_email_${row.id}`}>Email (optional)</label>
                      <input
                        id={`hh_email_${row.id}`}
                        name="household_email"
                        type="email"
                        defaultValue={row.householdEmail ?? ""}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`hh_method_${row.id}`}>Method (optional)</label>
                      <input
                        id={`hh_method_${row.id}`}
                        name="method"
                        defaultValue={row.method ?? ""}
                        placeholder="Venmo, Zelle, cash…"
                      />
                    </div>
                  </div>
                  <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                    <button type="submit" className="btn btn-secondary btn-sm">
                      Save
                    </button>
                    <span
                      className={`pill trip-budget-status-pill trip-budget-status-pill--${row.status}`}
                    >
                      {row.status === "paid" ? "Paid" : "Pending"}
                    </span>
                  </div>
                </form>
                <div
                  className="row"
                  style={{ flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem", alignItems: "center" }}
                >
                  {row.status === "pending" ? (
                    <form action={markContributionPaidAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="contribution_id" value={row.id} />
                      <input type="hidden" name="method" value={row.method ?? ""} />
                      <button type="submit" className="btn btn-berry btn-sm">
                        Mark paid
                      </button>
                    </form>
                  ) : (
                    <form action={markContributionPendingAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="contribution_id" value={row.id} />
                      <button type="submit" className="btn btn-secondary btn-sm">
                        Mark pending
                      </button>
                    </form>
                  )}
                </div>
                <form action={deleteContributionAction} style={{ marginTop: "0.5rem" }}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="contribution_id" value={row.id} />
                  <button type="submit" className="btn btn-secondary btn-sm">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={upsertContributionAction} className="stack card" style={{ padding: "1rem" }}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="status" value="pending" />
          <p style={{ margin: 0, fontWeight: 600, color: "var(--color-fjord)" }}>
            Add household manually
          </p>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="new_hh_name">Household</label>
              <input id="new_hh_name" name="household_name" required placeholder="Smith family" />
            </div>
            <div className="field">
              <label htmlFor="new_hh_amt">Amount ($)</label>
              <input
                id="new_hh_amt"
                name="amount_dollars"
                type="text"
                inputMode="decimal"
                defaultValue="0.00"
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="new_hh_email">Email (optional)</label>
            <input id="new_hh_email" name="household_email" type="email" />
          </div>
          <button type="submit" className="btn btn-secondary" style={{ alignSelf: "flex-start" }}>
            Add household
          </button>
        </form>
      </section>

      {/*
        Apply schema to your database (requires DATABASE_URL in .env):
        npm run db:push
        Or run the SQL migration in supabase/migrations/20260601000000_trip_budget.sql
      */}
    </div>
  );
}
