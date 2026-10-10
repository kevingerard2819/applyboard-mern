import { statuses } from '../shared/statuses.js';
import { localDate } from './schedule.js';

export function getAnalytics(applications, now = new Date()) {
  const today = localDate(now);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const start = new Date(monday);
    start.setDate(start.getDate() - (7 - index) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start: localDate(start), end: localDate(end), count: 0 };
  });
  const counts = Object.fromEntries(statuses.map((status) => [status, 0]));
  let undated = 0;
  for (const app of applications) {
    counts[app.status] += 1;
    if (app.status === 'Wishlist') continue;
    if (!app.appliedDate) {
      undated += 1;
      continue;
    }
    const week = weeks.find(
      (item) =>
        app.appliedDate >= item.start && app.appliedDate < item.end && app.appliedDate <= today,
    );
    if (week) week.count += 1;
  }
  return { counts, weeks, undated, submitted: applications.length - counts.Wishlist };
}
