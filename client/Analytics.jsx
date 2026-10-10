import { statuses } from '../shared/statuses.js';
import { getAnalytics } from './analytics.js';

export default function Analytics({ applications, now }) {
  const { counts, weeks, undated, submitted } = getAnalytics(applications, now);
  const weeklyMax = Math.max(1, ...weeks.map((week) => week.count));
  const stageMax = Math.max(1, ...Object.values(counts));
  const total = weeks.reduce((sum, week) => sum + week.count, 0);
  return (
    <div className="analytics">
      <div className="analytics-summary">
        <div>
          <span>Applications sent</span>
          <strong>{submitted}</strong>
          <small>All stages except wishlist</small>
        </div>
        <div>
          <span>Active applications</span>
          <strong>{counts.Applied + counts.Interview}</strong>
          <small>Applied or interviewing</small>
        </div>
        <div>
          <span>Sent in the last 8 weeks</span>
          <strong>{total}</strong>
          <small>Based on application dates</small>
        </div>
      </div>
      <div className="analytics-panels">
        <section className="analytics-panel" aria-labelledby="pipeline-title">
          <h3 id="pipeline-title">Current pipeline</h3>
          <p>Where your {applications.length} tracked roles stand today.</p>
          <div className="pipeline-bars">
            {statuses.map((stage) => (
              <div className="pipeline-row" key={stage}>
                <span>{stage}</span>
                <div className="bar-track">
                  <div
                    className={`bar-fill stage-${stage.toLowerCase()}`}
                    style={{ width: `${(counts[stage] / stageMax) * 100}%` }}
                  />
                </div>
                <strong>{counts[stage]}</strong>
              </div>
            ))}
          </div>
          <small>Current status totals, not historical conversion rates.</small>
        </section>
        <section className="analytics-panel" aria-labelledby="activity-title">
          <h3 id="activity-title">Weekly applications</h3>
          <p>Eight weeks through today. Weeks start on Monday.</p>
          <div
            className="weekly-chart"
            role="img"
            aria-label={weeks
              .map((week) => `Week of ${week.start}: ${week.count} applications`)
              .join('; ')}
          >
            {weeks.map((week) => (
              <div className="week-column" key={week.start} aria-hidden="true">
                <strong>{week.count}</strong>
                <div className="week-track">
                  <div
                    className="week-bar"
                    style={{ height: `${(week.count / weeklyMax) * 100}%` }}
                  />
                </div>
                <span>
                  {new Date(`${week.start}T12:00:00`).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            ))}
          </div>
          <small>
            {undated
              ? `${undated} submitted ${undated === 1 ? 'application has' : 'applications have'} no application date and ${undated === 1 ? 'is' : 'are'} excluded.`
              : 'Wishlist entries and future application dates are excluded.'}
          </small>
        </section>
      </div>
      {!applications.length && (
        <p className="analytics-empty">
          Add your first application to start building your pipeline.
        </p>
      )}
    </div>
  );
}
