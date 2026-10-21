#!/usr/bin/env bash
# Runs the device checklist flows against one .app on a booted iOS simulator.
# Usage: run-ios.sh LABEL APP_PATH UDID OUTDIR. Writes OUTDIR/results.tsv like run-android.sh.
# The simulator has no passcode, so the privacy-lock flows run on Android only.
set -uo pipefail
label=$1 app_path=$2 udid=$3 out=$4
app=com.wacns.financialadvisor
flows=tests/device/flows
mkdir -p "$out"
: > "$out/results.tsv"
echo "== $label: $app_path"
xcrun simctl uninstall "$udid" "$app" > /dev/null 2>&1 || true
xcrun simctl install "$udid" "$app_path" || { echo -e "install\tfail" >> "$out/results.tsv"; exit 0; }
xcrun simctl addmedia "$udid" tests/device/receipt.png || true

run() {
  local name=$1
  if maestro --device "$udid" test --test-output-dir "$out/$name" "$flows/$name.yaml" > "$out/$name.log" 2>&1; then
    echo -e "$name\tpass" >> "$out/results.tsv"
  else
    echo -e "$name\tfail" >> "$out/results.tsv"
    xcrun simctl spawn "$udid" log show --last 5m --predicate 'process == "FinancialAdvisor"' > "$out/$name.syslog.txt" 2>&1 || true
  fi
  echo "$name: $(tail -n 1 "$out/results.tsv" | cut -f2)"
}
run launch-demo
run entry-lifecycle
run settings
run receipt
