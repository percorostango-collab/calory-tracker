import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export const instant = false;

export default function Page() {
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <Suspense fallback={<div className="text-sm text-slate-500">Caricamento...</div>}>
        <SignIn />
      </Suspense>
    </div>
  );
}
