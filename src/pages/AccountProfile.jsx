import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import LogoBadge from '../components/LogoBadge';
import CreateStartupModal from '../components/CreateStartupModal';
import { Icon } from '../components/IconSprite';
import { statusMeta } from '../data/startups';
import { useApp } from '../context/AppContext';
import '../styles/settings.css';
import '../styles/account.css';

function StartupTile({ id, s, onView, onManage }) {
  const meta = statusMeta(s.status);
  return (
    <div className="startup-tile">
      <div className="startup-tile-head">
        <LogoBadge id={id} initials={s.initials} size={46} />
        <span className={`status-pill ${meta.cls}`}>{meta.label}</span>
      </div>
      <h4>{s.name}{s.verified && <Icon name="check" />}</h4>
      <p>{s.tagline || 'No tagline yet.'}</p>
      <div className="startup-tile-actions">
        <button className="btn btn-outline btn-sm" onClick={onView}>View</button>
        {onManage && <button className="btn btn-accent btn-sm" onClick={onManage}>Manage</button>}
      </div>
    </div>
  );
}

export default function AccountProfile() {
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const { currentUser, myStartups, collaboratingIds, startups, applications } = useApp();

  function collabRoleFor(startupId) {
    const app = applications.find((a) => a.startupId === startupId && a.applicantId === currentUser.id && a.status === 'accepted');
    return app ? app.role : null;
  }

  return (
    <div>
      <Topbar />
      <div className="layout layout-2col">
        <LeftNav />
        <main className="center-col account-page">
          <div className="account-header">
            <div className="account-avatar">{currentUser.initials}</div>
            <div className="account-header-body">
              <h2>{currentUser.name}</h2>
              <p className="account-meta">{currentUser.email}{currentUser.location ? ` · ${currentUser.location}` : ''}</p>
              <p className="account-bio">{currentUser.bio}</p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/settings')}>Edit profile</button>
          </div>

          <section className="account-section">
            <div className="account-section-head">
              <h3>My Startups</h3>
              <button className="btn btn-accent btn-sm" onClick={() => setCreateOpen(true)}><Icon name="bolt" />Create Startup</button>
            </div>
            {myStartups.length === 0 ? (
              <p className="settings-hint">You haven't created a startup yet — click "Create Startup" to publish your first page.</p>
            ) : (
              <div className="startup-grid">
                {myStartups.map(([id, s]) => (
                  <StartupTile
                    key={id}
                    id={id}
                    s={s}
                    onView={() => navigate(`/profile/${id}`)}
                    onManage={() => navigate(`/dashboard/${id}`)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="account-section">
            <h3>Collaborating On</h3>
            {collaboratingIds.length === 0 ? (
              <p className="settings-hint">Startups you're accepted to collaborate with will show up here.</p>
            ) : (
              <div className="startup-grid">
                {collaboratingIds.map((id) => {
                  const s = startups[id];
                  const role = collabRoleFor(id);
                  return (
                    <div className="startup-tile" key={id}>
                      <div className="startup-tile-head">
                        <LogoBadge id={id} initials={s.initials} size={46} />
                        <span className={`status-pill ${statusMeta(s.status).cls}`}>{statusMeta(s.status).label}</span>
                      </div>
                      <h4>{s.name}{s.verified && <Icon name="check" />}</h4>
                      <p>{role ? `Collaborating as ${role}` : s.tagline}</p>
                      <div className="startup-tile-actions">
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/profile/${id}`)}>View</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
      <CreateStartupModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
