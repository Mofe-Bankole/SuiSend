const protocols = [
  "Sui Network",
  "Scallop Protocol",
  "Next.js",
  "Fastify",
  "@mysten/dapp-kit",
  "Walrus",
];

export default function ProtocolStrip() {
  return (
    <div className="border-t border-border px-12 max-md:px-6">
      <div className="ps-inner mx-auto max-w-[1200px] flex items-center gap-10 py-12">
        <div className="ps-label">Built with</div>
        <div className="ps-rule" />
        <div className="flex gap-9 flex-wrap items-center">
          {protocols.map((p) => (
            <div key={p} className="ps-item">
              {p}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
