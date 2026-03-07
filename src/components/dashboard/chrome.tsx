import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { MoonStar, RefreshCw, SunMedium } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Theme } from "@/components/dashboard/types";
import styles from "@/components/dashboard/chrome.module.css";

type SummaryItem = {
  label: string;
  value: string;
};

type RouteLink = {
  href: string;
  label: string;
  note: string;
  icon: LucideIcon;
  active: boolean;
};

export type MastheadProps = {
  eyebrow: string;
  title: string;
  description: string;
  summaryItems: SummaryItem[];
  hasUnsavedChanges: boolean;
  isBusy: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  onRefresh: () => void;
};

export type FilterDockProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions: ReactNode;
  footer: ReactNode;
  children: ReactNode;
};

export type RouteRailProps = {
  title: string;
  description: string;
  links: RouteLink[];
};

type DashboardChromeProps = {
  masthead: ReactNode;
  routeRail: ReactNode;
  filterDock: ReactNode;
  children: ReactNode;
};

export function DashboardChrome({ masthead, routeRail, filterDock, children }: DashboardChromeProps) {
  return (
    <div className={styles.frame}>
      {masthead}
      <div className={styles.layout}>
        <aside className={styles.routeColumn}>{routeRail}</aside>
        <div className={styles.stage}>
          {filterDock}
          <div className={styles.stageContent}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Masthead({
  eyebrow,
  title,
  description,
  summaryItems,
  hasUnsavedChanges,
  isBusy,
  theme,
  onToggleTheme,
  onRefresh,
}: MastheadProps) {
  return (
    <header className={styles.masthead}>
      <div className={styles.mastheadCopy}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </div>

      <div className={styles.statusStack}>
        <div className={styles.statusRow}>
          {hasUnsavedChanges && <span className={styles.alertPill}>Draft filters pending</span>}
          <span className={clsx(styles.statePill, isBusy && styles.statePillBusy)}>
            {isBusy ? "Feeds updating" : "Desk live"}
          </span>
          <button
            type="button"
            className={styles.utilityButton}
            onClick={onRefresh}
            aria-label="Refresh current route"
          >
            <RefreshCw className={clsx(styles.utilityIcon, isBusy && styles.utilitySpin)} />
            Refresh
          </button>
          <button
            type="button"
            className={styles.utilityButton}
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <SunMedium className={styles.utilityIcon} /> : <MoonStar className={styles.utilityIcon} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>

        <dl className={styles.summaryGrid}>
          {summaryItems.map((item) => (
            <div key={item.label} className={styles.summaryCard}>
              <dt className={styles.summaryLabel}>{item.label}</dt>
              <dd className={styles.summaryValue}>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}

export function FilterDock({ eyebrow, title, description, actions, footer, children }: FilterDockProps) {
  return (
    <section className={styles.filterDock} aria-label="Filter dock">
      <div className={styles.filterIntro}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 className={styles.filterTitle}>{title}</h2>
          <p className={styles.filterDescription}>{description}</p>
        </div>
        <div className={styles.filterActions}>{actions}</div>
      </div>

      <div className={styles.filterBody}>{children}</div>
      <div className={styles.filterFooter}>{footer}</div>
    </section>
  );
}

export function RouteRail({ title, description, links }: RouteRailProps) {
  return (
    <nav className={styles.routeRail} aria-label="Desk routes">
      <div className={styles.routeIntro}>
        <p className={styles.eyebrow}>Navigation</p>
        <h2 className={styles.routeTitle}>{title}</h2>
        <p className={styles.routeDescription}>{description}</p>
      </div>

      <div className={styles.routeList}>
        {links.map((link) => {
          const Icon = link.icon;

          return (
            <Link
              key={link.label}
              href={link.href}
              className={clsx(styles.routeLink, link.active && styles.routeLinkActive)}
              aria-current={link.active ? "page" : undefined}
            >
              <span className={styles.routeIconWrap}>
                <Icon className={styles.routeIcon} />
              </span>
              <span className={styles.routeText}>
                <span className={styles.routeLabel}>{link.label}</span>
                <span className={styles.routeNote}>{link.note}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
