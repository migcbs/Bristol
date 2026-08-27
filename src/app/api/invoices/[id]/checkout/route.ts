import { auth } from "@/lib/auth";
import { getVisibleStudentIds } from "@/lib/invoice-scope";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await context.params;
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const studentIds = await getVisibleStudentIds(session.user as { id: string; role: any });
  if (!studentIds.includes(invoice.studentId)) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  if (invoice.status === "PAID" || invoice.status === "CANCELED") {
    return Response.json({ error: "Este cargo no se puede pagar" }, { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  let checkoutSession;
  try {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: { name: invoice.description },
            unit_amount: invoice.amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/portal/cobranzas?paid=1`,
      cancel_url: `${baseUrl}/portal/cobranzas`,
      metadata: { invoiceId: invoice.id },
    });
  } catch (err) {
    console.error("Error creating Stripe checkout session", err);
    return Response.json(
      { error: "No se pudo iniciar el pago con Stripe" },
      { status: 502 }
    );
  }

  await prisma.invoice.update({
    where: { id },
    data: { stripeCheckoutSessionId: checkoutSession.id },
  });

  return Response.json({ url: checkoutSession.url });
}
