import { useState } from 'react';
import { statuses } from '../shared/statuses.js';

export default function KanbanBoard({ applications, busyIds, onStatusChange, onEdit }) {
  const [draggedId, setDraggedId] = useState(null);
  const [target, setTarget] = useState(null);
  const dragged = applications.find((app) => app._id === draggedId);
  function finishDrag() {
    setDraggedId(null);
    setTarget(null);
  }
  return (
    <div
      className="board-scroll"
      tabIndex="0"
      aria-label="Application board, scroll to see all stages"
    >
      <div className="kanban-board">
        {statuses.map((stage) => {
          const cards = applications.filter((app) => app.status === stage);
          return (
            <section
              key={stage}
              className={`board-column ${target === stage ? 'drop-target' : ''}`}
              aria-label={`${stage} applications`}
              onDragOver={(event) => {
                if (!dragged || busyIds.has(dragged._id)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setTarget(stage);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setTarget(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragged && !busyIds.has(dragged._id) && dragged.status !== stage) {
                  onStatusChange(dragged, stage);
                }
                finishDrag();
              }}
            >
              <h3>
                <span className={`stage-dot status-${stage.toLowerCase()}`} />
                {stage}
                <span>{cards.length}</span>
              </h3>
              <div className="board-cards">
                {cards.map((app) => (
                  <article
                    className={`board-card ${draggedId === app._id ? 'dragging' : ''}`}
                    key={app._id}
                    draggable={!busyIds.has(app._id)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', app._id);
                      event.dataTransfer.effectAllowed = 'move';
                      setDraggedId(app._id);
                    }}
                    onDragEnd={finishDrag}
                    aria-busy={busyIds.has(app._id)}
                  >
                    <span className="board-company">{app.company}</span>
                    <button
                      className="role-link"
                      disabled={busyIds.has(app._id)}
                      onClick={() => onEdit(app)}
                    >
                      {app.role}
                    </button>
                    <p>{app.location || 'Location not specified'}</p>
                    {app.followUpDate && !['Offer', 'Rejected'].includes(app.status) && (
                      <span className="board-follow-up">
                        Follow up{' '}
                        {new Date(`${app.followUpDate}T12:00:00`).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                    <select
                      aria-label={`Status for ${app.role} at ${app.company}`}
                      className="board-status"
                      value={app.status}
                      disabled={busyIds.has(app._id)}
                      onChange={(event) => onStatusChange(app, event.target.value)}
                    >
                      {statuses.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </article>
                ))}
                {!cards.length && <p className="board-empty">No applications</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
