import { redirect } from "next/navigation";

// La raíz manda al dashboard. El middleware decide: si no hay sesión,
// rebota a /login.
export default function Index() {
  redirect("/dashboard");
}
