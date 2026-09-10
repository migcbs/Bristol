"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { SignInPage, type Testimonial } from "@/components/ui/sign-in";

const TESTIMONIALS: Testimonial[] = [
  {
    initials: "MF",
    name: "María Fernanda G.",
    role: "Alumna, nivel B2",
    text: "Entré sin saber casi nada y en año y medio ya podía sostener una entrevista de trabajo en inglés.",
  },
  {
    initials: "RC",
    name: "Roberto C.",
    role: "Padre de familia",
    text: "Me encanta que pueda ver el avance de mi hija y sus calificaciones desde el portal.",
  },
  {
    initials: "AS",
    name: "Ana Sofía L.",
    role: "Alumna, nivel C1",
    text: "Los grupos pequeños hacen toda la diferencia. Los profesores realmente conocen tu progreso.",
  },
];

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Correo o contraseña incorrectos, o cuenta no verificada.");
      return;
    }

    router.push(params.get("callbackUrl") ?? "/admin");
  }

  return (
    <main className="relative bg-bg text-text">
      <Link
        href="/"
        className="absolute left-5 top-5 z-20 inline-flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-3 py-1.5 text-xs font-medium text-muted backdrop-blur-sm transition-colors hover:text-primary"
      >
        <ArrowLeft size={14} /> Volver al inicio
      </Link>
      <SignInPage
        title={<span className="text-text">Bienvenido de vuelta</span>}
        description="Entra a tu cuenta de Bristol para seguir tu progreso."
        testimonials={TESTIMONIALS}
        errorMessage={error}
        loading={loading}
        onSignIn={handleSubmit}
      />
    </main>
  );
}
