#!/usr/bin/env bash
# Combines the results of the parallel device-check jobs. Each job uploads its own
# device-results folder; downloaded side by side, they sit under SRC/<artifact>/<run>/.
# Usage: merge-results.sh SRC OUT. Writes OUT/<run>/results.tsv for each run (android-branch,
# android-v1.7.1, ios-branch) that any job produced, in checklist order.
set -uo pipefail
src=$1 out=$2
order="launch-demo entry-lifecycle settings receipt lock-on-launch lock-on-return install"
for run in android-branch android-v1.7.1 ios-branch; do
  files=$(find "$src" -path "*/$run/results.tsv" 2>/dev/null)
  [ -z "$files" ] && continue
  mkdir -p "$out/$run"
  all=$(cat $files)
  : > "$out/$run/results.tsv"
  for flow in $order; do
    printf '%s\n' "$all" | awk -F'\t' -v f="$flow" '$1 == f' >> "$out/$run/results.tsv"
  done
done
