// The parts of the untyped `xcode` package (node-xcode) this repository uses: verify-ios-inputs,
// and the Expo plugin (Expo types its Xcode project with this module).
declare module "xcode" {
  /** A pbxproj section: objects by id, plus "<id>_comment" string entries. */
  type Section<T> = Record<string, T | string | undefined>;
  export type PbxGroup = { sourceTree?: string; path?: string; children?: { value: string }[] };
  export type PbxFile = { sourceTree?: string; path?: string };
  export type PbxObjects = {
    PBXGroup?: Section<PbxGroup>;
    PBXVariantGroup?: Section<PbxGroup>;
    PBXFileReference?: Section<PbxFile>;
    PBXSourcesBuildPhase?: Section<{ files?: { value: string }[] }>;
    PBXBuildFile: Section<{ fileRef?: string }>;
  };
  export interface XcodeProject {
    parseSync(): void;
    hash: { project: { objects: PbxObjects } };
    getFirstProject(): { firstProject: { mainGroup: string } };
    /** File references by id, plus "<id>_comment" strings. */
    pbxFileReferenceSection(): Record<string, unknown>;
  }
  const xcode: { project(path: string): XcodeProject };
  export default xcode;
}
