import Link from 'next/link';
import { Marca } from '@/components/ui';

export default function LayoutAcceso({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-4 py-12">
      <Link href="/" className="self-start" aria-label="Tallerflota, inicio"><Marca /></Link>
      <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 sm:p-8">{children}</div>
    </main>
  );
}
