"use client";

import { PDFDocument } from "@cantoo/pdf-lib";

/**
 * Add a password to a PDF (client-side, via @cantoo/pdf-lib's encryption).
 * The same password is set as both the user (open) and owner password, so the
 * document simply requires the password to open.
 *
 * Throws if the PDF is already encrypted — you can't re-protect without first
 * unlocking it.
 */
export async function protectPdf(buf: ArrayBuffer, password: string): Promise<Uint8Array> {
  if (!password) throw new Error("Enter a password first.");

  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  if (doc.isEncrypted) {
    throw new Error(
      "This PDF is already password-protected. Unlock it first if you want to change the password.",
    );
  }

  doc.encrypt({ userPassword: password, ownerPassword: password });
  return doc.save();
}

/**
 * Remove the password from an encrypted PDF, given the correct password.
 * Returns a decrypted copy. Throws a friendly message if the file isn't
 * protected or the password is wrong.
 */
export async function unlockPdf(buf: ArrayBuffer, password: string): Promise<Uint8Array> {
  if (!password) throw new Error("Enter the PDF's password first.");

  // Probe (ignoring encryption) to tell "not protected" from "wrong password".
  const probe = await PDFDocument.load(buf, { ignoreEncryption: true });
  if (!probe.isEncrypted) {
    throw new Error("This PDF isn't password-protected — there's nothing to unlock.");
  }

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(buf, { password });
  } catch {
    throw new Error("Incorrect password. Check it and try again.");
  }

  // Saving a doc loaded with the password (and not re-encrypted) yields plaintext.
  return doc.save();
}
