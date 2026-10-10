import { getAgenda, interviewCalendar, localDate } from './schedule.js';

function calendarDownload(application) {
  const url = URL.createObjectURL(
    new Blob([interviewCalendar(application)], { type: 'text/calendar;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'interview.ics';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Agenda({ applications, now, busyIds, onEdit, onComplete }) {
  const { followUps, interviews } = getAgenda(applications, now);
  return (
    <section className="agenda" aria-label="Interviews and follow-ups">
      <article className="agenda-panel">
        <div className="agenda-heading">
          <h2>
            Follow-ups due <span>{followUps.length}</span>
          </h2>
          <p>Today and overdue</p>
        </div>
        {followUps.length ? (
          <ul>
            {followUps.map((application) => (
              <li key={application._id}>
                <div className="agenda-item-copy">
                  <button
                    className="role-link"
                    disabled={busyIds.has(application._id)}
                    onClick={() => onEdit(application)}
                  >
                    {application.company}
                  </button>
                  <p>{application.nextStep || `Follow up on ${application.role}`}</p>
                  <span
                    className={application.followUpDate < localDate(now) ? 'overdue' : 'due-today'}
                  >
                    {application.followUpDate < localDate(now) ? 'Overdue · ' : 'Today · '}
                    {new Date(`${application.followUpDate}T12:00:00`).toLocaleDateString(
                      undefined,
                      { month: 'short', day: 'numeric' },
                    )}
                  </span>
                </div>
                <button
                  className="secondary-button"
                  disabled={busyIds.has(application._id)}
                  onClick={() => onComplete(application)}
                  aria-label={`Complete follow-up for ${application.company}`}
                >
                  Done
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="agenda-empty">No follow-ups due. Set a date when editing an application.</p>
        )}
      </article>
      <article className="agenda-panel">
        <div className="agenda-heading">
          <h2>
            Upcoming interviews <span>{interviews.length}</span>
          </h2>
          <p>In your local time zone</p>
        </div>
        {interviews.length ? (
          <ul>
            {interviews.map((application) => (
              <li key={`${application._id}-${application.roundId}`}>
                <div className="agenda-item-copy">
                  <button
                    className="role-link"
                    disabled={busyIds.has(application._id)}
                    onClick={() => onEdit(application)}
                  >
                    {application.company}
                  </button>
                  <p>
                    {application.roundLabel} · {application.role}
                  </p>
                  <time dateTime={application.interviewAt}>
                    {new Date(application.interviewAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => calendarDownload(application)}
                  aria-label={`Download ${application.roundLabel} calendar event for ${application.company}`}
                >
                  Calendar ↗
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="agenda-empty">
            No interviews scheduled. Add a date and time to an application.
          </p>
        )}
      </article>
    </section>
  );
}
