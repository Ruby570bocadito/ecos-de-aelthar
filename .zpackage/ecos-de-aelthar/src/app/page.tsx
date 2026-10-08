'use client';

import dynamic from 'next/dynamic';

const EcosGame = dynamic(() => import('@/components/game/EcosGame'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-black">
      <p className="animate-pulse font-mono text-sm text-amber-200/70">Tejiendo el canto de Aelthar…</p>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-black">
      <EcosGame />
    </main>
  );
}
