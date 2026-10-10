import { useEffect, useRef, useState } from 'react';
import { statuses } from '../shared/statuses.js';
import { getInterviewRounds, toLocalDateTime } from './schedule.js';
const empty = {
  company: '',
  role: '',
  location: '',
  status: 'Wishlist',
  url: '',
  appliedDate: '',
  notes: '',
  followUpDate: '',
  nextStep: '',
};

export default function ApplicationForm({ application, onClose, onSave }) {
  const dialog = useRef(null);
  const companyInput = useRef(null);
  const submitting = useRef(false);
  const [values, setValues] = useState(() =>
    application
      ? {
          ...Object.fromEntries(
            Object.keys(empty).map((key) => [key, application[key] || empty[key]]),
          ),
        }
      : empty,
  );
  const [rounds, setRounds] = useState(() =>
    application
      ? getInterviewRounds(application).map((round) => ({
          ...round,
          id: round.id === 'legacy' ? crypto.randomUUID() : round.id,
          at: toLocalDateTime(round.at),
        }))
      : [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    companyInput.current.focus();
    return () => element.close();
  }, []);
  function field(name) {
    const update = (event) => setValues((old) => ({ ...old, [name]: event.target.value }));
    return {
      name,
      value: values[name],
      onChange: update,
      ...(['appliedDate', 'followUpDate'].includes(name) ? { onInput: update } : {}),
    };
  }
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...values,
        interviewAt: '',
        interviewNotes: '',
        interviewRounds: rounds.map((round) => ({
          ...round,
          at: new Date(round.at).toISOString(),
        })),
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="application-dialog"
      aria-labelledby="application-form-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form
        onSubmit={submit}
        onInvalidCapture={(event) => {
          const section = event.target.closest('details');
          if (section) section.open = true;
        }}
      >
        <div className="dialog-heading">
          <div>
            <h2 id="application-form-title">
              {application ? 'Edit application' : 'Add an application'}
            </h2>
            <p className="form-intro">
              Start with the company and role. Add more details whenever you need them.
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close form"
          >
            ×
          </button>
        </div>
        <fieldset disabled={saving} className="form-grid">
          <legend className="sr-only">Application details</legend>
          <label>
            Company <span className="required-label">Required</span>
            <input
              {...field('company')}
              required
              maxLength={100}
              ref={companyInput}
              placeholder="e.g. Northstar"
            />
          </label>
          <label>
            Role <span className="required-label">Required</span>
            <input
              {...field('role')}
              required
              maxLength={150}
              placeholder="e.g. Frontend Engineer"
            />
          </label>
          <label>
            Location
            <input {...field('location')} maxLength={100} placeholder="Remote, city, or hybrid" />
          </label>
          <label>
            Status
            <select {...field('status')}>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <details className="full-width optional-details" open={Boolean(application)}>
            <summary>
              Follow-ups <span>Schedule your next step</span>
            </summary>
            <div className="form-grid">
              <label>
                Follow-up date
                <input {...field('followUpDate')} type="date" />
              </label>
              <label>
                Next step
                <input
                  {...field('nextStep')}
                  maxLength={200}
                  placeholder="e.g. Email the recruiter"
                />
              </label>
            </div>
          </details>
          <div className="full-width interview-rounds">
            <div className="rounds-heading">
              <h3>Interview rounds</h3>
              <button
                type="button"
                className="text-button"
                disabled={rounds.length >= 10}
                onClick={() =>
                  setRounds((old) => [
                    ...old,
                    { id: crypto.randomUUID(), label: '', at: '', status: 'Scheduled', notes: '' },
                  ])
                }
              >
                + Add round
              </button>
            </div>
            <p className="field-help">
              Up to 10 rounds. Dates and times use your device’s local time zone.
            </p>
            {rounds.map((round, index) => {
              function roundField(name) {
                const update = (event) =>
                  setRounds((old) =>
                    old.map((item) =>
                      item.id === round.id ? { ...item, [name]: event.target.value } : item,
                    ),
                  );
                return {
                  value: round[name],
                  onChange: update,
                  ...(name === 'at' ? { onInput: update } : {}),
                };
              }
              return (
                <div className="interview-round" key={round.id}>
                  <div className="rounds-heading">
                    <strong>Round {index + 1}</strong>
                    <button
                      type="button"
                      className="text-button delete-button"
                      aria-label={`Remove round ${index + 1}`}
                      onClick={() => setRounds((old) => old.filter((item) => item.id !== round.id))}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="form-grid">
                    <label>
                      Round name
                      <input
                        {...roundField('label')}
                        required
                        maxLength={100}
                        placeholder="e.g. Technical interview"
                        aria-label={`Round ${index + 1} name`}
                      />
                    </label>
                    <label>
                      Outcome
                      <select {...roundField('status')} aria-label={`Round ${index + 1} outcome`}>
                        {['Scheduled', 'Completed', 'Cancelled'].map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </label>
                    <label className="full-width">
                      Date & time
                      <input
                        {...roundField('at')}
                        type="datetime-local"
                        required
                        aria-label={`Round ${index + 1} date and time`}
                      />
                    </label>
                    <label className="full-width">
                      Preparation & feedback
                      <textarea
                        {...roundField('notes')}
                        rows={2}
                        maxLength={1000}
                        aria-label={`Round ${index + 1} notes`}
                        placeholder="Meeting link, preparation, or feedback"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
            {!rounds.length && <p className="field-help">No interview rounds added.</p>}
          </div>
          <details className="full-width optional-details" open={Boolean(application)}>
            <summary>
              Additional details <span>Job link, date & notes</span>
            </summary>
            <div className="form-grid">
              <label className="full-width">
                Job posting URL
                <input {...field('url')} type="url" maxLength={2000} placeholder="https://…" />
              </label>
              <label className="full-width">
                Date applied
                <input {...field('appliedDate')} type="date" />
              </label>
              <label className="full-width">
                Notes
                <textarea
                  {...field('notes')}
                  rows={3}
                  maxLength={5000}
                  placeholder="Interview details, next steps, or things to remember…"
                />
              </label>
            </div>
          </details>
        </fieldset>
        {application && (
          <details className="activity-history">
            <summary>
              Activity history <span>{application.activity?.length || 0}</span>
            </summary>
            {application.activity?.length ? (
              <ol>
                {[...application.activity].reverse().map((entry, index) => (
                  <li key={index}>
                    <strong>{entry.message}</strong>
                    <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="field-help">Changes made from now on will appear here.</p>
            )}
          </details>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-footer">
          <button type="button" className="secondary-button" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? 'Saving…' : 'Save application'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
