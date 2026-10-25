// The parts of GitHub's REST responses the release scripts read.
export type Repository = { private: boolean; default_branch: string };
export type Release = { id: number; tag_name: string; draft: boolean; body?: string | null; name?: string | null };
export type ReleaseAsset = { name: string; digest?: string | null };
export type GitRef = { object: { sha: string } };
export type GitCommit = { sha: string; tree: { sha: string } };
export type GitTree = { sha: string; tree: { path: string; sha: string }[] };
export type ContentFile = { name: string; content: string };
