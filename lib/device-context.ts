/**
 * Who a tablet request is about: the tablet (from its cookie), its teacher's running unit and the
 * student of that unit. Every tablet route and action starts here, so a tablet can only ever reach
 * the student its own teacher is teaching right now.
 */
import { currentDevice, type DeviceView } from "./devices";
import * as repo from "./repo";
import { activeUnitForTeacher, type UnitView } from "./units";

export type DeviceContext = { device: DeviceView; unit: UnitView | null; student: repo.Student | null };

export async function deviceContext(): Promise<DeviceContext | null> {
  const device = await currentDevice();
  if (!device) return null;
  const unit = activeUnitForTeacher(device.teacher_id);
  return { device, unit, student: unit ? repo.getStudent(unit.student_id) : null };
}
