type AppContentLayoutProps = {
  title: string;
  actionButton?: React.ReactNode;
  children: React.ReactNode;
};

export default function AppContentLayout({
  title,
  children,
  actionButton,
}: AppContentLayoutProps) {
  return (
    <main className="flex flex-1 flex-col gap-4 lg:gap-6 p-4 lg:p-6">
      {children}
    </main>
  );
}
