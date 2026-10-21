"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { setFeedbackStatus, type FeedbackStatus } from "@/lib/feedback";

/** The Verwaltung ticks a feedback off, or opens it again. */
export async function feedbackStatusAction(id: number, status: FeedbackStatus) {
  await requireAdmin();
  setFeedbackStatus(id, status === "erledigt" ? "erledigt" : "offen");
  revalidatePath("/mehr/feedback");
  revalidatePath("/mehr");
}
