export type AgeBracket = "NINO" | "ADOLESCENTE" | "ADULTO";

export function computeAgeBracket(birthdate: Date, asOf: Date = new Date()): AgeBracket {
  let age = asOf.getFullYear() - birthdate.getFullYear();
  const hasHadBirthdayThisYear =
    asOf.getMonth() > birthdate.getMonth() ||
    (asOf.getMonth() === birthdate.getMonth() && asOf.getDate() >= birthdate.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;

  if (age < 12) return "NINO";
  if (age < 18) return "ADOLESCENTE";
  return "ADULTO";
}
