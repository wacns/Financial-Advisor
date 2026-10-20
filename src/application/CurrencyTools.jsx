import { requestJSON } from "../platform/http.js";
import React, { useState } from "react";
import { Linking } from "react-native";
import Field from "./Field";
import { Button, Card, Heading, Label, Muted, Row, Stack } from "./ui.jsx";
import { currencyCodes, convert } from "../domain/model.ts";
import { exchangeSnapshot } from "../domain/currency-tools.ts";
import { formatMoney as money, bahrainDate } from "../locale.ts";
export default function CurrencyTools({ workspace: w, open }) {
  const [amount, setAmount] = useState("1"),
    [from, setFrom] = useState("BHD"),
    [to, setTo] = useState("USD"),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [area, setArea] = useState("Manama, Bahrain");
  let result, conversionError;
  try {
    result = convert(w.state, amount, from, to);
  } catch (e) {
    conversionError = e.message;
  }
  async function fetchRates() {
    setBusy(true);
    setError("");
    try {
      const response = await requestJSON(
        "https://open.er-api.com/v6/latest/BHD",
      );
      setPreview(exchangeSnapshot(response));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    setBusy(true);
    setError("");
    try {
      await w.save("refreshRates", preview);
      setPreview(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack>
      <Card>
        <Heading>Find an ATM</Heading>
        <Field label="ATM search area" value={area} onChange={setArea} />
        <Button
          secondary
          disabled={!area.trim()}
          onPress={() =>
            Linking.openURL(
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`ATMs near ${area.trim().slice(0, 200)}`)}`,
            ).catch(() => setError("Unable to open maps on this device."))
          }
        >
          Open ATM map
        </Button>
        <Muted>
          Opens Google Maps with the area you enter. No account or transaction
          data is shared. Check the bank's fees and opening hours in Maps.
        </Muted>
      </Card>
      <Card>
        <Heading>Currency calculator</Heading>
        <Row>
          <Field
            label="Convert amount"
            type="number"
            value={amount}
            onChange={setAmount}
          />
          <Field
            label="From currency"
            type="select"
            value={from}
            onChange={setFrom}
            options={currencyCodes}
          />
          <Field
            label="To currency"
            type="select"
            value={to}
            onChange={setTo}
            options={currencyCodes}
          />
        </Row>
        {conversionError ? (
          <Muted>{conversionError}</Muted>
        ) : (
          <Label style={{ fontSize: 30, fontWeight: "600" }}>
            {money(result, to)}
          </Label>
        )}
        <Muted>
          Uses your saved BHD-per-unit rates. Calculations do not post
          transactions.
        </Muted>
      </Card>
      <Card>
        <Heading>Exchange rate tracker</Heading>
        <Muted>
          {w.state.settings.ratesAsOf
            ? `${w.state.settings.ratesSource} · Quote date ${w.state.settings.ratesAsOf}`
            : "Your saved rates are manual or illustrative defaults."}
        </Muted>
        <Row>
          <Button disabled={busy} onPress={fetchRates}>
            {busy ? "Loading quotes…" : "Fetch latest quotes"}
          </Button>
          <Button secondary onPress={() => open("rates")}>
            Edit manual rates
          </Button>
          <Button
            secondary
            onPress={() =>
              Linking.openURL("https://www.exchangerate-api.com").catch(() =>
                setError("Unable to open the rate provider website."),
              )
            }
          >
            Rates by ExchangeRate-API
          </Button>
        </Row>
        <Muted>
          Quotes from ExchangeRate-API (open.er-api.com) are reference rates,
          usually updated daily. Fetching sends no account, transaction or
          balance data. Review the date before applying; your bank's actual rate
          may differ.
        </Muted>
        {error ? <Label accessibilityRole="alert">{error}</Label> : null}
        {preview ? (
          <Stack>
            <Heading>Review exchange quotes</Heading>
            <Label>
              Quote date: {preview.asOf}
              {preview.asOf < bahrainDate() ? " · Earlier quote date" : ""}
            </Label>
            {currencyCodes.map((code) => (
              <Row key={code} style={{ justifyContent: "space-between" }}>
                <Label>{code}</Label>
                <Muted>
                  1 {code} = {preview.rates[code].toFixed(6)} BHD
                </Muted>
              </Row>
            ))}
            <Muted>
              Applying updates reporting conversions and future transfer
              estimates. Stored transaction amounts and account currencies are
              preserved.
            </Muted>
            <Row>
              <Button disabled={busy || w.saving} onPress={apply}>
                Apply reviewed rates
              </Button>
              <Button secondary onPress={() => setPreview(null)}>
                Discard quotes
              </Button>
            </Row>
          </Stack>
        ) : null}
      </Card>
      <Card>
        <Heading>Saved quote history</Heading>
        {(w.state.settings.rateHistory || [])
          .slice()
          .reverse()
          .map((row) => (
            <Muted key={`${row.asOf}-${row.savedAt}`}>
              {row.asOf} · {row.source} · 1 USD = {row.rates.USD.toFixed(6)} BHD
            </Muted>
          ))}
        {!w.state.settings.rateHistory?.length ? (
          <Muted>
            Reviewed provider quotes appear here after you apply them.
          </Muted>
        ) : null}
      </Card>
    </Stack>
  );
}
