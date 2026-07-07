// Layout para rutas de auth (login, register)
// Sin SessionProvider ni protección - es público
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}