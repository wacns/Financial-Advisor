# Authoring release notes

Write each release's public notes in `docs/releases/X.Y.Z.md` before starting a release. Include `## What's Changed` and concrete changes, followed by relevant download versions, upgrade instructions and known limitations. Keep mobile build versions accurate when attaching an existing APK/IPA to a newer desktop release.

The workflows generate the **What's Changed** list from the real source commit range, preferring merged PRs and deduplicating PR entries. Direct pushes fall back to commit entries. Each entry uses the verified GitHub author and commit/PR link. The authored changes remain under **Release highlights**, alongside your download and signing details. **Full Changelog** links to the actual source comparison; a separate **Public release history** link opens the public Markdown history. Commit, PR and source comparison links require private repository access. A missing notes file stops release verification before platform builds start.

Use **Update release notes** in GitHub Actions to refresh an existing public release after editing its versioned notes. This updates descriptions and public Markdown only; it does not replace installers or modify the update feed.

Source history is generated with the private repository's built-in Actions token (`Contents: read`, `Pull requests: read`). Publishing uses the separate `RELEASES_TOKEN`. The public `release-history/X.Y.Z.json` stores only the source repository/ref names, SHAs, change titles, author logins and commit/PR URLs; it never contains source files, patches or API credentials.

Existing history snapshots keep refreshes tied to the original release's source commits. New versions automatically compare against the previous published history snapshot and use the source version tag when present, otherwise the build commit SHA. The historical desktop v1.6.1 bootstrap is recorded in `docs/releases/history.json` and points to the verified build commit, using the private `desktop-v1.6.1` tag. Do not move published history tags. Do not invent contributors or PR numbers.
