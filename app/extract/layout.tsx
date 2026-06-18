import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("extract");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
