#!/usr/bin/env bash
# CI entry point for the Android emulator: runs the given flows (default: all) on this
# branch's APK, then runs the released v1.7.1 APK only through the flows that failed, to
# tell a regression from a flow problem without doubling the run time when everything passes.
# Usage: android-ci.sh BRANCH_APK V171_APK [FLOW...]
set -uo pipefail
branch_apk=$1 v171_apk=$2
shift 2
bash tests/device/run-android.sh branch "$branch_apk" device-results/android-branch "$@"
failed=$(awk -F'\t' '$2 == "fail" { print $1 }' device-results/android-branch/results.tsv)
if [ -z "$failed" ]; then
  echo "All flows pass on this branch; skipping the v1.7.1 comparison."
  exit 0
fi
# lock-on-return needs the background state lock-on-launch leaves behind.
case " $(echo $failed) " in *" lock-on-return "*) failed="$failed lock-on-launch";; esac
bash tests/device/run-android.sh v1.7.1 "$v171_apk" device-results/android-v1.7.1 $failed
