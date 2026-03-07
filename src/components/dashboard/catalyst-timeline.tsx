import clsx from "clsx";
import styles from "@/components/dashboard/context-view.module.css";
import type { EventApi, FocusWindow } from "@/components/dashboard/types";
import { formatDateTime } from "@/components/dashboard/utils";

type CatalystTimelineProps = {
  events: EventApi[];
  window: FocusWindow;
  onWindowChange: (window: FocusWindow) => void;
  focusLab?: string;
};

type Bucket = {
  key: string;
  label: string;
  events: EventApi[];
};

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function bucketForEvent(event: EventApi, window: FocusWindow): { key: string; label: string } {
  const date = new Date(event.publishedAt);
  if (Number.isNaN(date.getTime())) {
    return { key: "unknown", label: "Unknown Date" };
  }

  if (window === "1w") {
    const weekStart = startOfWeek(date);
    const key = weekStart.toISOString().slice(0, 10);
    const label = `Week of ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    return { key, label };
  }

  if (window === "1m") {
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return { key, label };
  }

  const key = date.toISOString().slice(0, 10);
  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return { key, label };
}

function groupEvents(events: EventApi[], window: FocusWindow): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const event of events) {
    const bucket = bucketForEvent(event, window);
    if (!map.has(bucket.key)) {
      map.set(bucket.key, { key: bucket.key, label: bucket.label, events: [] });
    }
    map.get(bucket.key)?.events.push(event);
  }

  return [...map.values()]
    .sort((left, right) => right.key.localeCompare(left.key))
    .map((bucket) => ({
      ...bucket,
      events: [...bucket.events].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt)).slice(0, 8),
    }))
    .slice(0, 8);
}

export function CatalystTimeline({ events, window, onWindowChange, focusLab }: CatalystTimelineProps) {
  const filtered = focusLab ? events.filter((event) => event.labId === focusLab) : events;
  const buckets = groupEvents(filtered, window);

  return (
    <>
      <div className={styles.timelineControlRow}>
        <p className={styles.chartLead}>
          Grouped by {window === "1d" ? "day" : window === "1w" ? "week" : "month"} to expose clustered release bursts and quieter stretches.
        </p>
        <div className={styles.timelineWindowButtons} role="group" aria-label="Timeline window">
          {(["1d", "1w", "1m"] as const).map((option) => {
            const active = option === window;
            return (
              <button
                key={option}
                type="button"
                className={clsx(styles.windowButton, active && styles.windowButtonActive)}
                aria-pressed={active}
                onClick={() => onWindowChange(option)}
              >
                {option.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {buckets.length === 0 ? (
        <p className={styles.timelineEmpty}>
          No catalysts available for this focus. Change lab focus or widen date range to recover the timeline.
        </p>
      ) : (
        <div className={styles.timelineGroups}>
          {buckets.map((bucket) => (
            <article className={styles.timelineGroup} key={bucket.key}>
              <h3 className={styles.timelineGroupTitle}>{bucket.label}</h3>
              <ul className={styles.timelineList}>
                {bucket.events.map((event) => (
                  <li className={styles.timelineEvent} key={event.id}>
                    <div className={styles.timelineMetaRow}>
                      <p className={styles.timelineEventMeta}>
                        {event.lab.name} · {formatDateTime(event.publishedAt)} · confidence {event.confidence.toFixed(2)}
                      </p>
                      <span className={`badge ${event.sourceTier === "official" ? "badge-official" : "badge-fallback"}`}>{event.sourceTier}</span>
                    </div>
                    <p className={styles.timelineEventTitle}>
                      <a href={event.url} target="_blank" rel="noreferrer" className={styles.timelineLink}>
                        {event.title}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
