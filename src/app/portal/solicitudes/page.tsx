import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { RecordCard } from "@/components/ui/record-card";
import { Tag } from "@/components/ui/tag";
import { TeacherSolicitudModal } from "@/components/portal/teacher-solicitud-modal";
import { ArrowRight } from "lucide-react";
import type { Role, GroupChangeRequestStatus, GroupChangeRequestType } from "@prisma/client";

const TYPE_LABELS: Record<GroupChangeRequestType, string> = {
  BAJA: "Baja",
  CAMBIO_GRUPO: "Cambio de grupo",
};
const STATUS_TONE: Record<GroupChangeRequestStatus, "amber" | "green" | "red"> = {
  PENDIENTE: "amber",
  APROBADA: "green",
  RECHAZADA: "red",
};
const STATUS_LABELS: Record<GroupChangeRequestStatus, string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};

// A teacher's own solicitudes — the "who does the requesting" half of the
// Solicitudes flow the user asked for 2026-09-09 ("creo que eso debería
// poder pedirlo un docente y recepción y el director lo aprueba"). The
// approval side already existed at /admin/control-escolar/solicitudes;
// this page is what was missing.
export default async function PortalSolicitudesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER") redirect("/portal");

  const teacherId = (session.user as { id: string }).id;
  const scope = await getCampusScope({ id: teacherId, role });
  const campusIds = scope.type === "CAMPUS_LIST" ? scope.campusIds : [];

  const [myGroups, destinationGroups, myRequests] = await Promise.all([
    prisma.group.findMany({
      where: { teacherId },
      include: {
        enrollments: {
          where: { completedAt: null },
          include: { student: { select: { id: true, user: { select: { name: true } } } } },
        },
      },
    }),
    campusIds.length
      ? prisma.group.findMany({ where: { campusId: { in: campusIds } }, select: { id: true, name: true } })
      : [],
    prisma.groupChangeRequest.findMany({
      where: { requestedById: teacherId },
      orderBy: { createdAt: "desc" },
      include: { student: { include: { user: { select: { name: true } } } }, currentGroup: true, requestedGroup: true },
    }),
  ]);

  const studentOptions = myGroups.flatMap((g) =>
    g.enrollments.map((e) => ({
      studentId: e.student.id,
      name: e.student.user.name,
      groupId: g.id,
      groupName: g.name,
    }))
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Solicitudes</h1>
          <p className="mt-1 text-sm text-muted">Pide una baja o un cambio de grupo para uno de tus alumnos.</p>
        </div>
        <TeacherSolicitudModal students={studentOptions} destinationGroups={destinationGroups} />
      </div>

      <div className="mt-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {myRequests.map((request) => (
          <RecordCard
            key={request.id}
            avatarId={request.id}
            avatarLabel={request.student.user.name.trim().charAt(0).toUpperCase() || "?"}
            name={request.student.user.name}
            meta={
              <span className="flex items-center gap-1">
                {request.currentGroup.name}
                {request.requestedGroup && (
                  <>
                    <ArrowRight size={11} /> {request.requestedGroup.name}
                  </>
                )}
              </span>
            }
            tags={
              <>
                <Tag tone={request.type === "BAJA" ? "red" : "blue"}>{TYPE_LABELS[request.type]}</Tag>
                <Tag tone={STATUS_TONE[request.status]}>{STATUS_LABELS[request.status]}</Tag>
              </>
            }
          />
        ))}
      </div>

      {myRequests.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">Todavía no has enviado ninguna solicitud.</p>
      )}
    </div>
  );
}
