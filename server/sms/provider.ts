import { hashPhoneLookup } from "@/lib/security";

export type SmsMessage = { to: string; body: string };
export type SmsDeliveryResult = { providerMessageId?: string };
export interface SmsProvider { send(message: SmsMessage): Promise<SmsDeliveryResult>; }

class ConsoleSmsProvider implements SmsProvider {
  async send(message: SmsMessage): Promise<SmsDeliveryResult> {
    // Never emit a phone number, invite URL/token, or message body to logs.
    console.info(JSON.stringify({
      type: "sms_delivery",
      provider: "console",
      recipientHash: hashPhoneLookup(message.to),
      result: "accepted-for-development",
    }));
    return { providerMessageId: `dev_${Date.now().toString(36)}` };
  }
}

class TwilioSmsProvider implements SmsProvider {
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly messagingServiceSid?: string,
    private readonly fromNumber?: string,
  ) {}

  async send(message: SmsMessage): Promise<SmsDeliveryResult> {
    if (!this.accountSid || !this.authToken) throw new Error("Twilio credentials are not configured.");
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
    const params = new URLSearchParams({ To: message.to, Body: message.body });
    if (this.messagingServiceSid) params.set("MessagingServiceSid", this.messagingServiceSid);
    else if (this.fromNumber) params.set("From", this.fromNumber);
    else throw new Error("Twilio requires MessagingServiceSid or From.");

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      // Do not put Twilio response bodies into application logs; they can contain destination/provider details.
      throw new Error("SMS delivery failed.");
    }

    const payload = (await response.json()) as { sid?: string };
    return { providerMessageId: payload.sid };
  }
}

export function getSmsProvider(): SmsProvider {
  if (process.env.SMS_PROVIDER === "twilio") {
    return new TwilioSmsProvider(
      process.env.TWILIO_ACCOUNT_SID ?? "",
      process.env.TWILIO_AUTH_TOKEN ?? "",
      process.env.TWILIO_MESSAGING_SERVICE_SID,
      process.env.TWILIO_FROM_NUMBER,
    );
  }
  return new ConsoleSmsProvider();
}
