"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { LumenWordmark } from "./wordmark";
import { ThemeToggle } from "./theme-toggle";
import { hydratePreferences } from "@/lib/search/preferences-store";
import { SearchProvider } from "@/features/search/search-context";
const links = [
  ["/search", "Search"],
  ["/workspace", "Workspace"],
  ["/saved", "Saved"],
  ["/profiles", "Profiles"],
  ["/settings", "Settings"],
];
export function ApplicationShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    hydratePreferences();
  }, []);
  const pathname = usePathname(),
    drawer = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    drawer.current?.close();
  }, [pathname]);
  const nav = (mobile = false) => (
    <nav
      aria-label={mobile ? "Mobile navigation" : "Main navigation"}
      className={mobile ? "mobile-links" : "desktop-links"}
    >
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          onClick={() => drawer.current?.close()}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
  return (
    <SearchProvider>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="app-header">
        <div className="header-inner">
          <Link href="/" aria-label="Lumen home">
            <LumenWordmark size="md" />
          </Link>
          <span className="edition">SEARCH WORKSTATION / 03</span>
          {nav()}
          <ThemeToggle />
          <button
            ref={trigger}
            className="lumen-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => drawer.current?.showModal()}
          >
            <Menu size={18} />
          </button>
        </div>
      </header>
      <dialog
        ref={drawer}
        className="navigation-drawer"
        aria-label="Navigation"
        onClose={() => trigger.current?.focus()}
        onClick={(e) => {
          if (e.target === e.currentTarget) drawer.current?.close();
        }}
      >
        <div className="drawer-heading">
          <LumenWordmark />
          <button
            className="lumen-button"
            aria-label="Close navigation"
            onClick={() => drawer.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        {nav(true)}
        <p className="text-sm text-muted-foreground mt-8">
          Your research stays on this device.
        </p>
      </dialog>
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
      <footer className="app-footer">
        <span>Independent sources. Local research.</span>
        <Link href="/settings">Privacy & preferences</Link>
      </footer>
    </SearchProvider>
  );
}
