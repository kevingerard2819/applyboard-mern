import test from 'node:test';
import assert from 'node:assert/strict';
import { getAgenda, localDate, toLocalDateTime, interviewCalendar } from '../schedule.js';

test('agenda separates due follow-ups and future interviews, excludes closed roles, and sorts dates', () => {
  const now = new Date(2026, 9, 10, 12);
  const future = new Date(now.getTime() + 86400000).toISOString();
  const later = new Date(now.getTime() + 172800000).toISOString();
  const records = [
    { _id: 'today', status: 'Applied', followUpDate: '2026-10-10', interviewAt: later },
    { _id: 'overdue', status: 'Interview', followUpDate: '2026-10-09', interviewAt: future },
    { _id: 'later', status: 'Applied', followUpDate: '2026-10-11' },
    { _id: 'offer', status: 'Offer', followUpDate: '2026-10-01', interviewAt: future },
    { _id: 'rejected', status: 'Rejected', followUpDate: '2026-10-01', interviewAt: future },
    { _id: 'past', status: 'Interview', interviewAt: new Date(now.getTime() - 1000).toISOString() },
    { _id: 'legacy', status: 'Applied' },
  ];
  const agenda = getAgenda(records, now);
  assert.deepEqual(
    agenda.followUps.map((app) => app._id),
    ['overdue', 'today'],
  );
  assert.deepEqual(
    agenda.interviews.map((app) => app._id),
    ['overdue', 'today'],
  );
});

test('local form times round-trip without changing the interview instant', () => {
  const date = new Date(2026, 9, 10, 9, 30);
  assert.equal(localDate(date), '2026-10-10');
  assert.equal(toLocalDateTime(date.toISOString()), '2026-10-10T09:30');
  assert.equal(new Date(toLocalDateTime(date.toISOString())).toISOString(), date.toISOString());
  assert.equal(toLocalDateTime(''), '');
});

test('calendar uses UTC, escapes text, and folds Unicode lines to 75 bytes', () => {
  const calendar = interviewCalendar(
    {
      _id: 'abc',
      company: 'A, B; Co',
      role: 'Engineer',
      interviewAt: '2026-10-11T09:30:00+04:00',
      interviewNotes: 'First\nSecond; ' + '準'.repeat(80),
    },
    new Date('2026-10-10T00:00:00Z'),
  );
  const unfolded = calendar.replace(/\r\n /g, '');
  assert.match(unfolded, /DTSTART:20261011T053000Z/);
  assert.match(unfolded, /DTEND:20261011T063000Z/);
  assert.ok(unfolded.includes('SUMMARY:A\\, B\\; Co'));
  assert.ok(unfolded.includes('DESCRIPTION:First\\nSecond\\; '));
  for (const line of calendar.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  assert.ok(calendar.endsWith('END:VCALENDAR\r\n'));
});
