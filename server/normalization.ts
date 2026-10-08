import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizePhone(input: string): string {
  const parsed = parsePhoneNumberFromString(input.trim());
  if (!parsed || !parsed.isValid()) throw new Error("Invalid phone number.");
  return parsed.number;
}
