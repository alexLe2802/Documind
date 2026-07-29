import { apiRequest } from "../lib/http";
import type {
  CheckoutResponse,
  CurrentSubscription,
  PaymentMethodCode,
  PaymentOrder,
  SubscriptionPlan,
  SubscriptionPlanCode,
} from "../types/payment";

export function fetchSubscriptionPlans() {
  return apiRequest<SubscriptionPlan[]>("/subscription/plans");
}

export function fetchCurrentSubscription() {
  return apiRequest<CurrentSubscription>("/subscription/current");
}

export function createCheckout(
  plan: Exclude<SubscriptionPlanCode, "FREE">,
  paymentMethod: PaymentMethodCode,
) {
  return apiRequest<CheckoutResponse>("/payments/checkout", {
    method: "POST",
    body: { plan, paymentMethod },
  });
}

export function fetchPayment(invoiceNumber: string) {
  return apiRequest<PaymentOrder>(
    `/payments/${encodeURIComponent(invoiceNumber)}`,
  );
}

export function fetchPaymentHistory() {
  return apiRequest<PaymentOrder[]>("/payments/history");
}

export function updatePaymentStatus(
  invoiceNumber: string,
  status: "FAILED" | "CANCELLED",
) {
  return apiRequest<PaymentOrder>(
    `/payments/${encodeURIComponent(invoiceNumber)}/status`,
    {
      method: "POST",
      body: { status },
    },
  );
}

export function submitSePayCheckout(checkout: CheckoutResponse) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = checkout.checkoutUrl;

  Object.entries(checkout.fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}
