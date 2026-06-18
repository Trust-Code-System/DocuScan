import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("slides");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
