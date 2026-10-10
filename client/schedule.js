export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function toLocalDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${localDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function getAgenda(applications, now = new Date()) {
  const active = applications.filter((app) => !['Offer', 'Rejected'].includes(app.status));
  return {
    followUps: active
      .filter((app) => app.followUpDate && app.followUpDate <= localDate(now))
      .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate)),
    interviews: active
      .flatMap((app) =>
        getInterviewRounds(app).map((round) => ({
          ...app,
          roundId: round.id,
          roundLabel: round.label,
          interviewAt: round.at,
          interviewNotes: round.notes,
          roundStatus: round.status,
        })),
      )
      .filter((app) => app.roundStatus === 'Scheduled' && new Date(app.interviewAt) >= now)
      .sort((a, b) => new Date(a.interviewAt) - new Date(b.interviewAt)),
  };
}

export function getInterviewRounds(application) {
  if (application.interviewRounds?.length) return application.interviewRounds;
  return application.interviewAt
    ? [
        {
          id: 'legacy',
          label: 'Interview',
          at: application.interviewAt,
          notes: application.interviewNotes || '',
          status: 'Scheduled',
        },
      ]
    : [];
}

export function interviewCalendar(application, now = new Date()) {
  const stamp = (date) =>
    date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const escape = (value) =>
    value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&');
  const start = new Date(application.interviewAt);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ApplyBoard//Interview//EN',
    'BEGIN:VEVENT',
    `UID:${application._id}${application.roundId && application.roundId !== 'legacy' ? `-${application.roundId}` : ''}@applyboard`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(new Date(start.getTime() + 60 * 60 * 1000))}`,
    `SUMMARY:${escape(`${application.company} — ${application.role} · ${application.roundLabel || 'Interview'}`)}`,
    `DESCRIPTION:${escape(application.interviewNotes || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  // Fold at 75 UTF-8 bytes, including the continuation space (iCalendar format).
  return (
    lines
      .map((line) => {
        let folded = '';
        let bytes = 0;
        for (const character of line) {
          const size = new TextEncoder().encode(character).length;
          if (bytes + size > 75) {
            folded += '\r\n ';
            bytes = 1;
          }
          folded += character;
          bytes += size;
        }
        return folded;
      })
      .join('\r\n') + '\r\n'
  );
}
