export type SectionProps = {
  title?: string;
  children: React.ReactNode;
};

export function Section({ title, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-y-3">
      {title && (
        <h2 className="font-sans font-semibold text-xl">{title}</h2>
      )}
      {children}
    </section>
  );
}
