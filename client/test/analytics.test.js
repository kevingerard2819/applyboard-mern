import test from 'node:test';
import assert from 'node:assert/strict';
import { getAnalytics } from '../analytics.js';

test('analytics counts current stages while excluding wishlist, future and undated records from weekly totals', () => {
  const result = getAnalytics(
    [
      { status: 'Wishlist', appliedDate: '2026-10-07' },
      { status: 'Applied', appliedDate: '2026-10-05' },
      { status: 'Interview', appliedDate: '2026-10-04' },
      { status: 'Offer', appliedDate: '2026-10-10' },
      { status: 'Rejected', appliedDate: '2026-10-11' },
      { status: 'Applied', appliedDate: '' },
      { status: 'Applied', appliedDate: '2026-01-01' },
    ],
    new Date(2026, 9, 10, 23, 59),
  );
  assert.equal(result.submitted, 6);
  assert.equal(result.counts.Applied, 3);
  assert.equal(result.undated, 1);
  assert.equal(result.weeks[7].start, '2026-10-05');
  assert.equal(result.weeks[7].count, 2);
  assert.equal(result.weeks[6].count, 1);
  assert.equal(
    result.weeks.reduce((sum, week) => sum + week.count, 0),
    3,
  );
});

test('weekly buckets cross the year boundary and include Monday exactly once', () => {
  const result = getAnalytics(
    [
      { status: 'Applied', appliedDate: '2025-12-28' },
      { status: 'Applied', appliedDate: '2025-12-29' },
      { status: 'Applied', appliedDate: '2026-01-05' },
    ],
    new Date(2026, 0, 5),
  );
  assert.equal(result.weeks[7].start, '2026-01-05');
  assert.equal(result.weeks[7].count, 1);
  assert.equal(result.weeks[6].count, 1);
  assert.equal(result.weeks[5].count, 1);
});

test('empty analytics provides eight zero-value weeks and all stages', () => {
  const result = getAnalytics([], new Date(2026, 9, 10));
  assert.equal(result.weeks.length, 8);
  assert.equal(result.submitted, 0);
  assert.equal(result.undated, 0);
  assert.deepEqual(result.counts, { Wishlist: 0, Applied: 0, Interview: 0, Offer: 0, Rejected: 0 });
  assert.ok(result.weeks.every((week) => week.count === 0));
});
