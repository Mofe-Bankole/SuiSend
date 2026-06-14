"use client";

const items = [
  { addr: "0x4f2a...8c91", action: "claimed 100.08 SUI", yield: "+0.08" },
  { addr: "0x7d3e...2c1a", action: "earning · 8.2% APY" },
  { addr: "0x9b1f...44de", action: "claimed 250.21 SUI", yield: "+0.21" },
  { addr: "0x2a8c...91bb", action: "created link · 50 SUI" },
  { addr: "0x6e0d...c732", action: "claimed 75.04 SUI", yield: "+0.04" },
  { addr: "0x1f5a...b820", action: "earning · 8.2% APY" },
  { addr: "0x8c3b...77fe", action: "created link · 120 SUI" },
  { addr: "0x3d9e...e145", action: "claimed 30.01 SUI", yield: "+0.01" },
  { addr: "0x5b7c...2298", action: "earning · 8.2% APY" },
  { addr: "0xa41f...90cd", action: "created link · 200 SUI" },
];

export default function MarqueeSection() {
  return (
    <div className="marquee-section">
      <div className="marquee-fade-l" />
      <div className="marquee-fade-r" />
      <div className="marquee-track">
        {[...items, ...items].map((item, i) => (
          <div key={i} className="marquee-item">
            <div className="m-dot" />
            <span className="m-addr">{item.addr}</span>
            {" "}{item.action}
            {item.yield && (
              <>
                {" "}
                <span className="m-yield">{item.yield}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
