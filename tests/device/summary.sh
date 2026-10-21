#!/usr/bin/env bash
# Prints a Markdown table of flow results for one or more runs.
# Usage: summary.sh TITLE "LABEL=OUTDIR" ["LABEL=OUTDIR" ...]
set -uo pipefail
title=$1; shift
labels=() dirs=()
for pair in "$@"; do labels+=("${pair%%=*}"); dirs+=("${pair#*=}"); done
echo "### $title"
echo
header="| Checklist flow |"; rule="|---|"
for l in "${labels[@]}"; do header+=" $l |"; rule+="---|"; done
echo "$header"; echo "$rule"
flows=$(for d in "${dirs[@]}"; do cut -f1 "$d/results.tsv" 2>/dev/null; done | awk '!seen[$0]++')
for flow in $flows; do
  row="| $flow |"
  for d in "${dirs[@]}"; do
    result=$(awk -F'\t' -v f="$flow" '$1 == f { print $2 }' "$d/results.tsv" 2>/dev/null)
    case "$result" in pass) row+=" ✅ pass |";; fail) row+=" ❌ fail |";; *) row+=" – |";; esac
  done
  echo "$row"
done
echo
