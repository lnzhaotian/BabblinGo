import type { MediaDoc } from "@/lib/payload";

/**
 * Extract text paragraphs from a rich text body structure
 */
export function extractParagraphs(body: unknown): string[] {
  if (!body) {
    return [];
  }

  const root = (body as { root?: { children?: unknown[] } })?.root;

  if (!root || !Array.isArray(root.children)) {
    return [];
  }

  return root.children
    .map((node: any) => {
      const children = Array.isArray(node?.children) ? node.children : [];
      return children
        .map((child: any) => (typeof child?.text === "string" ? child.text : ""))
        .join("")
        .trim();
    })
    .filter(Boolean);
}

/**
 * Format a module/slide order number with leading zero
 */
export function formatOrder(order: number | null | undefined, index: number): string {
  const value = typeof order === "number" ? order : index + 1;
  return String(value).padStart(2, "0");
}

/**
 * Type guard to check if a value is a MediaDoc object
 */
export function isMediaDoc(value: MediaDoc | string | null | undefined): value is MediaDoc {
  return Boolean(value && typeof value === "object");
}
