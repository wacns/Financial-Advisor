import test from "node:test";
import assert from "node:assert/strict";
import { historyEntries, historyMarkdown, sourceRepository } from "../../scripts/release-history.ts";
import { releaseNotes } from "../../scripts/release-notes.ts";
import type { GitHubPull, HistoryEntry } from "../../scripts/release-history.ts";
import { partial } from "../support.ts";
import { must } from "../../src/guards.ts";
const a="a".repeat(40), b="b".repeat(40), c="c".repeat(40);
const commit=(sha: string,title: string)=>({sha,commit:{message:title},author:{login:"wacns"}});
const metadata=(entries: HistoryEntry[])=>({version:"1.6.1",sourceRepository,baseRef:"v1.6.0",headRef:"desktop-v1.6.1",baseSha:a,headSha:c,entries});
test("merged PRs are listed once and direct commits keep their real author and links",()=>{
  const pr={number:23,title:"Fix updater",merged_at:"2026-10-20T00:00:00Z",merge_commit_sha:b,user:{login:"wacns"}};
  const entries=historyEntries([commit(a,"First PR commit"),commit(b,"Second PR commit"),commit(c,"Direct change")],{[a]:[pr],[b]:[pr]});
  assert.equal(entries.length,2);
  assert.equal(entries[0]?.type,"pull");
  assert.equal(entries[0]?.number,23);
  assert.equal(entries[1]?.sha,c);
  const rendered=historyMarkdown(metadata(entries));
  assert.match(rendered.changes,/Fix updater by @wacns in \[#23\]/);
  assert.match(rendered.changes,/Direct change by @wacns/);
});
test("unmerged PRs and PRs merged after the release head do not hide direct commits",()=>{
  const entries=historyEntries([commit(a,"Released change")],{[a]:partial<GitHubPull[]>([{number:2,merged_at:null},{number:3,merged_at:"2026-10-20",merge_commit_sha:b}])});
  assert.deepEqual(entries.map(e=>e.type),["commit"]);
});
test("generated notes include the exact private source comparison and preserve download details",()=>{
  const history=metadata(historyEntries([commit(c,"Real change")],{}));
  const notes=releaseNotes("1.6.1",history);
  assert.match(notes,/## What's Changed\n\n- Real change by @wacns/);
  assert.match(notes,/\*\*Full Changelog\*\*: https:\/\/github.com\/wacns\/Financial-Advisor\/compare\/v1.6.0\.\.\.desktop-v1.6.1/);
  assert.match(notes,/links require access to the private source repository/);
  assert.match(notes,/\| Android \| APK \/ AAB \| 1\.6\.0 \|/);
  assert.match(notes,/## Release highlights/);
});
test("history rendering escapes titles and rejects unexpected source links",()=>{
  const history=metadata(historyEntries([commit(c,"Fix <img> [title]")],{}));
  assert.ok(historyMarkdown(history).changes.includes("\\<img\\> \\[title\\]"));
  must(history.entries[0], "history entry").url="https://example.com/fake-commit";
  assert.throws(()=>historyMarkdown(history),/Invalid history entry link/);
});
