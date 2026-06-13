import Reveal from "./Reveal";

export default function CTA() {
  return (
    <section className="border-t border-border px-12 py-[120px] flex flex-col items-center text-center relative overflow-hidden max-md:px-6">
      <div className="cta-bg-glow" />
      <div className="eyebrow relative">Sui Overflow 2026 · Testnet live</div>
      <Reveal>
        <h2 className="cta-h2">
          Stop sending.<br />
          Start <em>earning</em>.
        </h2>
      </Reveal>
      <Reveal delay="rd1">
        <p className="cta-sub">Every payment you&apos;ve ever sent sat idle. Never again.</p>
      </Reveal>
      <Reveal delay="rd2">
        <div className="cta-actions">
          <a href="#send" className="btn-p">
            Create your first link →
          </a>
          <a href="https://github.com" target="_blank" className="btn-s">
            View on GitHub
          </a>
        </div>
      </Reveal>
    </section>
  );
}
