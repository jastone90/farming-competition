import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border py-4 px-6 text-center flex items-center justify-center gap-4">
      <Link
        href="/audit"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Audit Log
      </Link>
      <Link
        href="/changelog"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Changelog
      </Link>
    </footer>
  );
}
