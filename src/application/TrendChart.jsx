import React from "react";
import { View } from "react-native";
import { Card, Heading, Label, Muted, Row, colors } from "./ui.jsx";
import { monthlyTrend } from "../reports.js";
import { formatDate, formatMoney as money } from "../locale.js";
export default function TrendChart({ state, month }) {
  const trend = monthlyTrend(state, month),
    maximum = Math.max(
      ...trend.flatMap((row) => [row.income, row.expenses]),
      1,
    );
  return (
    <Card testID="trend-details">
      <Heading>Your last six months</Heading>
      <Muted>
        Income and spending from recorded transactions. Transfers are excluded.
      </Muted>
      {trend.map((row) => (
        <View
          testID="trend-row"
          key={row.month}
          style={{
            gap: 8,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Row style={{ justifyContent: "space-between" }}>
            <Label>
              {formatDate(`${row.month}-15`, {
                month: "short",
                year: "numeric",
              })}
            </Label>
            <Muted>
              In {money(row.income)} · Out {money(row.expenses)}
            </Muted>
          </Row>
          <View
            style={{
              height: 8,
              borderRadius: 5,
              width: `${(row.income / maximum) * 100}%`,
              backgroundColor: "#4c7b61",
            }}
          />
          <View
            style={{
              height: 8,
              borderRadius: 5,
              width: `${(row.expenses / maximum) * 100}%`,
              backgroundColor: colors.accent,
            }}
          />
        </View>
      ))}
    </Card>
  );
}
