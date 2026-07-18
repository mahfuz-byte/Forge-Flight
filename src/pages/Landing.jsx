import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/IconSprite';
import '../styles/landing.css';

export default function Landing() {
  const navigate = useNavigate();

  function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div>
      <header className="landing-hero">
        <div className="hero-top">
          <div className="wordmark"><span className="mark">F&amp;F</span>FORGE &amp; FLIGHT</div>
          <nav className="hero-nav">
            <a onClick={() => scrollTo('landing-founders')}>Explore</a>
            <a onClick={() => scrollTo('landing-founders')}>For Founders</a>
            <a onClick={() => scrollTo('landing-investors')}>For Investors</a>
          </nav>
          <div className="hero-cta-row">
            <button className="btn btn-ghost-dark" onClick={() => navigate('/login?tab=login')}>Log in</button>
            <button className="btn btn-accent" onClick={() => navigate('/login?tab=register')}>Create account</button>
          </div>
        </div>
        <div className="hero-body">
          <div className="eyebrow">A startup incubator platform</div>
          <h1 className="hero-title">Where startups get <em>forged</em>,<br />and ideas take <em>flight</em>.</h1>
          <p className="hero-sub">Founders post real progress — prototypes, milestones, funding rounds, open roles. Investors discover it as it happens, and back it while the window's open.</p>
          <div className="hero-cta-row">
            <button className="btn btn-accent" onClick={() => navigate('/login?tab=register')}>Enter the feed <Icon name="arrow-r" /></button>
            <button className="btn btn-ghost-dark" onClick={() => scrollTo('landing-founders')}>See how it works</button>
          </div>
        </div>
        <div className="hero-stats">
          <div className="hero-stat"><b className="mono">520</b><span>Active startups</span></div>
          <div className="hero-stat"><b className="mono">46</b><span>Funding open</span></div>
          <div className="hero-stat"><b className="mono">103</b><span>Collaborations</span></div>
          <div className="hero-stat"><b className="mono">38</b><span>Investors online</span></div>
        </div>
      </header>

      <section className="section" id="landing-founders">
        <div className="section-head">
          <div className="eyebrow">How it works</div>
          <h2>Three steps, one feed.</h2>
          <p>No separate portals for founders and investors — one live feed carries the whole relationship from first prototype to closed round.</p>
        </div>
        <div className="flow-grid">
          <div className="flow-step">
            <span className="flow-num mono">01</span>
            <h3>Founders post progress</h3>
            <p>Updates, milestones, demo videos, pitch decks and open roles — published straight to the feed, not buried in a static profile.</p>
          </div>
          <div className="flow-step">
            <span className="flow-num mono">02</span>
            <h3>Investors discover &amp; back</h3>
            <p>Browse by industry, funding status or trending activity. Open a startup's page and commit while the funding window is open.</p>
          </div>
          <div className="flow-step">
            <span className="flow-num mono">03</span>
            <h3>Deals close, teams grow</h3>
            <p>When the window closes, the founder contacts the winning investor directly. Open collaboration roles fill the same way.</p>
          </div>
        </div>
      </section>

      <section className="section" id="landing-investors">
        <div className="split-grid">
          <article className="split-card founder">
            <div className="kicker mono">/ for founders</div>
            <h3>Build in public, get backed for it.</h3>
            <ul>
              <li><Icon name="check" />Publish a startup profile with team, timeline, funding and documents.</li>
              <li><Icon name="check" />Open a funding window and track every offer as it comes in.</li>
              <li><Icon name="check" />Post a collaboration listing and review applications in one place.</li>
            </ul>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 22 }} onClick={() => navigate('/login?tab=register')}>Register as a founder</button>
          </article>
          <article className="split-card investor">
            <div className="kicker mono">/ for investors</div>
            <h3>Discover deals before they're obvious.</h3>
            <ul>
              <li><Icon name="check" />Watch real progress, not a pitch deck frozen in time.</li>
              <li><Icon name="check" />See funding goals, remaining days and expected ROI on every post.</li>
              <li><Icon name="check" />Commit to a round in one click while the window is open.</li>
            </ul>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 22 }} onClick={() => navigate('/login?tab=register')}>Register as an investor</button>
          </article>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="wordmark" style={{ fontSize: 15 }}><span className="mark" style={{ width: 22, height: 22, fontSize: 11 }}>F&amp;F</span>Forge &amp; Flight</div>
        <span>SE Sessional Project</span>
      </footer>
    </div>
  );
}
