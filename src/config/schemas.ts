import { z } from "zod";

export const AgentSchema = z.object({
  name: z.string().min(1),
  bin: z.string().min(1),
});

export const ConfigSchema = z.object({
  agents: z.array(AgentSchema),
  defaultAgent: z.string().optional(),
});

export const RemoteSourceSchema = z.object({
  kind: z.literal("remote"),
  url: z.string().min(1),
});

export const LocalSourceSchema = z.object({
  kind: z.literal("local"),
  path: z.string().min(1),
});

export const SubpathSourceSchema = z.object({
  kind: z.literal("subpath"),
  url: z.string().min(1),
  subpath: z.string().min(1),
});

export const RepoSourceSchema = z.discriminatedUnion("kind", [
  RemoteSourceSchema,
  LocalSourceSchema,
  SubpathSourceSchema,
]);

export const RepoEntrySchema = z.object({
  name: z.string().min(1),
  source: RepoSourceSchema,
});

export const ProjectSchema = z.object({
  name: z.string().min(1),
  workspacePath: z.string().min(1),
  type: z.enum(["monorepo", "multirepo"]),
  repos: z.array(RepoEntrySchema),
});

export type Agent = z.infer<typeof AgentSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type RemoteSource = z.infer<typeof RemoteSourceSchema>;
export type LocalSource = z.infer<typeof LocalSourceSchema>;
export type SubpathSource = z.infer<typeof SubpathSourceSchema>;
export type RepoSource = z.infer<typeof RepoSourceSchema>;
export type RepoEntry = z.infer<typeof RepoEntrySchema>;
export type Project = z.infer<typeof ProjectSchema>;
