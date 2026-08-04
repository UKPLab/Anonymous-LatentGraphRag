import { ReactNode } from "react";
import DocsShell from "@/components/Docs/DocsShell";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
