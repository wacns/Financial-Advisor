import { amount, text, date, convert, clone } from "./model.ts";
import { toFils, bahrainDate } from "../locale.ts";
import { saveTransaction } from "./ledger.ts";
import { checkedLater, isOneOf, matches, must } from "../guards.ts";
import type { ProjectDocument } from "./types.ts";
const isDocumentData = matches(
  /^data:(application\/pdf|text\/plain|image\/(png|jpeg|webp));base64,/,
);
import type { Contract, Milestone, Project, Workspace } from "./types.ts";
const sum = (rows: unknown[]): number =>
  rows.reduce<number>((n, value) => n + toFils(value), 0) / 1000;
export function projectTotals(s: Workspace, p: Project) {
  const payments = s.transactions.filter(
    (t) => t.projectId === p.id && t.type === "expense",
  );
  const paid = sum(
    payments.map((t) =>
      convert(
        s,
        t.amount,
        t.currency ||
          s.accounts.find((a) => a.id === t.accountId)?.currency ||
          "BHD",
        p.currency || "BHD",
      ),
    ),
  );
  const contracted = sum(
    p.contracts.map((c) =>
      sum([c.original, ...c.variations.map((v) => v.amount)]),
    ),
  );
  return {
    paid,
    contracted,
    remaining: sum([p.budget, -paid]),
    owed: sum([contracted, -paid]),
    forecast: sum([
      contracted,
      Math.max(0, sum([p.budget, -p.reserve, -contracted])),
      p.reserve,
    ]),
    allocated: sum(p.categories.map((c) => c.budget)),
  };
}
export function milestonePaid(
  s: Workspace,
  p: Pick<Project, "id" | "currency">,
  m: Pick<Milestone, "id">,
): number {
  return sum(
    s.transactions
      .filter(
        (t) =>
          t.projectId === p.id &&
          t.milestoneId === m.id &&
          t.type === "expense",
      )
      .map((t) =>
        convert(
          s,
          t.amount,
          t.currency ||
            s.accounts.find((a) => a.id === t.accountId)?.currency ||
            "BHD",
          p.currency,
        ),
      ),
  );
}
export function milestoneStatus(
  s: Workspace,
  p: Project,
  m: Milestone,
  today: string = bahrainDate(),
) {
  if (toFils(milestonePaid(s, p, m)) >= toFils(m.amount)) return "Paid";
  return m.due < today
    ? "Overdue"
    : m.due === today
      ? "Due today"
      : m.complete
        ? "Completed · unpaid"
        : "Upcoming";
}
export function validateProjects(s: Workspace): Workspace {
  for (const p of s.projects) {
    if (
      p.reserve < 0 ||
      toFils(sum(p.categories.map((c) => c.budget))) + toFils(p.reserve) >
        toFils(p.budget)
    )
      throw Error(
        "Category allocations plus contingency exceed the project budget.",
      );
    for (const c of p.contracts) {
      if (!p.categories.some((category) => category.id === c.categoryId))
        throw Error("Choose a project category.");
      const value = sum([c.original, ...c.variations.map((v) => v.amount)]);
      if (value <= 0) throw Error("Contract value must remain positive.");
      // The check above guarantees the category exists.
      const category = must(
        p.categories.find((category) => category.id === c.categoryId),
        "project category",
      );
      const allocated = sum(
        p.contracts
          .filter((row) => row.categoryId === c.categoryId)
          .map((row) =>
            sum([row.original, ...row.variations.map((v) => v.amount)]),
          ),
      );
      if (toFils(allocated) > toFils(category.budget))
        throw Error("Contract values exceed their category allocation.");
      if (
        toFils(
          sum(
            p.milestones
              .filter((m) => m.contractId === c.id)
              .map((m) => m.amount),
          ),
        ) > toFils(value)
      )
        throw Error("Scheduled milestones exceed the contract value.");
      if (
        (c.startDate && c.endDate && c.endDate < c.startDate) ||
        (p.startDate && c.startDate && c.startDate < p.startDate) ||
        (p.targetDate && c.endDate && c.endDate > p.targetDate)
      )
        throw Error("Contract dates must fit the project period.");
    }
    for (const m of p.milestones) {
      const contract = p.contracts.find((c) => c.id === m.contractId);
      if (!contract) throw Error("Choose an existing agreement.");
      if (milestonePaid(s, p, m) > m.amount)
        throw Error("Payments exceed this milestone amount.");
      if (
        (contract.startDate && m.due < contract.startDate) ||
        (contract.endDate && m.due > contract.endDate)
      )
        throw Error("Milestone dates must fit the agreement period.");
    }
    for (const t of s.transactions.filter((t) => t.projectId === p.id)) {
      if (t.type !== "expense")
        throw Error("Project payments must remain expenses.");
      if (t.milestoneId) {
        const m = p.milestones.find((m) => m.id === t.milestoneId);
        if (!m || m.contractId !== t.contractId)
          throw Error("Payment must link to a valid milestone and agreement.");
      }
    }
  }
  return s;
}
/** Fields the project forms submit; each command kind reads its own subset. */
export type ProjectInput = {
  projectId?: unknown;
  reserve?: unknown;
  name?: unknown;
  budget?: unknown;
  vendor?: unknown;
  categoryId?: unknown;
  original?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  notes?: unknown;
  contractId?: unknown;
  amount?: unknown;
  date?: unknown;
  due?: unknown;
  kind?: unknown;
  milestoneId?: unknown;
  accountId?: unknown;
  transactionId?: unknown;
  file?: unknown;
  fileName?: unknown;
  collection?: unknown;
};
export function projectCommand(
  s: Workspace,
  kind: string,
  data: ProjectInput,
  id?: string | null,
  uuid: () => string = () => crypto.randomUUID(),
): Workspace | null {
  const p = s.projects.find((p) => p.id === data.projectId);
  if (
    ![
      "deleteProject",
      "projectReserve",
      "projectCategory",
      "projectContract",
      "projectVariation",
      "projectMilestone",
      "projectComplete",
      "projectPayment",
      "projectLink",
      "projectUnlink",
      "projectDocument",
      "projectDeleteItem",
    ].includes(kind)
  )
    return null;
  if (!p) throw Error("Project not found.");
  if (kind === "deleteProject") {
    s.projects = s.projects.filter((row) => row.id !== p.id);
    for (const t of s.transactions)
      if (t.projectId === p.id) {
        delete t.projectId;
        delete t.contractId;
        delete t.milestoneId;
      }
  } else if (kind === "projectReserve") p.reserve = amount(data.reserve);
  else if (kind === "projectCategory") {
    const c = {
      id: id || uuid(),
      name: text(data.name),
      budget: amount(data.budget, true),
    };
    p.categories = p.categories.filter((row) => row.id !== c.id);
    p.categories.push(c);
  } else if (kind === "projectContract") {
    const old = p.contracts.find((c) => c.id === id),
      c = checkedLater<Contract>({
        id: id || uuid(),
        name: text(data.name),
        vendor: String(data.vendor || ""),
        categoryId: data.categoryId,
        original: amount(data.original, true),
        startDate: date(data.startDate, true),
        endDate: date(data.endDate, true),
        notes: String(data.notes || "").slice(0, 1000),
        variations: old?.variations || [],
      });
    p.contracts = p.contracts.filter((row) => row.id !== c.id);
    p.contracts.push(c);
  } else if (kind === "projectVariation") {
    const c = p.contracts.find((c) => c.id === data.contractId);
    if (!c) throw Error("Agreement not found.");
    const value = amount(data.amount);
    if (!value) throw Error("Variation must change the contract value.");
    c.variations.push({
      id: uuid(),
      name: text(data.name),
      amount: value,
      date: date(data.date),
    });
  } else if (kind === "projectMilestone") {
    const old = p.milestones.find((m) => m.id === id),
      m = checkedLater<Milestone>({
        id: id || uuid(),
        name: text(data.name),
        contractId: data.contractId,
        amount: amount(data.amount, true),
        due: date(data.due),
        kind: data.kind || old?.kind || "Milestone",
        complete: old?.complete || false,
      });
    if (
      (p.targetDate && m.due > p.targetDate) ||
      (p.startDate && m.due < p.startDate)
    )
      throw Error("Milestone dates must fit the project period.");
    if (old && toFils(m.amount) < toFils(milestonePaid(s, p, old)))
      throw Error(
        "Milestone amount cannot be less than payments already recorded.",
      );
    p.milestones = p.milestones.filter((row) => row.id !== m.id);
    p.milestones.push(m);
  } else if (kind === "projectComplete") {
    const m = p.milestones.find((m) => m.id === id);
    if (!m) throw Error("Milestone not found.");
    m.complete = !m.complete;
  } else if (kind === "projectPayment") {
    if (p.archived) throw Error("Reopen the project before adding payments.");
    const m = p.milestones.find((m) => m.id === data.milestoneId);
    if (!m) throw Error("Choose a milestone.");
    const value = convert(
      s,
      amount(data.amount, true),
      s.accounts.find((a) => a.id === data.accountId)?.currency || "BHD",
      p.currency,
    );
    if (toFils(value) > toFils(m.amount) - toFils(milestonePaid(s, p, m)))
      throw Error("Payment exceeds the remaining milestone amount.");
    saveTransaction(
      s,
      {
        ...data,
        type: "expense",
        name: data.name || m.name,
        category: "Other",
        projectId: p.id,
        contractId: m.contractId,
        milestoneId: m.id,
      },
      undefined,
      uuid,
    );
  } else if (kind === "projectLink") {
    const t = s.transactions.find((t) => t.id === data.transactionId),
      m = p.milestones.find((m) => m.id === data.milestoneId);
    if (
      !t ||
      t.type !== "expense" ||
      !m ||
      (t.projectId && t.projectId !== p.id)
    )
      throw Error("Choose an unlinked expense and an existing milestone.");
    const paid =
        milestonePaid(s, p, m) -
        (t.milestoneId === m.id
          ? convert(s, t.amount, t.currency || "BHD", p.currency)
          : 0),
      value = convert(s, t.amount, t.currency || "BHD", p.currency);
    if (toFils(paid) + toFils(value) > toFils(m.amount))
      throw Error("Linking this expense would exceed the milestone.");
    Object.assign(t, {
      projectId: p.id,
      contractId: m.contractId,
      milestoneId: m.id,
    });
  } else if (kind === "projectUnlink") {
    const t = s.transactions.find((t) => t.id === id && t.projectId === p.id);
    if (!t) throw Error("Payment not found.");
    delete t.projectId;
    delete t.contractId;
    delete t.milestoneId;
  } else if (kind === "projectDocument") {
    const file = data.file || "";
    if (!isDocumentData(file))
      throw Error("Choose a PDF, text document or receipt image.");
    if (file.length > 1500000)
      throw Error("Document must be at most 1 MB.");
    p.documents.push(
      checkedLater<ProjectDocument>({
        id: uuid(),
        name: text(data.name),
        file,
        fileName: String(data.fileName || data.name).replace(/[\\/]/g, "_"),
        contractId: data.contractId || "",
        transactionId: data.transactionId || "",
        createdAt: new Date().toISOString(),
      }),
    );
  } else if (kind === "projectDeleteItem") {
    const collection = data.collection;
    if (
      !isOneOf(
        ["categories", "contracts", "milestones", "documents", "variations"],
        collection,
      )
    )
      throw Error("Choose an item.");
    if (
      (collection === "categories" &&
        p.contracts.some((c) => c.categoryId === id)) ||
      (collection === "contracts" &&
        (p.milestones.some((m) => m.contractId === id) ||
          s.transactions.some((t) => t.contractId === id))) ||
      (collection === "milestones" &&
        s.transactions.some((t) => t.milestoneId === id))
    )
      throw Error("Unlink or remove child records before deleting this item.");
    if (collection === "variations") {
      const c = p.contracts.find((c) => c.id === data.contractId);
      if (!c) throw Error("Contract not found.");
      c.variations = c.variations.filter((v) => v.id !== id);
    } else if (collection === "categories")
      p.categories = p.categories.filter((r) => r.id !== id);
    else if (collection === "contracts")
      p.contracts = p.contracts.filter((r) => r.id !== id);
    else if (collection === "milestones")
      p.milestones = p.milestones.filter((r) => r.id !== id);
    else p.documents = p.documents.filter((r) => r.id !== id);
  } else return null;
  return validateProjects(s);
}
