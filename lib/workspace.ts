/**
 * Team workspaces + document folders — SCAFFOLD.
 *
 * This is the data layer for Phase 7 organization features. It is functional
 * (in-memory) but structurally depends on auth + a database to be real: today
 * everything is keyed by an `ownerId` that the API routes derive from the guest
 * cookie as a stand-in for a logged-in user id. When auth + Postgres land, swap
 * the in-memory maps for `teams` / `team_members` / `folders` tables and feed a
 * real user id as `ownerId` — the shapes and function signatures stay the same.
 *
 * Intentionally not Redis-backed yet: these become DB rows, not cache entries.
 */

import { randomBytes } from "crypto";

export type Team = { id: string; name: string; ownerId: string; inviteCode: string; createdAt: number };
export type Member = { teamId: string; ownerId: string; role: "owner" | "member"; joinedAt: number };
export type Folder = { id: string; ownerId: string; name: string; docIds: string[]; createdAt: number };

const teams = new Map<string, Team>();
const members = new Map<string, Member[]>(); // teamId -> members
const folders = new Map<string, Folder>();

const id = (p: string) => `${p}_${randomBytes(6).toString("base64url")}`;

// ---- Teams ----------------------------------------------------------------
export function createTeam(ownerId: string, name: string): Team {
  const team: Team = {
    id: id("team"),
    name: name.slice(0, 80) || "My team",
    ownerId,
    inviteCode: randomBytes(5).toString("base64url"),
    createdAt: Date.now(),
  };
  teams.set(team.id, team);
  members.set(team.id, [{ teamId: team.id, ownerId, role: "owner", joinedAt: Date.now() }]);
  return team;
}

export function listTeams(ownerId: string): Team[] {
  return [...teams.values()].filter(
    (t) => members.get(t.id)?.some((m) => m.ownerId === ownerId),
  );
}

export function joinTeam(ownerId: string, inviteCode: string): Team | null {
  const team = [...teams.values()].find((t) => t.inviteCode === inviteCode);
  if (!team) return null;
  const roster = members.get(team.id) ?? [];
  if (!roster.some((m) => m.ownerId === ownerId)) {
    roster.push({ teamId: team.id, ownerId, role: "member", joinedAt: Date.now() });
    members.set(team.id, roster);
  }
  return team;
}

export function teamMembers(teamId: string): Member[] {
  return members.get(teamId) ?? [];
}

// ---- Folders --------------------------------------------------------------
export function createFolder(ownerId: string, name: string): Folder {
  const folder: Folder = {
    id: id("fld"),
    ownerId,
    name: name.slice(0, 80) || "Untitled",
    docIds: [],
    createdAt: Date.now(),
  };
  folders.set(folder.id, folder);
  return folder;
}

export function listFolders(ownerId: string): Folder[] {
  return [...folders.values()]
    .filter((f) => f.ownerId === ownerId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Add a share/document id to a folder the caller owns. */
export function addToFolder(ownerId: string, folderId: string, docId: string): Folder | null {
  const folder = folders.get(folderId);
  if (!folder || folder.ownerId !== ownerId) return null;
  if (!folder.docIds.includes(docId)) folder.docIds.push(docId);
  return folder;
}
