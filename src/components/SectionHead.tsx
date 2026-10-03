import Reveal from "./Reveal";

export default function SectionHead({
  index,
  of,
  label,
  title,
}: {
  index: number;
  of: number;
  label: string;
  title: React.ReactNode;
}) {
  return (
    <>
      <div className="snum">
        <span>
          [ <b>{String(index).padStart(2, "0")}</b> of{" "}
          {String(of).padStart(2, "0")} ]
        </span>
        <span className="snum-rule" />
        <span>{label}</span>
      </div>
      <Reveal>
        <h2 className="section-h2">{title}</h2>
      </Reveal>
    </>
  );
}
