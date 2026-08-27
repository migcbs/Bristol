export function Footer() {
  return (
    <footer className="border-t border-border bg-surface px-6 py-10 text-sm text-gray-600">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:justify-between">
        <div>
          <p className="font-bold text-primary">Bristol — Inglés Profesional</p>
          <p>Contacto: hola@bristol-ingles.com · (55) 0000 0000</p>
        </div>
        <div className="flex gap-6">
          <a href="/programas" className="hover:text-primary">Programas</a>
          <a href="/planteles" className="hover:text-primary">Planteles</a>
          <a href="/precios" className="hover:text-primary">Precios</a>
        </div>
      </div>
      <p className="mt-6 text-xs text-gray-400">
        © {new Date().getFullYear()} Bristol. Todos los derechos reservados.
      </p>
    </footer>
  );
}
