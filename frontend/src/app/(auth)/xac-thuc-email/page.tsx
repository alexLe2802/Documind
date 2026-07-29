import { Suspense } from "react";
import { VerifyEmailView } from "../../../views/VerifyEmailView";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="screen-message">Đang tải...</div>}>
      <VerifyEmailView />
    </Suspense>
  );
}
