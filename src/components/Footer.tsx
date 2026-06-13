export default function Footer() {
  return (
    <footer className="flex items-center justify-between px-12 py-7 border-t border-border max-md:flex-col max-md:gap-4 max-md:p-6">
      <div className="f-logo">SuiSend</div>
      <ul className="f-links">
        <li><a href="#">Docs</a></li>
        <li><a href="#">GitHub</a></li>
        <li><a href="https://suiexplorer.com" target="_blank">Explorer</a></li>
      </ul>
      <div className="f-note">Built for Sui Overflow 2026</div>
    </footer>
  );
}
