import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import xcode from "xcode";
import type { PbxObjects } from "xcode";
import { must } from "../src/guards.ts";

/** An object entry of a pbxproj section; the "<id>_comment" strings beside them are skipped. */
const entry = <T>(section: Record<string, T | string | undefined> | undefined, id: string | undefined): T | undefined => {
  const value = id === undefined ? undefined : section?.[id];
  return typeof value === "object" ? value : undefined;
};
const unquote = (value: unknown) => String(value || "").replace(/^"|"$/g, "");
export function sourceInputs(objects: PbxObjects, mainGroup: string, root: string): string[] {
  const paths = new Map<string | undefined, string>();
  function walk(id: string, parent: string) {
    const group = entry(objects.PBXGroup, id) || entry(objects.PBXVariantGroup, id);
    if (group) {
      const base = unquote(group.sourceTree) === "SOURCE_ROOT" ? root : parent;
      const directory = path.resolve(base, unquote(group.path));
      for (const child of group.children || []) walk(child.value, directory);
      return;
    }
    const file = entry(objects.PBXFileReference, id);
    if (!file || !["<group>", "SOURCE_ROOT"].includes(unquote(file.sourceTree)))
      return;
    paths.set(
      id,
      path.resolve(
        unquote(file.sourceTree) === "SOURCE_ROOT" ? root : parent,
        unquote(file.path),
      ),
    );
  }
  walk(mainGroup, root);
  return Object.values(objects.PBXSourcesBuildPhase || {})
    .filter((phase) => typeof phase === "object")
    .flatMap((phase) => phase.files || [])
    // A project without a PBXBuildFile section failed this check before, and still does.
    .map((file) => entry(must(objects.PBXBuildFile, "PBXBuildFile section"), file.value)?.fileRef)
    .map((id) => paths.get(id))
    .filter((file): file is string => Boolean(file));
}
export function verifyIOSInputs(directory = "ios") {
  const root = path.resolve(directory);
  const name = fs.readdirSync(root).find((name) => name.endsWith(".xcodeproj"));
  if (!name)
    throw Error("Generate the iOS project before verifying source inputs.");
  const project = xcode.project(path.join(root, name, "project.pbxproj"));
  project.parseSync();
  const sources = sourceInputs(
    project.hash.project.objects,
    project.getFirstProject().firstProject.mainGroup,
    root,
  );
  const intent = sources.filter(
    (file) => path.basename(file) === "FinancialAdvisorIntents.swift",
  );
  if (intent.length !== 1)
    throw Error("Shortcuts must have exactly one app source build input.");
  for (const file of sources) {
    // CocoaPods creates its provider after prebuild; verify app-owned inputs.
    if (file.includes(`${path.sep}Pods${path.sep}`)) continue;
    if (!fs.existsSync(file))
      throw Error(`Xcode source build input is missing: ${file}`);
  }
  console.log(
    `Verified ${sources.length} Xcode source inputs, including the Shortcuts file.`,
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  verifyIOSInputs(process.argv[2]);
