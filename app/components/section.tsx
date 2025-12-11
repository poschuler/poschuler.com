export type SectionProps = {
  title?: string;
  children: React.ReactNode;
};

export function Section({ title, children }: SectionProps) {
  return (
    <section className="flex min-h-0 flex-col gap-y-3">
      {title && <h2 className="text-xl font-bold">{title}</h2>}
      {children}
    </section>
  );
}
