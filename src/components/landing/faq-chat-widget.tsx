"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, ArrowLeft } from "lucide-react";

const FAQS = [
  {
    question: "¿Qué niveles de inglés maneja Bristol?",
    answer:
      "Seis niveles alineados al Marco Común Europeo de Referencia (CEFR), de A1 a C2. Antes de inscribirte te ubicamos en el nivel que corresponde a tu dominio actual del idioma.",
  },
  {
    question: "¿Las clases son presenciales o en línea?",
    answer:
      "Ambas. Puedes tomar tus clases de forma presencial en nuestros planteles de Coatepec y Xalapa, o de forma virtual si prefieres estudiar desde casa.",
  },
  {
    question: "¿Bristol tiene alguna certificación o reconocimiento oficial?",
    answer:
      "Sí. Contamos con más de 20 años de experiencia enseñando inglés, certificación oficial como institución ante la SEP, y afiliación académica con Cambridge.",
  },
  {
    question: "¿Puedo dar seguimiento al progreso de mi hijo o hija?",
    answer:
      "Sí. Como padre o tutor tienes acceso a un portal donde puedes ver el avance, la asistencia y las calificaciones de tu hijo o hija en tiempo real.",
  },
  {
    question: "¿Cómo funciona el pago de la colegiatura?",
    answer:
      "Los padres o tutores gestionan y pagan la colegiatura de sus hijos menores de edad directamente desde el portal. Si el alumno ya es mayor de edad, puede pagar la suya propia.",
  },
  {
    question: "¿Cómo me inscribo?",
    answer:
      "Llena el formulario de contacto con tus datos y un asesor te contactará en menos de 24 horas para ubicarte en el nivel y plantel correctos.",
  },
];

export function FaqChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [askedIndexes, setAskedIndexes] = useState<number[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [askedIndexes]);

  // A logged-in area (admin/portal) already has its own support surfaces —
  // this widget is for anonymous visitors on the public site.
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/portal")) {
    return null;
  }

  const remaining = FAQS.map((_, i) => i).filter((i) => !askedIndexes.includes(i));

  function ask(index: number) {
    setAskedIndexes((prev) => [...prev, index]);
  }

  function reset() {
    setAskedIndexes([]);
  }

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
      {open && (
        <div
          role="dialog"
          aria-label="Preguntas frecuentes"
          className="flex h-[calc(100vh-8rem)] max-h-[42rem] w-[26rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_20px_50px_-15px_rgba(20,20,43,0.35)]"
        >
          <div className="flex items-center justify-between border-b border-border bg-primary px-5 py-4 text-primary-foreground">
            <div>
              <p className="font-display text-sm font-bold">Preguntas frecuentes</p>
              <p className="text-xs text-white/70">Elige una pregunta para ver la respuesta</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="rounded-full p-1.5 transition-colors hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {askedIndexes.length === 0 && (
              <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-surface px-4 py-3 text-base leading-relaxed text-text">
                Hola 👋 Estas son las preguntas que más nos hacen. Toca una para ver la respuesta.
              </div>
            )}

            {askedIndexes.map((index) => (
              <div key={index} className="space-y-2">
                <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-base leading-relaxed text-primary-foreground">
                  {FAQS[index].question}
                </div>
                <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-surface px-4 py-3 text-base leading-relaxed text-text">
                  {FAQS[index].answer}
                </div>
              </div>
            ))}

            {remaining.length === 0 && (
              <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-surface px-4 py-3 text-base leading-relaxed text-text">
                Eso es todo lo que tengo por aquí. Si tu duda sigue sin resolverse,{" "}
                <a href="/#contacto" className="font-semibold text-accent underline decoration-accent/30 underline-offset-4">
                  escríbenos
                </a>{" "}
                y con gusto te ayudamos.
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            {askedIndexes.length > 0 && remaining.length > 0 && (
              <button
                type="button"
                onClick={reset}
                className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-primary"
              >
                <ArrowLeft size={12} /> Ver todas las preguntas
              </button>
            )}
            <div className="flex flex-wrap gap-2">
              {remaining.map((index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => ask(index)}
                  className="rounded-full border border-border px-3.5 py-2 text-left text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                >
                  {FAQS[index].question}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar preguntas frecuentes" : "Abrir preguntas frecuentes"}
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_10px_24px_-10px_rgba(230,51,41,0.55)] transition-all duration-200 ease-out hover:bg-accent-dark hover:shadow-[0_14px_28px_-10px_rgba(230,51,41,0.6)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
