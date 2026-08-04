import { ReactNode } from "react";

export default function InlineCode({ children }: { children?: ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 mx-0.5 text-[0.875em] font-mono bg-gray-100 text-gray-800 rounded-md border border-gray-200">
      {children}
    </code>
  );
}
