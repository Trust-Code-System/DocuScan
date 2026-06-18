import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("templates");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
