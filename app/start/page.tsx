import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { StartIdentity } from "@/components/start-identity";

export const dynamic = "force-dynamic";
export const metadata = { title: "Start privately" };

export default async function StartPage() {
  const user = await getSessionUser();
  if (user?.username) redirect("/dashboard");
  return <StartIdentity />;
}
