import { useEffect, useRef, useState } from 'react';
import { statuses } from '../shared/statuses.js';
const empty = {
  company: '',
  role: '',
  location: '',
  status: 'Wishlist',
  url: '',
  appliedDate: '',
  notes: '',
};

export default function ApplicationForm({ application, onClose, onSave }) {
  const dialog = useRef(null);
  const companyInput = useRef(null);
  const submitting = useRef(false);
  const [values, setValues] = useState(() =>
    application
      ? Object.fromEntries(Object.keys(empty).map((key) => [key, application[key] || empty[key]]))
      : empty,
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
    return {
      name,
      value: values[name],
      onChange: (event) => setValues((old) => ({ ...old, [name]: event.target.value })),
    };
  }
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(values);
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
