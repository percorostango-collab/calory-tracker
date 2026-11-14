import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <h2 className="text-3xl font-bold mb-4">Pagina non trovata</h2>
      <p className="text-muted-foreground mb-8">
        La pagina che stai cercando non esiste o è stata spostata.
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
      >
        Torna alla Home
      </Link>
    </div>
  );
}
