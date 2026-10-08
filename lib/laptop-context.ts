/**
 * Who a laptop request is about: the session from the laptop's cookie, its unit and the student of that
 * unit. Every laptop page, route and action starts here. The student only ever comes from the unit the
 * session was confirmed for, and only while that unit runs.
 */
import { cookies } from "next/headers";
import { LAPTOP_COOKIE, laptopForToken, laptopState, type LaptopView } from "./laptop";
import * as repo from "./repo";
import { getUnit, type UnitView } from "./units";

export async function currentLaptop(): Promise<LaptopView | null> {
  return laptopForToken((await cookies()).get(LAPTOP_COOKIE)?.value);
}

export type LaptopContext = { session: LaptopView; unit: UnitView; student: repo.Student };

/** Only for a confirmed laptop of a running unit; null otherwise. */
export async function laptopContext(): Promise<LaptopContext | null> {
  const session = await currentLaptop();
  if (!session || laptopState(session) !== "aktiv") return null;
  const unit = getUnit(session.unit_id);
  const student = unit ? repo.getStudent(unit.student_id) : null;
  if (!unit || unit.status !== "gestartet" || !student) return null;
  return { session, unit, student };
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
  // only the laptop pages get it; the teacher area never sees it
  path: "/mitmachen",
};

/** No expiry date: the browser forgets it when it is closed, and the server forgets the session with the unit. */
export async function setLaptopCookie(token: string) {
  (await cookies()).set(LAPTOP_COOKIE, token, cookieOptions);
}

export async function clearLaptopCookie() {
  (await cookies()).set(LAPTOP_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}
