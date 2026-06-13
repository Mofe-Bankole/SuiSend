export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-100 flex items-center justify-between px-12 h-16 bg-[rgba(8,8,10,0.80)] backdrop-blur-xl border-b border-border">
      <a href="#" className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-tight text-text-primary no-underline">
        <div className="w-[7px] h-[7px] rounded-full bg-accent animate-[blink_2.4s_ease-in-out_infinite]" />
        SuiSend
      </a>
      <ul className="flex gap-7 list-none max-md:hidden">
        <li><a href="#how" className="text-text-secondary text-[13px] no-underline transition-colors hover:text-text-primary">How it works</a></li>
        <li><a href="#send" className="text-text-secondary text-[13px] no-underline transition-colors hover:text-text-primary">Send</a></li>
        <li><a href="https://suiexplorer.com" target="_blank" className="text-text-secondary text-[13px] no-underline transition-colors hover:text-text-primary">Explorer ↗</a></li>
      </ul>
      <a href="#send" className="px-[18px] py-2 bg-text-primary text-background rounded-[6px] font-display text-[13px] font-semibold no-underline transition-opacity hover:opacity-85">
        Launch app →
      </a>
    </nav>
  );
}
