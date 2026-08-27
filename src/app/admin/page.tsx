import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-lg font-semibold">Panel administrativo</h1>
      <p className="mt-2 text-sm text-muted">
        <Link href="/admin/admisiones" className="font-medium text-primary hover:underline">
          Ir a Admisiones
        </Link>{" "}
        para dar seguimiento a los leads capturados desde la landing.
        Cobranzas, reinscripciones, comunicaciones y gestión escolar se
        agregarán en las siguientes iteraciones de Spec 2.
      </p>
    </div>
  );
}
