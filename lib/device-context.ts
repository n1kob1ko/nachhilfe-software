/**
 * Who a tablet request is about: the tablet (from its cookie), the running unit it shows and the
 * student of that unit. Every tablet route and action starts here, so a tablet can only ever reach
 * a student its own teacher is teaching right now. With two running units (D26) that is the unit
 * chosen on the tablet; until one is chosen `choices` holds both and nothing of a student is reachable.
 */
import { currentDevice, deviceUnit, type DeviceView } from "./devices";
import * as repo from "./repo";
import type { UnitView } from "./units";

export type DeviceContext = {
  device: DeviceView;
  unit: UnitView | null;
  student: repo.Student | null;
  /** two units run and this tablet has not chosen yet: „Wer arbeitet an diesem Gerät?“ */
  choices: UnitView[];
};

export async function deviceContext(): Promise<DeviceContext | null> {
  const device = await currentDevice();
  if (!device) return null;
  const { unit, choices } = deviceUnit(device);
  return { device, unit, student: unit ? repo.getStudent(unit.student_id) : null, choices };
}
