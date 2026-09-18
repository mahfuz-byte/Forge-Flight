import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import LogoBadge from '../components/LogoBadge';
import CreateStartupModal from '../components/CreateStartupModal';
import { Icon } from '../components/IconSprite';
import { statusMeta, fmtMoney } from '../data/startups';
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
  const [portfolioTab, setPortfolioTab] = useState('portfolio');
  const navigate = useNavigate();
  const { currentUser, myStartups, collaboratingIds, startups, applications, saved, followed, investments, cancelInvestment } = useApp();

  function collabRoleFor(startupId) {
    const app = applications.find((a) => a.startupId === startupId && a.applicantId === currentUser.id && a.status === 'accepted');
    return app ? app.role : null;
  }

  const savedStartups = Array.from(saved)
    .map((id) => [id, startups[id]])
    .filter(([, s]) => s);

  const followedStartups = Array.from(followed)
    .map((id) => [id, startups[id]])
    .filter(([, s]) => s);

  const myInvestments = useMemo(
    () => investments.filter((investment) => investment.investorId === currentUser.id),
    [investments, currentUser.id],
  );
  const acceptedInvestments = useMemo(
    () => myInvestments.filter((investment) => investment.status === 'accepted' && startups[investment.startupId]),
    [myInvestments, startups],
  );
  const historyInvestments = useMemo(
    () => myInvestments.filter((investment) => investment.status !== 'pending' && startups[investment.startupId]),
    [myInvestments, startups],
  );

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

          <section className="account-section">
            <h3>Saved Startups</h3>
            {savedStartups.length === 0 ? (
              <p className="settings-hint">No saved startups yet. Use Save on any startup profile or feed card.</p>
            ) : (
              <div className="startup-grid">
                {savedStartups.map(([id, s]) => (
                  <StartupTile
                    key={id}
                    id={id}
                    s={s}
                    onView={() => navigate(`/profile/${id}`)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="account-section">
            <h3>Following</h3>
            {followedStartups.length === 0 ? (
              <p className="settings-hint">No followed startups yet. Follow a startup to track updates here.</p>
            ) : (
              <div className="startup-grid">
                {followedStartups.map(([id, s]) => (
                  <StartupTile
                    key={id}
                    id={id}
                    s={s}
                    onView={() => navigate(`/profile/${id}`)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="account-section">
            <h3>Portfolio</h3>
            <div className="filter-row" style={{ padding: '0 0 18px', border: 'none' }}>
              {[
                ['portfolio', 'Investment Portfolio'],
                ['requests', 'Investment Requests'],
                ['history', 'Investment History'],
              ].map(([key, label]) => (
                <button key={key} className={`filter-pill${portfolioTab === key ? ' active' : ''}`} onClick={() => setPortfolioTab(key)}>
                  {label}
                </button>
              ))}
            </div>

            {portfolioTab === 'portfolio' && (
              <div className="settings-card">
                <h4>Investment Portfolio</h4>
                <p className="settings-hint">Accepted investments from the backend.</p>
                {acceptedInvestments.length === 0 ? (
                  <p className="settings-hint">No accepted investments yet.</p>
                ) : (
                  acceptedInvestments.map((inv) => {
                    const s = startups[inv.startupId];
                    return (
                      <div className="portfolio-card" key={inv.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/profile/${inv.startupId}`)}>
                        <LogoBadge id={inv.startupId} initials={s.initials} size={44} />
                        <div className="pc-body">
                          <b>{s.name}</b>
                          <span>Accepted {inv.time}</span>
                        </div>
                        <div className="pc-amount">
                          <b>{fmtMoney(inv.amount)}</b>
                          <span>accepted</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {portfolioTab === 'requests' && (
              <div className="settings-card">
                <h4>Investment Requests</h4>
                <p className="settings-hint">Pending "Invest Now" requests you've sent.</p>
                {myInvestments.filter((investment) => investment.status === 'pending').length === 0 ? (
                  <p className="settings-hint">No pending requests.</p>
                ) : (
                  <div className="app-list">
                    {myInvestments.filter((investment) => investment.status === 'pending').map((inv) => {
                      const s = startups[inv.startupId];
                      return (
                        <div className="app-row" key={inv.id}>
                          <div className="app-row-main" style={{ cursor: 'pointer' }} onClick={() => navigate(`/profile/${inv.startupId}`)}>
                            <b>{s.name} · {fmtMoney(inv.amount)}</b>
                            <span className="app-row-meta">{inv.time}</span>
                          </div>
                          <div className="app-row-actions">
                            <button className="btn btn-outline btn-sm" onClick={() => cancelInvestment(inv.id)}>Cancel</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {portfolioTab === 'history' && (
              <div className="settings-card">
                <h4>Investment History</h4>
                <p className="settings-hint">Completed investment requests from the backend.</p>
                {historyInvestments.length === 0 ? (
                  <p className="settings-hint">No completed requests yet.</p>
                ) : (
                  <div className="startup-grid">
                    {historyInvestments.map((inv) => {
                      const s = startups[inv.startupId];
                      return (
                        <div className="startup-tile" key={inv.id}>
                          <div className="startup-tile-head">
                            <LogoBadge id={inv.startupId} initials={s.initials} size={46} />
                            <span className="status-pill status-closed">{inv.status}</span>
                          </div>
                          <h4>{s.name}</h4>
                          <p>{inv.time} · {inv.status}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
      <CreateStartupModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
