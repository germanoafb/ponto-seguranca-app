export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* Layout para as páginas da aplicação */}
      {children}
    </div>
  );
}
