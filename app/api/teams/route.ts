import { NextRequest, NextResponse } from "next/server";
import { createTeam, listTeams, joinTeam, teamMembers } from "@/lib/workspace";
import { ownerFrom, withOwnerCookie } from "@/lib/owner";

/**
 * Team workspaces (SCAFFOLD — in-memory, owner = guest cookie until auth).
 *   GET                       -> teams the caller belongs to
 *   POST { name }             -> create a team (returns invite code)
 *   POST { inviteCode }       -> join a team by code
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { ownerId, setId } = ownerFrom(req);
  const teams = listTeams(ownerId).map((t) => ({
    ...t,
    members: teamMembers(t.id).length,
  }));
  return withOwnerCookie(NextResponse.json({ teams }), setId);
}

export async function POST(req: NextRequest) {
  const { ownerId, setId } = ownerFrom(req);
  let body: { name?: string; inviteCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.inviteCode) {
    const team = joinTeam(ownerId, body.inviteCode);
    if (!team) return NextResponse.json({ error: "Invalid invite code." }, { status: 404 });
    return withOwnerCookie(NextResponse.json({ team }), setId);
  }

  if (body.name) {
    const team = createTeam(ownerId, body.name);
    return withOwnerCookie(NextResponse.json({ team }), setId);
  }

  return NextResponse.json({ error: "Provide a name or inviteCode." }, { status: 400 });
}
