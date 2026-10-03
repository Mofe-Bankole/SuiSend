"use client";

import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

const check = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2,7 5.5,10.5 12,4" />
  </svg>
);

export default function RecipientStory() {
  return (
    <div
      className="section-wrap mx-auto max-w-[1200px] px-12 max-md:px-6"
      id="experience"
      style={{ paddingTop: 0, paddingBottom: 0 }}
    >
      <SectionHead
        index={2}
        of={5}
        label="The experience"
        title={
          <>
            Built for the person
            <br />
            receiving the money.
          </>
        }
      />

      {/* Row 1 — claim experience */}
      <div className="story-row">
        <Reveal>
          <div>
            <h3 className="story-h3">They tap the link. That&apos;s the whole UX.</h3>
            <p className="story-p">
              No app to install, no address to copy, no seed phrase. The link
              opens to exactly one thing: their money, and a button to take it.
            </p>
            <ul className="story-points">
              <li>{check}Claim with any Sui wallet, or sign in with Google</li>
              <li>{check}Principal plus every second of yield it earned</li>
              <li>{check}On-chain receipt lands in their wallet as proof</li>
            </ul>
          </div>
        </Reveal>
        <Reveal delay="rd1">
          <div className="story-visual relative max-w-[380px] max-md:mx-auto max-md:w-full md:justify-self-end">
            <div className="mock">
              <div className="mock-body">
                <div className="mf-label">You received a payment</div>
                <div
                  className="font-display font-bold tracking-tight"
                  style={{ fontSize: 34 }}
                >
                  100.157 SUI
                </div>
                <div className="hist-meta mb-4">
                  from 0x4f2a…8c91 · +0.157 earned while waiting
                </div>
                <div className="mock-btn">Claim now →</div>
              </div>
            </div>
            <div
              className="mock-float hidden lg:block"
              style={{ left: "-56px", top: "-34px" }}
            >
              <div className="mf-label">Expires in</div>
              <div className="mf-val">13d 22h</div>
            </div>
            <div className="text-text-muted text-[11px] mt-4 text-center">
              Example · the actual claim page
            </div>
          </div>
        </Reveal>
      </div>

      {/* Row 2 — sender visibility */}
      <div className="story-row story-flip">
        <Reveal>
          <div className="story-visual max-w-[400px] max-md:mx-auto max-md:w-full">
            <div className="mock">
              <div className="mock-body">
                <div className="mock-label mb-3!">Your links</div>
                {[
                  { amt: "100 SUI", meta: "sent 2d ago · earning", status: "Pending", dot: "var(--accent)" },
                  { amt: "50 USDC", meta: "claimed 5h ago · +0.03 yield", status: "Claimed", dot: "var(--text-primary)" },
                  { amt: "25 SUI", meta: "refunded · +0.01 yield back", status: "Refunded", dot: "var(--text-muted)" },
                ].map((row) => (
                  <div className="hist-row" key={row.amt}>
                    <div>
                      <div className="hist-amount">{row.amt}</div>
                      <div className="hist-meta">{row.meta}</div>
                    </div>
                    <div className="hist-status">
                      <div className="hist-dot" style={{ background: row.dot }} />
                      {row.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-text-muted text-[11px] mt-4 text-center">
              Example · the history view
            </div>
          </div>
        </Reveal>
        <Reveal delay="rd1">
          <div className="md:justify-self-end">
            <h3 className="story-h3">Your money, always accounted for.</h3>
            <p className="story-p">
              Every link is a live position you can watch. See what&apos;s
              pending, what was claimed, and what each link earned — straight
              from the chain, not our database.
            </p>
            <ul className="story-points">
              <li>{check}Live status of every link you&apos;ve sent</li>
              <li>{check}Yield tracked to the block, visible on-chain</li>
              <li>{check}Take a link back anytime it&apos;s unclaimed</li>
            </ul>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
