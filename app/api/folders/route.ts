import { NextRequest, NextResponse } from "next/server";
import { createFolder, listFolders, addToFolder } from "@/lib/workspace";
import { ownerFrom, withOwnerCookie } from "@/lib/owner";

/**
 * Document folders (SCAFFOLD — in-memory, owner = guest cookie until auth).
 *   GET                          -> the caller's folders
 *   POST { name }                -> create a folder
 *   POST { folderId, docId }     -> add a share/document id to a folder
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { ownerId, setId } = ownerFrom(req);
  return withOwnerCookie(NextResponse.json({ folders: listFolders(ownerId) }), setId);
}

export async function POST(req: NextRequest) {
  const { ownerId, setId } = ownerFrom(req);
  let body: { name?: string; folderId?: string; docId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.folderId && body.docId) {
    const folder = addToFolder(ownerId, body.folderId, body.docId);
    if (!folder) return NextResponse.json({ error: "Folder not found." }, { status: 404 });
    return withOwnerCookie(NextResponse.json({ folder }), setId);
  }

  if (body.name) {
    return withOwnerCookie(NextResponse.json({ folder: createFolder(ownerId, body.name) }), setId);
  }

  return NextResponse.json({ error: "Provide a name, or folderId + docId." }, { status: 400 });
}
