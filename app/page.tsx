import { redirect } from "next/navigation";

export default function Home() {
  // Redirecionar para login
  redirect("/login");
}
