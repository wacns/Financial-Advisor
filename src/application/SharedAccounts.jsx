import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { View } from "react-native";
import { client } from "./client.js";
import { sharedAccountService } from "./sharedAccounts.js";
import {
  Button,
  Card,
  Empty,
  Heading,
  Label,
  Muted,
  Row,
  Stack,
} from "./ui.jsx";
import Field from "./Field";
import EntryModal from "./EntryModal.jsx";
import { bahrainDate, formatMoney as money } from "../locale.js";
import { currencyCodes } from "../domain/model.js";
import { exportFile } from "../platform/runtime";
const field = (label, name, value = "", type = "text", options) => ({
  label,
  name,
  value,
  type,
  options,
});
export default function SharedAccounts({ workspace: w }) {
  const service = useMemo(() => sharedAccountService(client), []);
  const [accounts, setAccounts] = useState([]),
    [selected, setSelected] = useState(""),
    [snapshot, setSnapshot] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState(null),
    [invite, setInvite] = useState(null),
    [limit, setLimit] = useState(50);
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const refresh = useCallback(
    async (target = selected) => {
      if (w.demo || !w.user) return;
      const attempt = ++generation.current;
      try {
        const list = await service.call("list");
        if (attempt !== generation.current) return;
        setAccounts(list);
        if (target && list.some((a) => a.id === target)) {
          const data = await service.call("snapshot", { account_id: target });
          if (attempt === generation.current) setSnapshot(data);
        } else setSnapshot(null);
        setError("");
      } catch (e) {
        if (attempt === generation.current) {
          setError(e.message);
          setSnapshot(null);
        }
      }
    },
    [selected, service, w.demo, w.user],
  );
  useEffect(() => {
    setSnapshot(null);
    setInvite(null);
    refresh();
    return invalidate;
  }, [refresh, invalidate]);
  useEffect(() => {
    if (!selected || w.demo || !w.user) return;
    const timer = globalThis.setInterval(() => refresh(), 30000);
    const channel = client
      .channel(`shared-${selected}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "fa_shared_accounts",
          filter: `id=eq.${selected}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      globalThis.clearInterval(timer);
      client.removeChannel(channel).catch(() => {});
    };
  }, [selected, w.demo, w.user, refresh]);
  const account = snapshot?.account,
    owner = account?.role === "owner",
    canWrite =
      account &&
      !account.archived &&
      ["owner", "editor"].includes(account.role);
  function open(kind, row = {}) {
    let fields = [],
      values = { account_id: selected },
      title = "",
      note = "",
      submitLabel = "Save";
    if (kind === "create") {
      title = "New shared account";
      fields = [
        field("Shared account name", "name"),
        field("Opening balance", "opening", "0", "number"),
        field(
          "Shared account currency",
          "currency",
          "BHD",
          "select",
          currencyCodes,
        ),
        field("Your display name", "display_name"),
      ];
      values.id = crypto.randomUUID();
      note =
        "This creates a separate shared ledger. Your personal accounts and transactions are not shared or copied.";
    } else if (kind === "accept") {
      title = "Join a shared account";
      fields = [
        field("One-use invitation code", "token"),
        field("Your display name", "display_name"),
      ];
      note =
        "Only accept a code from someone you trust. Your personal workspace remains private.";
    } else if (kind === "invite") {
      title = "Invite a member";
      fields = [
        field("Member access", "role", "viewer", "select", [
          { value: "viewer", label: "Viewer — read only" },
          { value: "editor", label: "Editor — record and edit transactions" },
        ]),
      ];
      note =
        "The code expires after seven days and can be used once. Share it yourself; no email or message is sent automatically.";
    } else if (kind === "save_transaction") {
      title = row.id ? "Edit shared transaction" : "Record shared transaction";
      fields = [
        field("Shared description", "name", row.name || ""),
        field("Shared direction", "type", row.type || "expense", "select", [
          "expense",
          "income",
        ]),
        field(
          `Shared amount (${account.currency})`,
          "amount",
          row.amount ?? "",
          "number",
        ),
        field(
          "Shared transaction date",
          "date",
          row.date || bahrainDate(),
          "date",
        ),
        field("Shared category", "category", row.category || "Other"),
        field("Shared payee / payer (optional)", "payee", row.payee || ""),
        field(
          "Shared labels (comma separated)",
          "labels",
          (row.labels || []).join(", "),
        ),
        field("Shared note (optional)", "note", row.note || ""),
      ];
      values = {
        ...values,
        id: row.id || crypto.randomUUID(),
        ...(row.id ? { expected_revision: row.revision } : {}),
      };
      note =
        "Only this shared account is updated. Other members with access will see this transaction.";
    } else if (kind === "rename") {
      title = "Rename shared account";
      fields = [field("Shared account name", "name", account.name)];
    } else if (kind === "set_role") {
      title = `Change access: ${row.display_name}`;
      fields = [
        field("Member access", "role", row.role, "select", [
          "viewer",
          "editor",
        ]),
      ];
      values.user_id = row.user_id;
    } else {
      title =
        kind === "archive"
          ? account.archived
            ? "Reopen shared account"
            : "Archive shared account"
          : kind === "leave"
            ? "Leave shared account"
            : kind === "remove_member"
              ? `Remove ${row.display_name}`
              : kind === "revoke_invite"
                ? "Revoke invitation"
                : "Delete shared transaction";
      values = {
        ...values,
        ...(kind === "archive"
          ? { archived: !account.archived }
          : kind === "remove_member"
            ? { user_id: row.user_id }
            : kind === "delete_transaction"
              ? { id: row.id, expected_revision: row.revision }
              : kind === "revoke_invite"
                ? { id: row.id }
                : {}),
      };
      note =
        kind === "delete_transaction"
          ? "This removes the expense or income and recalculates the shared balance. Other members will see the change."
          : "Review this change before confirming. Personal accounts are unaffected.";
      submitLabel = "Confirm";
    }
    setForm({
      kind,
      title,
      fields,
      submitLabel,
      note,
      reportingCurrency: account?.currency || "BHD",
      values: {
        ...Object.fromEntries(
          fields.map((f) => [f.name, String(f.value ?? "")]),
        ),
        ...values,
      },
    });
  }
  async function save(action, values) {
    setBusy(true);
    try {
      const data = { ...values };
      if (action === "save_transaction")
        data.labels = String(values.labels || "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
      if (action === "accept") data.token = String(data.token || "").trim();
      const result = await service.call(action, data);
      if (action === "invite") setInvite(result);
      const target = ["create", "accept"].includes(action)
        ? result.id
        : action === "leave"
          ? ""
          : selected;
      setSelected(target);
      setLimit(50);
      await refresh(target);
      w.setMessage("Shared account updated.");
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    try {
      const cell = (value) =>
        '"' +
        String(value ?? "")
          .replace(/^[=+@\-\t\r]/, "'$&")
          .replaceAll('"', '""') +
        '"';
      const content = [
        "Date,Description,Type,Amount,Currency,Category,Payee,Labels,Note",
        ...snapshot.transactions.map((t) =>
          [
            t.date,
            t.name,
            t.type,
            t.amount,
            account.currency,
            t.category,
            t.payee,
            (t.labels || []).join(", "),
            t.note,
          ]
            .map(cell)
            .join(","),
        ),
      ].join("\r\n");
      await exportFile(
        content,
        "text/csv",
        "financial-advisor-shared-account.csv",
      );
    } catch (e) {
      setError(e.message);
    }
  }
  if (w.demo || !w.user)
    return (
      <Card>
        <Heading>Share an account, keep your personal finances private</Heading>
        <Muted>
          Create a household, trip or team ledger with owner, editor and viewer
          access. Invitations are one-use codes; only the account you create is
          shared. Sign in to create or join a real shared account. Demo mode
          never contacts the collaboration service.
        </Muted>
        <Button secondary onPress={w.signout}>
          Leave demo to sign in
        </Button>
      </Card>
    );
  return (
    <Stack>
      <Card>
        <Heading>Shared accounts</Heading>
        <Muted>
          Shared ledgers sync separately from your personal workspace. Viewers
          can read; editors can record and edit; only the owner manages access.
          Refreshes and live account events keep this view current.
        </Muted>
        <Row>
          <Button disabled={busy} onPress={() => open("create")}>
            New shared account
          </Button>
          <Button secondary disabled={busy} onPress={() => open("accept")}>
            Join with a code
          </Button>
          <Button secondary disabled={busy} onPress={() => refresh()}>
            Refresh shared accounts
          </Button>
        </Row>
        {error ? <Label accessibilityRole="alert">{error}</Label> : null}
        <Field
          label="Shared account"
          type="select"
          value={selected}
          onChange={(value) => {
            setSelected(value);
            setLimit(50);
          }}
          options={[
            { value: "", label: "Select an account" },
            ...accounts.map((a) => ({
              value: a.id,
              label: `${a.name} · ${a.role}${a.archived ? " · Archived" : ""}`,
            })),
          ]}
        />
        {!accounts.length ? (
          <Empty>
            No shared accounts yet. Create a new ledger or accept an invitation
            code.
          </Empty>
        ) : null}
      </Card>
      {account ? (
        <>
          <Card testID="shared-account-detail">
            <Row style={{ justifyContent: "space-between" }}>
              <Heading>{account.name}</Heading>
              <Muted>
                {account.role}
                {account.archived ? " · Archived" : ""}
              </Muted>
            </Row>
            <Label style={{ fontSize: 30, fontWeight: "700" }}>
              {money(Number(account.balance), account.currency)}
            </Label>
            <Row>
              {canWrite ? (
                <Button
                  disabled={busy}
                  onPress={() => open("save_transaction")}
                >
                  Add shared transaction
                </Button>
              ) : null}
              <Button secondary onPress={download}>
                Export shared transactions
              </Button>
              {owner ? (
                <>
                  <Button
                    secondary
                    onPress={() => open("invite")}
                    disabled={account.archived}
                  >
                    Invite member
                  </Button>
                  <Button secondary onPress={() => open("rename")}>
                    Rename shared account
                  </Button>
                  <Button secondary onPress={() => open("archive")}>
                    {account.archived ? "Reopen" : "Archive"}
                  </Button>
                </>
              ) : (
                <Button secondary onPress={() => open("leave")}>
                  Leave shared account
                </Button>
              )}
            </Row>
          </Card>
          {invite ? (
            <Card>
              <Heading>One-use invitation</Heading>
              <Label selectable>{invite.token}</Label>
              <Muted>
                {invite.role} access · Expires {invite.expires_at}. Keep this
                code private. Revoking it prevents further use.
              </Muted>
              <Button
                secondary
                onPress={async () => {
                  try {
                    await exportFile(
                      invite.token,
                      "text/plain",
                      "financial-advisor-invitation.txt",
                    );
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Save invitation code
              </Button>
              <Button secondary onPress={() => setInvite(null)}>
                Hide invitation code
              </Button>
            </Card>
          ) : null}
          <Card>
            <Heading>Shared transactions</Heading>
            <Muted>
              Latest records, up to 5,000. Exports contain these loaded records.
            </Muted>
            {snapshot.transactions.slice(0, limit).map((t) => (
              <View key={t.id} style={{ gap: 8, paddingVertical: 12 }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Label style={{ flex: 1 }}>{t.name}</Label>
                  <Label>
                    {t.type === "income" ? "+" : "−"}
                    {money(Number(t.amount), account.currency)}
                  </Label>
                </Row>
                <Muted>
                  {t.date} · {t.category}
                  {t.payee ? ` · ${t.payee}` : ""}
                </Muted>
                {t.note ? <Label>{t.note}</Label> : null}
                {canWrite ? (
                  <Row>
                    <Button
                      secondary
                      onPress={() => open("save_transaction", t)}
                    >
                      Edit shared transaction
                    </Button>
                    <Button
                      secondary
                      onPress={() => open("delete_transaction", t)}
                    >
                      Delete shared transaction
                    </Button>
                  </Row>
                ) : null}
              </View>
            ))}
            {!snapshot.transactions.length ? (
              <Empty>No shared transactions yet.</Empty>
            ) : null}
            {snapshot.transactions.length > limit ? (
              <Button secondary onPress={() => setLimit((n) => n + 50)}>
                Show more shared transactions
              </Button>
            ) : null}
          </Card>
          <Card>
            <Heading>Members & access</Heading>
            {snapshot.members.map((m) => (
              <Row key={m.user_id} style={{ justifyContent: "space-between" }}>
                <Label>{m.display_name}</Label>
                <Muted>
                  {m.role}
                  {m.user_id === w.user.id ? " · You" : ""}
                </Muted>
                {owner && m.role !== "owner" ? (
                  <>
                    <Button secondary onPress={() => open("set_role", m)}>
                      Change access
                    </Button>
                    <Button secondary onPress={() => open("remove_member", m)}>
                      Remove member
                    </Button>
                  </>
                ) : null}
              </Row>
            ))}
            {owner && snapshot.invites.length ? (
              <>
                <Heading>Invitations</Heading>
                {snapshot.invites.map((i) => (
                  <Row key={i.id}>
                    <Muted>
                      {i.role} · {i.redeemed ? "Used" : "Available"} ·{" "}
                      {i.expires_at}
                    </Muted>
                    {!i.redeemed ? (
                      <Button
                        secondary
                        onPress={() => open("revoke_invite", i)}
                      >
                        Revoke invitation
                      </Button>
                    ) : null}
                  </Row>
                ))}
              </>
            ) : null}
          </Card>
          <Card>
            <Heading>Recent shared activity</Heading>
            {snapshot.activity.map((event) => (
              <Muted key={event.id}>
                {snapshot.members.find((m) => m.user_id === event.actor_id)
                  ?.display_name || "Former member"}{" "}
                · {event.action.replaceAll("_", " ")}{" "}
                {event.detail ? `· ${event.detail}` : ""}
              </Muted>
            ))}
          </Card>
        </>
      ) : null}
      {form ? (
        <EntryModal
          key={`${form.kind}-${form.values.id || selected}`}
          form={form}
          onClose={() => setForm(null)}
          onSave={save}
        />
      ) : null}
    </Stack>
  );
}
