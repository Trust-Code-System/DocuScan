import type { Metadata } from "next";
import ToolGrid from "@/components/ToolGrid";

export const metadata: Metadata = {
  title: "All Document Tools",
  description: "Everything you need to edit, convert, and manage your documents in one place.",
};

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-12 text-center">
        <h1 className="mb-4 text-balance text-4xl font-bold tracking-tight text-ink">
          All Document Tools
        </h1>
        <p className="mx-auto max-w-2xl text-pretty text-lg text-slate-600">
          Everything you need to edit, convert, and manage your documents in one place.
        </p>
      </header>
      <ToolGrid />
    </div>
  );
}
