import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/IconSprite';
import { useApp } from '../context/AppContext';
import '../styles/landing.css';

import hero1 from '../assets/hero/hero-1.jpeg';
import hero2 from '../assets/hero/hero-2.jpeg';
import hero3 from '../assets/hero/hero-3.jpeg';
import hero4 from '../assets/hero/hero-4.jpeg';
import hero5 from '../assets/hero/hero-5.jpeg';
import hero6 from '../assets/hero/hero-6.jpeg';

const HERO_IMAGES = [
  { src: hero1, alt: 'Forge & Flight Community Showcase 1' },
  { src: hero2, alt: 'Forge & Flight Community Showcase 2' },
  { src: hero3, alt: 'Forge & Flight Community Showcase 3' },
  { src: hero4, alt: 'Forge & Flight Community Showcase 4' },
  { src: hero5, alt: 'Forge & Flight Community Showcase 5' },
  { src: hero6, alt: 'Forge & Flight Community Showcase 6' },
];

const ROTATION_INTERVAL = 3500; // 3.5 seconds per slide for responsive automatic rotation

export default function Landing() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useApp();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % HERO_IMAGES.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + HERO_IMAGES.length) % HERO_IMAGES.length);
  }, []);

  // Automatic slide rotation: triggers every 3.5s and cleanly resets on manual slide change
  useEffect(() => {
    if (isPaused) return undefined;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_IMAGES.length);
    }, ROTATION_INTERVAL);

    return () => clearInterval(timer);
  }, [isPaused, currentSlide]);

  function handleKeyDown(e) {
    if (e.key === 'ArrowLeft') {
      prevSlide();
    } else if (e.key === 'ArrowRight') {
      nextSlide();
    }
  }

  function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div>
      <header
        className="landing-hero"
        onKeyDown={handleKeyDown}
        tabIndex="0"
        role="region"
        aria-roledescription="carousel"
        aria-label="Forge & Flight hero background showcase"
      >
        <div className="hero-carousel-bg" aria-hidden="true">
          {HERO_IMAGES.map((img, idx) => (
            <div
              key={idx}
              className={`hero-slide ${idx === currentSlide ? 'active' : ''}`}
            >
              <img
                src={img.src}
                alt={img.alt}
                className="hero-slide-img"
                loading={idx === 0 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
          <div className="hero-carousel-overlay" />
        </div>

        <div className="hero-top">
          <div className="wordmark"><span className="mark">F&amp;F</span>FORGE &amp; FLIGHT</div>
          <nav className="hero-nav">
            <a onClick={() => scrollTo('landing-founders')}>How it works</a>
            <a onClick={() => scrollTo('landing-community')}>Community</a>
            <a onClick={() => scrollTo('landing-founders')}>Explore</a>
          </nav>
          <div className="hero-cta-row">
            <button
              className="btn btn-outline theme-button-home"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/login')}>Sign in</button>
            <button className="btn btn-accent" onClick={() => navigate('/register')}>Join free</button>
          </div>
        </div>

        <div className="hero-body">
          <div className="eyebrow">The startup ecosystem, rebuilt</div>
          <h1 className="hero-title">
            Build your startup.<br />
            Find your team.<br />
            <em>Raise your round.</em>
          </h1>
          <p className="hero-sub">
            Forge &amp; Flight is the single platform where founders build in public,
            collaborators discover open roles, and investors fund verified rounds — with zero gatekeepers.
          </p>
          <div className="hero-cta-row">
            <button className="btn btn-accent" onClick={() => navigate('/register')}>Start your journey</button>
            <button className="btn btn-outline" onClick={() => navigate('/explore')}>Explore startups</button>
          </div>
        </div>

        <div className="hero-stats-row">
          <div className="hero-stats">
            <div className="hero-stat"><b className="mono">520</b><span>Active startups</span></div>
            <div className="hero-stat"><b className="mono">46</b><span>Funding open</span></div>
            <div className="hero-stat"><b className="mono">103</b><span>Collaborations</span></div>
            <div className="hero-stat"><b className="mono">38</b><span>Investors online</span></div>
          </div>
          <div
            className="hero-carousel-controls"
            aria-label="Hero background controls"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <button
              type="button"
              className="hero-ctrl-btn"
              onClick={prevSlide}
              title="Previous background image"
              aria-label="Previous background image"
            >
              <Icon name="back" />
            </button>
            <div className="hero-ctrl-dots">
              {HERO_IMAGES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`hero-ctrl-dot ${idx === currentSlide ? 'active' : ''}`}
                  onClick={() => setCurrentSlide(idx)}
                  title={`Show image ${idx + 1} of ${HERO_IMAGES.length}`}
                  aria-label={`Show image ${idx + 1} of ${HERO_IMAGES.length}`}
                />
              ))}
            </div>
            <button
              type="button"
              className="hero-ctrl-btn"
              onClick={nextSlide}
              title="Next background image"
              aria-label="Next background image"
            >
              <Icon name="arrow-r" />
            </button>
          </div>
        </div>
      </header>

      <section className="section" id="landing-founders">
        <div className="section-head">
          <div className="eyebrow">How it works</div>
          <h2>Three steps, one feed.</h2>
        </div>
        <div className="pillars-grid">
          <div className="pillar-card">
            <div className="p-num mono">01</div>
            <h3>Build in public</h3>
            <p>Publish product updates, milestones, and hiring notices to a community of active builders. Get feedback from day one.</p>
          </div>
          <div className="pillar-card">
            <div className="p-num mono">02</div>
            <h3>Collaborate &amp; hire</h3>
            <p>Open roles with transparent terms — equity, rev-share, or paid. Review applicants, manage offers, and form your team.</p>
          </div>
          <div className="pillar-card">
            <div className="p-num mono">03</div>
            <h3>Raise transparently</h3>
            <p>Set a round goal, upload your deck, and accept investments from verified angels and funds directly on the platform.</p>
          </div>
        </div>
      </section>

      <section className="section" id="landing-community" style={{ background: 'var(--surface)' }}>
        <div className="section-head">
          <div className="eyebrow">The network</div>
          <h2>A home for builders, not lurkers.</h2>
        </div>
        <div className="stats-strip">
          <div><b className="mono">$4.2M+</b><span>Raised on platform</span></div>
          <div><b className="mono">88%</b><span>Rounds reach goal</span></div>
          <div><b className="mono">340+</b><span>Collaborations filled</span></div>
          <div><b className="mono">14 days</b><span>Average time to first angel</span></div>
        </div>
      </section>

      <footer className="landing-footer">
        <div>&copy; {new Date().getFullYear()} Forge &amp; Flight. All rights reserved.</div>
        <div className="f-links">
          <a onClick={() => navigate('/explore')}>Explore</a>
          <a onClick={() => navigate('/feed')}>Feed</a>
          <a onClick={() => navigate('/login')}>Sign in</a>
        </div>
      </footer>
    </div>
  );
}
