import React, { useState } from "react";
import { View } from "react-native";
import {
  Stack,
  Row,
  Card,
  Heading,
  Label,
  Muted,
  Button,
  Progress,
} from "./ui.jsx";
import {
  projectTotals,
  milestonePaid,
  milestoneStatus,
} from "../domain/projects.js";
import { formatMoney as money } from "../locale.ts";
import { convert } from "../domain/model.ts";
import { downloadAttachment } from "../platform/files";
import { exportFile } from "../platform/runtime";
export default function ProjectDetails({ workspace: w, project: p, open }) {
  const [expanded, setExpanded] = useState(false),
    totals = projectTotals(w.state, p);
  const context = { projectId: p.id },
    edit = (kind, id, extra = {}) => open(kind, id, { ...context, ...extra });
  async function command(kind, id) {
    try {
      await w.save(kind, context, id);
    } catch (e) {
      w.setMessage(e.message);
    }
  }
  const remove = (collection, id, extra = {}) =>
    edit("projectDeleteItem", id, { collection, ...extra });
  async function download() {
    try {
      await exportFile(
        JSON.stringify(
          {
            project: p,
            totals,
            transactions: w.state.transactions.filter(
              (t) => t.projectId === p.id,
            ),
          },
          null,
          2,
        ),
        "application/json",
        `${p.name}-project.json`,
      );
    } catch (e) {
      w.setMessage(e.message);
    }
  }
  return (
    <Stack>
      <Row>
        <Button secondary onPress={() => setExpanded(!expanded)}>
          {expanded
            ? "Hide project details"
            : "Agreements, milestones & documents"}
        </Button>
        <Button secondary onPress={download}>
          Export project
        </Button>
        <Button secondary onPress={() => edit("deleteProject", p.id)}>
          Delete project
        </Button>
      </Row>
      {expanded ? (
        <Stack>
          <Card>
            <Heading>Project allocation & forecast</Heading>
            <Label>
              Contracted: {money(totals.contracted, p.currency)} · Paid:{" "}
              {money(totals.paid, p.currency)}
            </Label>
            <Label>
              Contract balance: {money(totals.owed, p.currency)} · Forecast:{" "}
              {money(totals.forecast, p.currency)}
            </Label>
            <Label>
              Contingency: {money(p.reserve, p.currency)} · Unallocated:{" "}
              {money(p.budget - p.reserve - totals.allocated, p.currency)}
            </Label>
            <Row>
              <Button secondary onPress={() => edit("projectReserve")}>
                Set contingency
              </Button>
              <Button secondary onPress={() => edit("projectCategory")}>
                New project category
              </Button>
            </Row>
            {p.categories.map((c) => (
              <Row key={c.id}>
                <Label style={{ flex: 1 }}>
                  {c.name} · {money(c.budget, p.currency)}
                </Label>
                <Button secondary onPress={() => edit("projectCategory", c.id)}>
                  Edit allocation
                </Button>
                <Button secondary onPress={() => remove("categories", c.id)}>
                  Delete allocation
                </Button>
              </Row>
            ))}
          </Card>
          <Card>
            <Heading>Vendor agreements</Heading>
            <Button
              disabled={!p.categories.length || p.archived}
              onPress={() => edit("projectContract")}
            >
              New agreement
            </Button>
            {p.contracts.map((c) => (
              <View key={c.id} style={{ gap: 8, paddingVertical: 12 }}>
                <Heading>{c.name}</Heading>
                <Muted>
                  {c.vendor} · {c.startDate || "No start date"} →{" "}
                  {c.endDate || "No end date"}
                </Muted>
                <Label>
                  Original {money(c.original, p.currency)} · Current{" "}
                  {money(
                    c.original + c.variations.reduce((n, v) => n + v.amount, 0),
                    p.currency,
                  )}
                </Label>
                <Muted>{c.notes}</Muted>
                <Row>
                  <Button
                    secondary
                    onPress={() => edit("projectContract", c.id)}
                  >
                    Edit agreement
                  </Button>
                  <Button
                    secondary
                    onPress={() =>
                      edit("projectVariation", null, { contractId: c.id })
                    }
                  >
                    Add variation
                  </Button>
                  <Button secondary onPress={() => remove("contracts", c.id)}>
                    Delete agreement
                  </Button>
                </Row>
                {c.variations.map((v) => (
                  <Row key={v.id}>
                    <Label style={{ flex: 1 }}>
                      {v.date} · {v.name} · {money(v.amount, p.currency)}
                    </Label>
                    <Button
                      secondary
                      onPress={() =>
                        remove("variations", v.id, { contractId: c.id })
                      }
                    >
                      Delete variation
                    </Button>
                  </Row>
                ))}
              </View>
            ))}
          </Card>
          <Card>
            <Heading>Milestones & scheduled payments</Heading>
            <Row>
              <Button
                disabled={!p.contracts.length || p.archived}
                onPress={() => edit("projectMilestone")}
              >
                New milestone
              </Button>
              <Button
                secondary
                disabled={!p.milestones.length || p.archived}
                onPress={() => edit("projectLink")}
              >
                Link existing expense
              </Button>
            </Row>
            {[...p.milestones]
              .sort((a, b) => a.due.localeCompare(b.due))
              .map((m) => {
                const paid = milestonePaid(w.state, p, m);
                return (
                  <View key={m.id} style={{ gap: 8, paddingVertical: 12 }}>
                    <Row style={{ justifyContent: "space-between" }}>
                      <Heading>{m.name}</Heading>
                      <Label>{milestoneStatus(w.state, p, m)}</Label>
                    </Row>
                    <Muted>
                      {m.due} ·{" "}
                      {p.contracts.find((c) => c.id === m.contractId)?.name} ·{" "}
                      {m.kind || "Milestone"}
                    </Muted>
                    <Label>
                      {money(paid, p.currency)} / {money(m.amount, p.currency)}
                    </Label>
                    <Progress value={(paid / m.amount) * 100} />
                    <Row>
                      <Button
                        disabled={paid >= m.amount || p.archived}
                        onPress={() =>
                          edit("projectPayment", null, { milestoneId: m.id })
                        }
                      >
                        Record milestone payment
                      </Button>
                      <Button
                        secondary
                        onPress={() => edit("projectMilestone", m.id)}
                      >
                        Edit milestone
                      </Button>
                      <Button
                        secondary
                        onPress={() => command("projectComplete", m.id)}
                      >
                        {m.complete ? "Mark incomplete" : "Mark completed"}
                      </Button>
                      <Button
                        secondary
                        onPress={() => remove("milestones", m.id)}
                      >
                        Delete milestone
                      </Button>
                    </Row>
                  </View>
                );
              })}
          </Card>
          <Card>
            <Heading>Linked project payments</Heading>
            {w.state.transactions
              .filter((t) => t.projectId === p.id)
              .map((t) => (
                <Row key={t.id}>
                  <Label style={{ flex: 1 }}>
                    {t.date} · {t.name} ·{" "}
                    {money(
                      convert(
                        w.state,
                        t.amount,
                        t.currency || "BHD",
                        p.currency,
                      ),
                      p.currency,
                    )}
                  </Label>
                  <Button
                    secondary
                    onPress={() => edit("editTransaction", t.id)}
                  >
                    Edit payment
                  </Button>
                  <Button
                    secondary
                    onPress={() => command("projectUnlink", t.id)}
                  >
                    Unlink payment
                  </Button>
                </Row>
              ))}
            <Muted>
              Linking or unlinking an existing payment changes project totals
              only. Account balances are unchanged.
            </Muted>
          </Card>
          <Card>
            <Heading>Project documents</Heading>
            <Button secondary onPress={() => edit("projectDocument")}>
              Attach document
            </Button>
            {p.documents.map((d) => (
              <Row key={d.id}>
                <Label style={{ flex: 1 }}>{d.name}</Label>
                <Button
                  secondary
                  onPress={() =>
                    downloadAttachment(d.file, d.fileName || d.name).catch(
                      (e) => w.setMessage(e.message),
                    )
                  }
                >
                  Download document
                </Button>
                <Button secondary onPress={() => remove("documents", d.id)}>
                  Delete document
                </Button>
              </Row>
            ))}
          </Card>
        </Stack>
      ) : null}
    </Stack>
  );
}
