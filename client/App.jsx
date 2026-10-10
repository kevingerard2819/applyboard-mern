import { useEffect, useRef, useState } from 'react';
import ApplicationForm from './ApplicationForm.jsx';
import { statuses } from '../shared/statuses.js';
import { request } from './api.js';

function Icon({ name, ...props }) {
  const paths = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M8 7V4h8v3M3 12a20 20 0 0 0 18 0M12 11v4" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

export default function App() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [sort, setSort] = useState('recent');
  const [form, setForm] = useState(null);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const pendingIds = useRef(new Set());
  const [notice, setNotice] = useState('');
  async function load(signal) {
    setLoading(true);
    setError('');
    try {
      const data = await request('', { signal });
      if (signal?.aborted) return;
      setApplications(data.applications);
    } catch {
      if (signal?.aborted) return;
      setError(
        'Could not connect to the application server. Check that the API and MongoDB are running.',
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const counts = Object.fromEntries(statuses.map((item) => [item, 0]));
  for (const application of applications) counts[application.status] += 1;
  const search = query.trim().toLowerCase();
  const filtered = applications
    .filter(
      (app) =>
        (status === 'All' || app.status === status) &&
        [app.company, app.role, app.location].some((value) => value.toLowerCase().includes(search)),
    )
    .sort((a, b) =>
      sort === 'company'
        ? a.company.localeCompare(b.company)
        : new Date(b.createdAt) - new Date(a.createdAt),
    );
  async function save(values) {
    const editing = form?._id;
    const { application } = await request(editing ? `/${editing}` : '', {
      method: editing ? 'PATCH' : 'POST',
      body: JSON.stringify(values),
    });
    setApplications((old) =>
      editing ? old.map((app) => (app._id === editing ? application : app)) : [application, ...old],
    );
    setNotice(editing ? 'Application updated.' : 'Application added.');
    if (!editing) {
      setQuery('');
      setStatus('All');
      setSort('recent');
    }
  }
  async function changeStatus(application, newStatus) {
    if (!lockApplication(application._id)) return;
    setError('');
    try {
      const data = await request(`/${application._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setApplications((old) =>
        old.map((app) => (app._id === application._id ? data.application : app)),
      );
      setNotice(`${application.company} moved to ${newStatus.toLowerCase()}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      unlockApplication(application._id);
    }
  }
  async function remove(application) {
    if (pendingIds.current.has(application._id)) return;
    if (!window.confirm(`Delete your ${application.role} application at ${application.company}?`))
      return;
    if (!lockApplication(application._id)) return;
    setError('');
    try {
      await request(`/${application._id}`, { method: 'DELETE' });
      setApplications((old) => old.filter((app) => app._id !== application._id));
      setNotice('Application deleted.');
    } catch (err) {
      setError(err.message);
    } finally {
      unlockApplication(application._id);
    }
  }
  function lockApplication(id) {
    if (pendingIds.current.has(id)) return false;
    pendingIds.current.add(id);
    setBusyIds(new Set(pendingIds.current));
    return true;
  }
  function unlockApplication(id) {
    pendingIds.current.delete(id);
    setBusyIds(new Set(pendingIds.current));
  }
  const interviewRate = applications.length
    ? Math.round(((counts.Interview + counts.Offer) / applications.length) * 100)
    : 0;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="brand">
          <span className="brand-mark">
            <Icon name="briefcase" />
          </span>
          applyboard<span className="brand-dot">.</span>
        </a>
        <span className="workspace-label">PERSONAL WORKSPACE</span>
        <nav aria-label="Main navigation">
          <a href="#applications" className="nav-active">
            <Icon name="grid" />
            Applications<span>{applications.length}</span>
          </a>
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">A</span>
          <div>
            <strong>Your workspace</strong>
            <small>Personal application tracker</small>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Workspace <span className="breadcrumb">/</span> <strong>Applications</strong>
          </span>
          <span className="local-badge">
            <span /> Personal tracker
          </span>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <h1>Applications</h1>
              <p>Keep track of the roles you’re considering and the applications you’ve sent.</p>
            </div>
            <button className="primary-button" disabled={loading} onClick={() => setForm({})}>
              <span className="plus">+</span> Add application
            </button>
          </div>
          <section className="stats" aria-label="Application overview">
            {[
              ['Tracked roles', applications.length],
              ['Interviews', counts.Interview],
              ['Offers', counts.Offer],
              ['Interview / offer rate', `${interviewRate}%`],
            ].map(([label, value]) => (
              <article className="stat" key={label}>
                <span>{label}</span>
                <strong>{loading ? '—' : value}</strong>
              </article>
            ))}
          </section>
          <section className="applications" id="applications" aria-labelledby="applications-title">
            <div className="section-heading">
              <div>
                <h2 id="applications-title">
                  Application list <span>{applications.length}</span>
                </h2>
                <p>Select a role to edit its details.</p>
              </div>
              <div className="list-tools">
                <label className="search">
                  <Icon name="search" />
                  <input
                    aria-label="Search applications"
                    placeholder="Search applications…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <select
                  className="sort-select"
                  aria-label="Sort applications"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="recent">Newest first</option>
                  <option value="company">Company A–Z</option>
                </select>
              </div>
            </div>
            <div className="filters" role="group" aria-label="Filter by status">
              {['All', ...statuses].map((item) => (
                <button
                  key={item}
                  aria-pressed={status === item}
                  className={status === item ? 'selected' : ''}
                  onClick={() => setStatus(item)}
                >
                  {item === 'All' ? 'All applications' : item}
                  <span>{item === 'All' ? applications.length : counts[item]}</span>
                </button>
              ))}
            </div>
            {error && (
              <div className="error error-banner" role="alert">
                {error}
                <button className="secondary-button" onClick={() => load()} disabled={loading}>
                  Retry
                </button>
              </div>
            )}
            {loading ? (
              <div className="empty-state" role="status">
                <span className="spinner" />
                Loading applications…
              </div>
            ) : !filtered.length ? (
              <div className="empty-state">
                <span className="empty-icon">
                  <Icon name="briefcase" width="30" height="30" />
                </span>
                <h3>{applications.length ? 'No matching applications' : 'No applications yet'}</h3>
                <p>
                  {applications.length
                    ? 'Clear your filters to see all your applications.'
                    : 'Add a role with its company, status, and any notes you want to keep.'}
                </p>
                {!applications.length && (
                  <button className="primary-button" onClick={() => setForm({})}>
                    + Add your first application
                  </button>
                )}
                {applications.length > 0 && (
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setQuery('');
                      setStatus('All');
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>COMPANY & ROLE</th>
                      <th>LOCATION</th>
                      <th>STATUS</th>
                      <th>DATE ADDED</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((application) => (
                      <tr key={application._id}>
                        <td>
                          <div className="company-cell">
                            <span className="company-logo">
                              {application.company.slice(0, 1).toUpperCase()}
                            </span>
                            <div>
                              <button
                                className="role-link"
                                disabled={busyIds.has(application._id)}
                                onClick={() => setForm(application)}
                              >
                                {application.role}
                              </button>
                              <span>{application.company}</span>
                            </div>
                          </div>
                        </td>
                        <td className="location" data-label="Location">
                          {application.location || 'Not specified'}
                        </td>
                        <td data-label="Status">
                          <select
                            aria-label={`Status for ${application.role} at ${application.company}`}
                            className={`status-select status-${application.status.toLowerCase()}`}
                            value={application.status}
                            disabled={busyIds.has(application._id)}
                            onChange={(event) => changeStatus(application, event.target.value)}
                          >
                            {statuses.map((item) => (
                              <option key={item}>{item}</option>
                            ))}
                          </select>
                        </td>
                        <td className="date" data-label="Added">
                          {new Date(application.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td>
                          <div className="row-actions">
                            {application.url && (
                              <a
                                className="icon-button"
                                href={application.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Open job posting at ${application.company}`}
                              >
                                ↗
                              </a>
                            )}
                            <button
                              className="text-button"
                              onClick={() => setForm(application)}
                              disabled={busyIds.has(application._id)}
                            >
                              Edit
                            </button>
                            <button
                              className="text-button delete-button"
                              onClick={() => remove(application)}
                              disabled={busyIds.has(application._id)}
                              aria-label={`Delete application at ${application.company}`}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="table-footer">
                  Showing {filtered.length} of {applications.length} applications
                  <span>Change a status directly, or select a role to edit its details.</span>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      {notice && (
        <div className="toast" role="status" aria-live="polite">
          <span className="toast-check">✓</span>
          {notice}
          <button onClick={() => setNotice('')} aria-label="Dismiss notification">
            ×
          </button>
        </div>
      )}
      {form && (
        <ApplicationForm
          application={form._id ? form : null}
          onSave={save}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
