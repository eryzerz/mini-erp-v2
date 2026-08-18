import { redirect } from "next/navigation";

export default function HomePage(): React.ReactElement {
  redirect("/dashboard");
}
