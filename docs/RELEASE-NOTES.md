# Authoring release notes

Write each release's public notes in `docs/releases/X.Y.Z.md` before starting a release. Include `## What's Changed` and concrete changes, followed by relevant download versions, upgrade instructions and known limitations. Keep mobile build versions accurate when attaching an existing APK/IPA to a newer desktop release.

The publishing scripts use the versioned file as the release description and add a public **Full Changelog** link. Only versioned release notes and their generated changelog are copied into the public downloads repository; application source remains private. A missing notes file stops release verification before platform builds start.

Use **Update release notes** in GitHub Actions to refresh an existing public release after editing its versioned notes. This updates descriptions and public Markdown only; it does not replace installers or modify the update feed.

Add a Contributors or PR list only when contributions can be verified and the linked material is accessible to download users. Do not invent contributors or expose private source links in public release notes.
