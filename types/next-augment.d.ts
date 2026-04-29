/**
 * Module augmentation for next/navigation in Next.js 16, which reorganized
 * its type exports. These hooks are present at runtime but the dist types
 * are not in the expected path.
 */
declare module "next/navigation" {
  export function useRouter(): {
    push(href: string, options?: { scroll?: boolean }): void;
    replace(href: string, options?: { scroll?: boolean }): void;
    prefetch(href: string): void;
    back(): void;
    forward(): void;
    refresh(): void;
  };
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
  export function useParams<T extends Record<string, string | string[]> = Record<string, string>>(): T;
}

declare module "next/font/google" {
  interface FontOptions {
    weight?: string | string[];
    subsets?: string[];
    variable?: string;
    display?: "auto" | "block" | "swap" | "fallback" | "optional";
    style?: string | string[];
    preload?: boolean;
    fallback?: string[];
    adjustFontFallback?: boolean | string;
  }

  type FontFunction = (options?: FontOptions) => {
    className: string;
    style: { fontFamily: string; fontWeight?: number; fontStyle?: string };
    variable: string;
  };

  export const Geist: FontFunction;
  export const Geist_Mono: FontFunction;
  export const Inter: FontFunction;
  export const Roboto: FontFunction;
  export const JetBrains_Mono: FontFunction;
  export const Fira_Code: FontFunction;
  export const Source_Code_Pro: FontFunction;
  // Generic fallback — catches any Google Font by name
  const _default: Record<string, FontFunction>;
  export default _default;
}
