import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'PayrollRails — Cross-Border Stablecoin Payroll',
  description: 'Pay 50 people in 5 countries in 8 seconds for ~$0.05 using Stellar USDC',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">PR</span>
            </div>
            <span className="font-bold text-slate-800 text-lg">PayrollRails</span>
          </div>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 text-sm">Cross-border USDC payroll on Stellar</span>
          <div className="ml-auto flex items-center gap-4">
            <a href="/" className="text-sm text-slate-600 hover:text-brand-600 transition-colors">
              Dashboard
            </a>
            <a href="/runs" className="text-sm text-slate-600 hover:text-brand-600 transition-colors">
              Runs
            </a>
            <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">
              Testnet
            </span>
          </div>
        </nav>
        <main>{children}</main>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
