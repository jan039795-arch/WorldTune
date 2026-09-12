import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">Aquí no hay nada</h1>
      <p className="mt-2 text-sm text-ink-500">
        La emisora, el canal o el lugar que buscas no está en el catálogo. Puede que la señal se haya
        dado de baja.
      </p>
      <div className="mt-4 flex justify-center gap-3 text-sm">
        <Link href="/radio" className="focus-ring text-brand-400 hover:underline">
          Ir a radio
        </Link>
        <Link href="/tv" className="focus-ring text-brand-400 hover:underline">
          Ir a televisión
        </Link>
      </div>
    </div>
  );
}
