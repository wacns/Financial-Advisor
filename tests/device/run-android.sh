#!/usr/bin/env bash
# Runs the device checklist flows against one APK on the running Android emulator.
# Usage: run-android.sh LABEL APK OUTDIR. Writes OUTDIR/results.tsv (flow, pass|fail); a
# failing flow does not stop the others, so one run reports the whole checklist.
set -uo pipefail
label=$1 apk=$2 out=$3
app=com.wacns.financialadvisor
flows=tests/device/flows
mkdir -p "$out"
: > "$out/results.tsv"
echo "== $label: $apk"
# The emulator can report boot completed while its system services are still starting
# ("Can't find service: package"), so wait for the package manager, and retry the install.
for _ in $(seq 60); do adb shell pm path android > /dev/null 2>&1 && break; sleep 5; done
adb uninstall "$app" > /dev/null 2>&1 || true
adb shell locksettings clear --old 1111 > /dev/null 2>&1 || true
installed=false
for attempt in 1 2 3; do
  if adb install -r "$apk"; then installed=true; break; fi
  echo "install attempt $attempt failed; waiting for the emulator"
  adb wait-for-device
  for _ in $(seq 60); do adb shell pm path android > /dev/null 2>&1 && break; sleep 5; done
done
$installed || { echo -e "install\tfail" >> "$out/results.tsv"; exit 0; }

# The receipt the OCR flow picks, added to the photo library.
adb push tests/device/receipt.png /sdcard/Pictures/receipt.png > /dev/null
adb shell content call --method scan_volume --uri content://media --arg external_primary > /dev/null 2>&1 || true
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/receipt.png > /dev/null 2>&1 || true

run() {
  local name=$1
  if maestro test --test-output-dir "$out/$name" "$flows/$name.yaml" > "$out/$name.log" 2>&1; then
    echo -e "$name\tpass" >> "$out/results.tsv"
  else
    echo -e "$name\tfail" >> "$out/results.tsv"
    adb logcat -d -t 400 > "$out/$name.logcat.txt" 2>&1 || true
  fi
  echo "$name: $(tail -n 1 "$out/results.tsv" | cut -f2)"
}
run launch-demo
run entry-lifecycle
run settings
run receipt
# The privacy lock only engages when the device has a credential.
adb shell locksettings set-pin 1111 > /dev/null
run lock-on-launch
sleep 65
run lock-on-return
adb shell locksettings clear --old 1111 > /dev/null 2>&1 || true
