FinancialAdvisor now packages the shared React application for Android, iOS, Windows, macOS and Linux.

- Android: APK for direct installation and AAB for later Play Store distribution. Files marked `preview` use the Expo testing key, not a production signing identity. Do not submit those AABs to the Play Store.
- iOS: unsigned Release IPA with embedded JavaScript. It requires signing before installation; it is not a TestFlight download.
- Windows: x64 EXE installer.
- macOS: DMG and ZIP for Apple Silicon and Intel Macs. Current preview builds are not Developer ID signed/notarized; Gatekeeper may block them.
- Linux: x64 AppImage and DEB. Make an AppImage executable before opening; some distributions need FUSE compatibility support.
- `SHA256SUMS.txt` contains checksums for the release files.

Mobile compatible JavaScript/assets updates use Expo Updates when this build has a configured EAS project. Native SDK, permissions or module changes require a new binary. Desktop background downloads require a configured reachable HTTPS update feed; they never embed a GitHub access token. Settings reports whether updates are connected and asks you to restart before installing a downloaded update.

This is a preview release. Signing, store distribution and physical-device checks are separate from successful packaging. See `docs/RELEASES.md` in the repository for setup, supported architectures and update requirements. Your signed-in financial workspace syncs through the existing backend; demo data remains local to each installation.
