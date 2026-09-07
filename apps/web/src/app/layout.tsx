import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'AlphaFinance • Your money, in perspective',
  description: 'Seu espaço pessoal para organizar a vida financeira.',
  icons: { icon: '/logo.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
