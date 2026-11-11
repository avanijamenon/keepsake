import { Suspense } from "react";
import { AuthCard } from "@/components/shell/AuthCard";

export default function Page() {
  return (
    <Suspense>
      <AuthCard mode="sign-up" />
    </Suspense>
  );
}
