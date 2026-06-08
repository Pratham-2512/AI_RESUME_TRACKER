import { redirect } from "next/navigation";

// Single-user app: no marketing/auth landing — go straight to the workspace.
export default function Home() {
  redirect("/app/dashboard");
}
