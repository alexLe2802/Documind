import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { SePayPgClient } from 'sepay-pg-node';
import {
  DocumentStatus,
  MessageSender,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SubscriptionPlan,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import {
  CheckoutResponseDto,
  CurrentSubscriptionDto,
  PaymentOrderDto,
  SubscriptionPlanDto,
} from './dto/payment-response.dto';
import { SepayIpnDto } from './dto/sepay-ipn.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';

const CURRENCY = 'VND';
const SUBSCRIPTION_MONTHS = 1;
const PAYMENT_EXPIRY_MINUTES = 2;

const PLAN_QUOTAS = {
  FREE: {
    storageLimitMb: 100,
    uploadLimit: 10,
    aiChatLimit: 20,
  },
  STUDENT: {
    storageLimitMb: 1024,
    uploadLimit: 100,
    aiChatLimit: 300,
  },
  PRO: {
    storageLimitMb: 5120,
    uploadLimit: 500,
    aiChatLimit: null,
  },
} satisfies Record<
  SubscriptionPlan,
  {
    storageLimitMb: number;
    uploadLimit: number;
    aiChatLimit: number | null;
  }
>;

type CheckoutFields = Record<string, string | number>;

interface SepayBankWebhook {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  subAccount: string | null;
  transferType: string;
  transferAmount: number;
  accumulated: number;
  code: string | null;
  content: string;
  referenceCode: string;
  description: string;
}

interface SepayOrderDetail {
  id?: string;
  customer_id?: string | null;
  order_invoice_number?: string;
  order_status?: string;
  order_amount?: string | number;
  order_currency?: string;
  updated_at?: string;
}

@Injectable()
export class PaymentsService {
  private readonly isEnabled: boolean;
  private readonly merchantId: string;
  private readonly secretKey: string;
  private readonly webhookApiKey: string;
  private readonly frontendUrl: string;
  private readonly studentPrice: number;
  private readonly proPrice: number;
  private readonly client: SePayPgClient | null;

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.isEnabled = configService.get<boolean>('SEPAY_ENABLED', false);
    this.merchantId = configService.get<string>('SEPAY_MERCHANT_ID', '');
    this.secretKey = configService.get<string>('SEPAY_SECRET_KEY', '');
    this.webhookApiKey = configService.get<string>('SEPAY_WEBHOOK_API_KEY', '');
    this.frontendUrl = configService
      .get<string>('SEPAY_FRONTEND_URL', 'http://localhost:3000')
      .replace(/\/+$/, '');
    this.studentPrice = configService.get<number>(
      'SEPAY_STUDENT_PRICE_VND',
      149000,
    );
    this.proPrice = configService.get<number>('SEPAY_PRO_PRICE_VND', 349000);

    this.client = this.isEnabled
      ? new SePayPgClient({
          env: configService.get<'sandbox' | 'production'>(
            'SEPAY_ENV',
            'sandbox',
          ),
          merchant_id: this.merchantId,
          secret_key: this.secretKey,
        })
      : null;
  }

  getPlans(): SubscriptionPlanDto[] {
    return [
      {
        code: SubscriptionPlan.FREE,
        name: 'Free',
        amount: 0,
        currency: CURRENCY,
        billingPeriod: 'NONE',
      },
      {
        code: SubscriptionPlan.STUDENT,
        name: 'Student',
        amount: this.studentPrice,
        currency: CURRENCY,
        billingPeriod: 'MONTHLY',
      },
      {
        code: SubscriptionPlan.PRO,
        name: 'Pro',
        amount: this.proPrice,
        currency: CURRENCY,
        billingPeriod: 'MONTHLY',
      },
    ];
  }

  async getCurrentSubscription(
    userId: string,
  ): Promise<CurrentSubscriptionDto> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: {
        id: true,
        plan: true,
        startsAt: true,
        expiresAt: true,
        storageLimitMb: true,
        uploadLimit: true,
        aiChatLimit: true,
        aiChatsUsed: true,
      },
    });

    const now = new Date();
    if (subscription?.expiresAt && subscription.expiresAt <= now) {
      await this.activateFreePlan(userId, 'subscription.expired');
      return this.createFreeSubscriptionResponse(userId, now);
    }

    if (!subscription) {
      const usagePeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return this.createFreeSubscriptionResponse(userId, usagePeriodStart);
    }

    const usage = await this.getUserUsage(
      userId,
      subscription.startsAt,
      subscription.uploadLimit,
      subscription.storageLimitMb,
      subscription.aiChatLimit,
    );

    return {
      plan: subscription.plan,
      startsAt: subscription.startsAt.toISOString(),
      expiresAt: subscription.expiresAt?.toISOString() ?? null,
      storageLimitMb: subscription.storageLimitMb,
      uploadLimit: subscription.uploadLimit,
      aiChatLimit: subscription.aiChatLimit,
      ...usage,
    };
  }

  async createCheckout(
    user: AuthenticatedUser,
    payload: CreateCheckoutDto,
  ): Promise<CheckoutResponseDto> {
    const client = this.requireClient();
    const now = new Date();

    const activeSubscription = await this.prisma.subscription.findUnique({
      where: { userId: user.id },
      select: { plan: true, expiresAt: true },
    });
    const amount = this.getCheckoutAmount(
      payload.plan,
      activeSubscription,
      now,
    );

    const pendingOrder = await this.prisma.paymentOrder.findFirst({
      where: {
        userId: user.id,
        plan: payload.plan,
        status: PaymentStatus.PENDING,
        expiresAt: { gt: now },
      },
      select: {
        invoiceNumber: true,
        plan: true,
        paymentMethod: true,
        amount: true,
        expiresAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (pendingOrder) {
      return this.buildCheckoutResponse(
        client,
        user.id,
        pendingOrder.plan,
        pendingOrder.paymentMethod,
        pendingOrder.invoiceNumber,
        pendingOrder.amount,
        pendingOrder.expiresAt,
      );
    }

    const invoiceNumber = this.createInvoiceNumber();
    const expiresAt = new Date(
      now.getTime() + PAYMENT_EXPIRY_MINUTES * 60 * 1000,
    );

    await this.prisma.$transaction(async (transaction) => {
      await transaction.paymentOrder.create({
        data: {
          invoiceNumber,
          userId: user.id,
          plan: payload.plan,
          paymentMethod: payload.paymentMethod,
          amount,
          currency: CURRENCY,
          expiresAt,
        },
      });
      await this.createAuditLog(transaction, user.id, 'payment.created', {
        invoiceNumber,
        plan: payload.plan,
        paymentMethod: payload.paymentMethod,
        amount,
        currency: CURRENCY,
        expiresAt: expiresAt.toISOString(),
      });
    });

    return this.buildCheckoutResponse(
      client,
      user.id,
      payload.plan,
      payload.paymentMethod,
      invoiceNumber,
      amount,
      expiresAt,
    );
  }

  private buildCheckoutResponse(
    client: SePayPgClient,
    userId: string,
    plan: SubscriptionPlan,
    paymentMethod: PaymentMethod,
    invoiceNumber: string,
    amount: number,
    expiresAt: Date,
  ): CheckoutResponseDto {
    const callbackUrl = `${this.frontendUrl}/goi-dich-vu`;
    const description = `DocuMind ${plan} monthly subscription`;
    // SePay verifies both the signature and submitted form fields in this
    // insertion order. sepay-pg-node 1.0.0 instead signs Object.keys(fields)
    // and appends merchant last, producing an invalid signature.
    const unsignedFields: CheckoutFields = {
      order_amount: amount,
      merchant: this.merchantId,
      currency: CURRENCY,
      operation: 'PURCHASE',
      order_description: description,
      order_invoice_number: invoiceNumber,
      customer_id: userId,
      payment_method: paymentMethod,
      success_url: `${callbackUrl}?payment=success&invoice=${invoiceNumber}`,
      error_url: `${callbackUrl}?payment=error&invoice=${invoiceNumber}`,
      cancel_url: `${callbackUrl}?payment=cancel&invoice=${invoiceNumber}`,
    };
    const signaturePayload = Object.entries(unsignedFields)
      .map(([name, value]) => `${name}=${value}`)
      .join(',');
    const fields: CheckoutFields = {
      ...unsignedFields,
      signature: createHmac('sha256', this.secretKey)
        .update(signaturePayload)
        .digest('base64'),
    };

    return {
      invoiceNumber,
      checkoutUrl: client.checkout.initCheckoutUrl(),
      expiresAt: expiresAt.toISOString(),
      fields,
    };
  }

  async getPayment(
    userId: string,
    invoiceNumber: string,
  ): Promise<PaymentOrderDto> {
    const payment = await this.prisma.paymentOrder.findUnique({
      where: { invoiceNumber },
      select: {
        id: true,
        userId: true,
        invoiceNumber: true,
        plan: true,
        paymentMethod: true,
        amount: true,
        currency: true,
        status: true,
        paidAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    if (!payment || payment.userId !== userId) {
      throw new NotFoundException('Payment order not found');
    }

    if (payment.status === PaymentStatus.PENDING) {
      await this.reconcilePendingPayment(payment);
      await this.expirePendingPayments(userId, invoiceNumber);
    }

    const refreshedPayment = await this.prisma.paymentOrder.findUnique({
      where: { invoiceNumber },
      select: {
        invoiceNumber: true,
        plan: true,
        paymentMethod: true,
        amount: true,
        currency: true,
        status: true,
        paidAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    if (!refreshedPayment) {
      throw new NotFoundException('Payment order not found');
    }

    return this.toPaymentResponse(refreshedPayment);
  }

  async getPaymentHistory(userId: string): Promise<PaymentOrderDto[]> {
    await this.expirePendingPayments(userId);
    const payments = await this.prisma.paymentOrder.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
      select: {
        invoiceNumber: true,
        plan: true,
        paymentMethod: true,
        amount: true,
        currency: true,
        status: true,
        paidAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return payments.map((payment) => this.toPaymentResponse(payment));
  }

  async updatePaymentStatus(
    userId: string,
    invoiceNumber: string,
    payload: UpdatePaymentStatusDto,
  ): Promise<PaymentOrderDto> {
    const status =
      payload.status === 'CANCELLED'
        ? PaymentStatus.CANCELLED
        : PaymentStatus.FAILED;
    const payment = await this.prisma.paymentOrder.findUnique({
      where: { invoiceNumber },
      select: { id: true, userId: true, status: true },
    });

    if (!payment || payment.userId !== userId) {
      throw new NotFoundException('Payment order not found');
    }
    if (payment.status === PaymentStatus.PAID) {
      throw new ConflictException('Paid payments cannot be changed');
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.paymentOrder.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: { status },
      });
      await this.createAuditLog(
        transaction,
        userId,
        `payment.${status.toLowerCase()}`,
        { invoiceNumber },
      );
    });

    return this.getPayment(userId, invoiceNumber);
  }

  async processIpn(
    authorization: string | undefined,
    payload: SepayIpnDto,
  ): Promise<{ acknowledged: boolean }> {
    this.verifyIpnAuthorization(authorization);

    if (
      payload.notification_type !== 'ORDER_PAID' &&
      payload.notification_type !== 'TRANSACTION_VOID'
    ) {
      return { acknowledged: true };
    }

    const payment = await this.prisma.paymentOrder.findUnique({
      where: { invoiceNumber: payload.order.order_invoice_number },
    });

    if (!payment) {
      throw new NotFoundException('Payment order not found');
    }

    if (payload.notification_type === 'TRANSACTION_VOID') {
      await this.processRefund(payment, payload);
      return { acknowledged: true };
    }

    this.validatePaidNotification(payment, payload);
    const paidAt = new Date();

    await this.prisma.$transaction(async (transaction) => {
      const duplicateTransaction = await transaction.paymentOrder.findUnique({
        where: {
          sepayTransactionId: payload.transaction.transaction_id,
        },
        select: { id: true },
      });

      if (duplicateTransaction && duplicateTransaction.id !== payment.id) {
        throw new ConflictException('SePay transaction already processed');
      }

      const updateResult = await transaction.paymentOrder.updateMany({
        where: {
          id: payment.id,
          status: { not: PaymentStatus.PAID },
        },
        data: {
          status: PaymentStatus.PAID,
          sepayOrderId: payload.order.id,
          sepayTransactionId: payload.transaction.transaction_id,
          paidAt,
          rawNotification: payload as unknown as Prisma.InputJsonValue,
        },
      });

      if (updateResult.count === 0) return;

      const expiresAt = await this.getActivationExpiresAt(
        transaction,
        payment,
        paidAt,
      );

      await transaction.subscription.upsert({
        where: { userId: payment.userId },
        update: {
          plan: payment.plan,
          paymentOrderId: payment.id,
          startsAt: paidAt,
          expiresAt,
          ...PLAN_QUOTAS[payment.plan],
          aiChatsUsed: 0,
        },
        create: {
          userId: payment.userId,
          plan: payment.plan,
          paymentOrderId: payment.id,
          startsAt: paidAt,
          expiresAt,
          ...PLAN_QUOTAS[payment.plan],
          aiChatsUsed: 0,
        },
      });
      await this.createAuditLog(transaction, payment.userId, 'payment.paid', {
        invoiceNumber: payment.invoiceNumber,
        transactionId: payload.transaction.transaction_id,
        plan: payment.plan,
      });
      await this.createAuditLog(
        transaction,
        payment.userId,
        'subscription.activated',
        {
          plan: payment.plan,
          invoiceNumber: payment.invoiceNumber,
          expiresAt: expiresAt.toISOString(),
        },
      );
    });

    return { acknowledged: true };
  }

  async processWebhook(
    authorization: string | undefined,
    payload: unknown,
  ): Promise<{ acknowledged: boolean }> {
    if (this.isBankWebhook(payload)) {
      return this.processBankWebhook(authorization, payload);
    }
    if (this.isPaymentGatewayIpn(payload)) {
      return this.processIpn(authorization, payload);
    }

    this.verifyIpnAuthorization(authorization);
    throw new BadRequestException('Unsupported SePay webhook payload');
  }

  private requireClient(): SePayPgClient {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'SePay payment gateway is not configured',
      );
    }
    return this.client;
  }

  private getPlanAmount(plan: SubscriptionPlan): number {
    if (plan === SubscriptionPlan.STUDENT) return this.studentPrice;
    if (plan === SubscriptionPlan.PRO) return this.proPrice;
    throw new BadRequestException('The Free plan does not require payment');
  }

  private getCheckoutAmount(
    requestedPlan: SubscriptionPlan,
    activeSubscription: {
      plan: SubscriptionPlan;
      expiresAt: Date | null;
    } | null,
    now: Date,
  ): number {
    if (
      !activeSubscription ||
      (activeSubscription.expiresAt && activeSubscription.expiresAt <= now)
    ) {
      return this.getPlanAmount(requestedPlan);
    }

    if (activeSubscription.plan === requestedPlan) {
      throw new ConflictException('This subscription plan is already active');
    }

    if (
      activeSubscription.plan === SubscriptionPlan.PRO &&
      requestedPlan === SubscriptionPlan.STUDENT
    ) {
      throw new ConflictException('Cannot downgrade an active paid plan');
    }

    if (
      activeSubscription.plan === SubscriptionPlan.STUDENT &&
      requestedPlan === SubscriptionPlan.PRO
    ) {
      return Math.max(0, this.proPrice - this.studentPrice);
    }

    return this.getPlanAmount(requestedPlan);
  }

  private async activateFreePlan(
    userId: string,
    action: string,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.subscription.upsert({
        where: { userId },
        update: {
          plan: SubscriptionPlan.FREE,
          paymentOrderId: null,
          startsAt: now,
          expiresAt: null,
          ...PLAN_QUOTAS.FREE,
          aiChatsUsed: 0,
        },
        create: {
          userId,
          plan: SubscriptionPlan.FREE,
          startsAt: now,
          expiresAt: null,
          ...PLAN_QUOTAS.FREE,
          aiChatsUsed: 0,
        },
      });
      await this.createAuditLog(transaction, userId, action, {
        plan: SubscriptionPlan.FREE,
      });
    });
  }

  private async getActivationExpiresAt(
    transaction: Prisma.TransactionClient,
    payment: {
      userId: string;
      plan: SubscriptionPlan;
    },
    paidAt: Date,
  ): Promise<Date> {
    if (payment.plan === SubscriptionPlan.PRO) {
      const activeSubscription = await transaction.subscription.findUnique({
        where: { userId: payment.userId },
        select: { plan: true, expiresAt: true },
      });

      if (
        activeSubscription?.plan === SubscriptionPlan.STUDENT &&
        activeSubscription.expiresAt &&
        activeSubscription.expiresAt > paidAt
      ) {
        return activeSubscription.expiresAt;
      }
    }

    const expiresAt = new Date(paidAt);
    expiresAt.setMonth(expiresAt.getMonth() + SUBSCRIPTION_MONTHS);
    return expiresAt;
  }

  private async createFreeSubscriptionResponse(
    userId: string,
    startsAt: Date,
  ): Promise<CurrentSubscriptionDto> {
    const usage = await this.getUserUsage(
      userId,
      startsAt,
      PLAN_QUOTAS.FREE.uploadLimit,
      PLAN_QUOTAS.FREE.storageLimitMb,
      PLAN_QUOTAS.FREE.aiChatLimit,
    );
    return {
      plan: SubscriptionPlan.FREE,
      startsAt: startsAt.toISOString(),
      expiresAt: null,
      ...PLAN_QUOTAS.FREE,
      ...usage,
    };
  }

  private async getUserUsage(
    userId: string,
    usagePeriodStart: Date,
    uploadLimit: number,
    storageLimitMb: number,
    aiChatLimit: number | null,
  ): Promise<Pick<
    CurrentSubscriptionDto,
    | 'aiChatsUsed'
    | 'aiChatsRemaining'
    | 'uploadsUsed'
    | 'uploadsRemaining'
    | 'storageUsedMb'
    | 'storageRemainingMb'
  >> {
    const [documents, aiChatsUsed] = await Promise.all([
      this.prisma.document.aggregate({
        where: {
          ownerId: userId,
          status: { not: DocumentStatus.DELETED },
        },
        _count: { _all: true },
        _sum: { fileSize: true },
      }),
      this.prisma.chatMessage.count({
        where: {
          sender: MessageSender.USER,
          createdAt: { gte: usagePeriodStart },
          chatSession: { userId },
        },
      }),
    ]);

    const uploadsUsed = documents._count._all;
    const storageUsedMb =
      Math.round(
        (Number(documents._sum.fileSize ?? BigInt(0)) / (1024 * 1024)) * 100,
      ) / 100;

    return {
      aiChatsUsed,
      aiChatsRemaining:
        aiChatLimit === null ? null : Math.max(0, aiChatLimit - aiChatsUsed),
      uploadsUsed,
      uploadsRemaining: Math.max(0, uploadLimit - uploadsUsed),
      storageUsedMb,
      storageRemainingMb: Math.max(
        0,
        Math.round((storageLimitMb - storageUsedMb) * 100) / 100,
      ),
    };
  }

  private async expirePendingPayments(
    userId: string,
    invoiceNumber?: string,
  ): Promise<void> {
    const expiredPayments = await this.prisma.paymentOrder.findMany({
      where: {
        userId,
        invoiceNumber,
        status: PaymentStatus.PENDING,
        expiresAt: { lte: new Date() },
      },
      select: { id: true, invoiceNumber: true },
    });
    if (expiredPayments.length === 0) return;

    await this.prisma.$transaction(async (transaction) => {
      for (const payment of expiredPayments) {
        const result = await transaction.paymentOrder.updateMany({
          where: { id: payment.id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.EXPIRED },
        });
        if (result.count === 0) continue;
        await this.createAuditLog(transaction, userId, 'payment.expired', {
          invoiceNumber: payment.invoiceNumber,
        });
      }
    });
  }

  private async processRefund(
    payment: {
      id: string;
      userId: string;
      invoiceNumber: string;
      status: PaymentStatus;
    },
    payload: SepayIpnDto,
  ): Promise<void> {
    if (payment.status !== PaymentStatus.PAID) return;

    await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.paymentOrder.updateMany({
        where: { id: payment.id, status: PaymentStatus.PAID },
        data: {
          status: PaymentStatus.REFUNDED,
          rawNotification: payload as unknown as Prisma.InputJsonValue,
        },
      });
      if (result.count === 0) return;

      const activeSubscription = await transaction.subscription.findUnique({
        where: { userId: payment.userId },
        select: { paymentOrderId: true },
      });
      if (activeSubscription?.paymentOrderId === payment.id) {
        await transaction.subscription.update({
          where: { userId: payment.userId },
          data: {
            plan: SubscriptionPlan.FREE,
            paymentOrderId: null,
            startsAt: new Date(),
            expiresAt: null,
            ...PLAN_QUOTAS.FREE,
            aiChatsUsed: 0,
          },
        });
      }

      await this.createAuditLog(
        transaction,
        payment.userId,
        'payment.refunded',
        {
          invoiceNumber: payment.invoiceNumber,
          transactionId: payload.transaction.transaction_id,
        },
      );
      await this.createAuditLog(
        transaction,
        payment.userId,
        'subscription.refund_applied',
        { plan: SubscriptionPlan.FREE },
      );
    });
  }

  private createAuditLog(
    transaction: Prisma.TransactionClient,
    userId: string,
    action: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<unknown> {
    return transaction.auditLog.create({
      data: {
        userId,
        action,
        targetType: 'Subscription',
        targetId: userId,
        metadata,
      },
    });
  }

  private createInvoiceNumber(): string {
    return `DM${Date.now()}${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private verifyIpnAuthorization(authorization: string | undefined): void {
    const match = authorization?.match(/^Apikey\s+(.+)$/i);
    const receivedApiKey = match?.[1]?.trim();

    if (!this.isEnabled || !receivedApiKey || !this.webhookApiKey) {
      throw new UnauthorizedException('Invalid SePay webhook API key');
    }

    const expected = Buffer.from(this.webhookApiKey);
    const received = Buffer.from(receivedApiKey);
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new UnauthorizedException('Invalid SePay webhook API key');
    }
  }

  private async processBankWebhook(
    authorization: string | undefined,
    payload: SepayBankWebhook,
  ): Promise<{ acknowledged: boolean }> {
    this.verifyIpnAuthorization(authorization);

    if (payload.transferType.toLowerCase() !== 'in') {
      return { acknowledged: true };
    }

    const invoiceNumber = this.extractInvoiceNumber(payload);
    if (!invoiceNumber) {
      return { acknowledged: true };
    }

    const payment = await this.prisma.paymentOrder.findUnique({
      where: { invoiceNumber },
      select: {
        invoiceNumber: true,
        paymentMethod: true,
      },
    });
    if (!payment) {
      return { acknowledged: true };
    }
    if (payment.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
      throw new BadRequestException(
        'Bank webhook does not match the payment method',
      );
    }

    return this.processIpn(authorization, {
      timestamp: Math.floor(Date.now() / 1000),
      notification_type: 'ORDER_PAID',
      order: {
        id: String(payload.id),
        order_id: payload.referenceCode || String(payload.id),
        order_status: 'CAPTURED',
        order_currency: CURRENCY,
        order_amount: String(payload.transferAmount),
        order_invoice_number: payment.invoiceNumber,
        custom_data: null,
        order_description: payload.description,
      },
      transaction: {
        id: String(payload.id),
        payment_method: PaymentMethod.BANK_TRANSFER,
        transaction_id: `BANK-${payload.id}`,
        transaction_type: 'PAYMENT',
        transaction_date: payload.transactionDate,
        transaction_status: 'APPROVED',
        transaction_amount: String(payload.transferAmount),
        transaction_currency: CURRENCY,
      },
      customer: null,
      agreement: null,
    });
  }

  private async reconcilePendingPayment(payment: {
    id: string;
    userId: string;
    invoiceNumber: string;
    plan: SubscriptionPlan;
    amount: number;
    currency: string;
    status: PaymentStatus;
  }): Promise<void> {
    if (payment.status !== PaymentStatus.PENDING || !this.client) return;

    let response: Awaited<ReturnType<SePayPgClient['order']['retrieve']>>;
    try {
      response = await this.client.order.retrieve(payment.invoiceNumber);
    } catch {
      return;
    }

    const order = this.extractSepayOrderDetail(response.data);
    if (!order || order.order_status !== 'CAPTURED') return;

    this.validateCapturedOrder(payment, order);

    const paidAt = new Date();

    await this.prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.paymentOrder.updateMany({
        where: {
          id: payment.id,
          status: { not: PaymentStatus.PAID },
        },
        data: {
          status: PaymentStatus.PAID,
          sepayOrderId: order.id,
          paidAt,
          rawNotification: response.data as Prisma.InputJsonValue,
        },
      });

      if (updateResult.count === 0) return;

      const expiresAt = await this.getActivationExpiresAt(
        transaction,
        payment,
        paidAt,
      );

      await transaction.subscription.upsert({
        where: { userId: payment.userId },
        update: {
          plan: payment.plan,
          paymentOrderId: payment.id,
          startsAt: paidAt,
          expiresAt,
          ...PLAN_QUOTAS[payment.plan],
          aiChatsUsed: 0,
        },
        create: {
          userId: payment.userId,
          plan: payment.plan,
          paymentOrderId: payment.id,
          startsAt: paidAt,
          expiresAt,
          ...PLAN_QUOTAS[payment.plan],
          aiChatsUsed: 0,
        },
      });
      await this.createAuditLog(transaction, payment.userId, 'payment.paid', {
        invoiceNumber: payment.invoiceNumber,
        orderId: order.id,
        plan: payment.plan,
        source: 'gateway-reconcile',
      });
      await this.createAuditLog(
        transaction,
        payment.userId,
        'subscription.activated',
        {
          plan: payment.plan,
          invoiceNumber: payment.invoiceNumber,
          expiresAt: expiresAt.toISOString(),
          source: 'gateway-reconcile',
        },
      );
    });
  }

  private extractSepayOrderDetail(payload: unknown): SepayOrderDetail | null {
    if (!this.isRecord(payload)) return null;
    const detail = this.isRecord(payload.data) ? payload.data : payload;
    return this.isRecord(detail) ? detail : null;
  }

  private validateCapturedOrder(
    payment: {
      userId: string;
      invoiceNumber: string;
      amount: number;
      currency: string;
    },
    order: SepayOrderDetail,
  ): void {
    const orderAmount = Number(order.order_amount);
    if (
      order.order_invoice_number !== payment.invoiceNumber ||
      order.order_currency !== payment.currency ||
      !Number.isFinite(orderAmount) ||
      orderAmount !== payment.amount
    ) {
      throw new BadRequestException('SePay order detail does not match');
    }

    if (order.customer_id && order.customer_id !== payment.userId) {
      throw new BadRequestException('SePay customer does not match');
    }
  }

  private extractInvoiceNumber(payload: SepayBankWebhook): string | null {
    const code = payload.code?.trim();
    if (code?.toUpperCase().startsWith('DM')) {
      return code.toUpperCase();
    }

    return payload.content.match(/\bDM[0-9A-F]+\b/i)?.[0].toUpperCase() ?? null;
  }

  private isBankWebhook(payload: unknown): payload is SepayBankWebhook {
    if (!this.isRecord(payload)) return false;

    return (
      typeof payload.id === 'number' &&
      typeof payload.gateway === 'string' &&
      typeof payload.transactionDate === 'string' &&
      typeof payload.accountNumber === 'string' &&
      (typeof payload.subAccount === 'string' || payload.subAccount === null) &&
      typeof payload.transferType === 'string' &&
      typeof payload.transferAmount === 'number' &&
      typeof payload.accumulated === 'number' &&
      (typeof payload.code === 'string' || payload.code === null) &&
      typeof payload.content === 'string' &&
      typeof payload.referenceCode === 'string' &&
      typeof payload.description === 'string'
    );
  }

  private isPaymentGatewayIpn(payload: unknown): payload is SepayIpnDto {
    if (!this.isRecord(payload)) return false;

    return (
      typeof payload.timestamp === 'number' &&
      typeof payload.notification_type === 'string' &&
      this.isRecord(payload.order) &&
      this.isRecord(payload.transaction)
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private validatePaidNotification(
    payment: {
      amount: number;
      currency: string;
      paymentMethod: PaymentMethod;
    },
    payload: SepayIpnDto,
  ): void {
    const orderAmount = Number(payload.order.order_amount);
    const transactionAmount = Number(payload.transaction.transaction_amount);

    if (
      !Number.isFinite(orderAmount) ||
      !Number.isFinite(transactionAmount) ||
      orderAmount !== payment.amount ||
      transactionAmount !== payment.amount
    ) {
      throw new BadRequestException('Payment amount does not match');
    }

    if (
      payload.order.order_currency !== payment.currency ||
      payload.transaction.transaction_currency !== payment.currency
    ) {
      throw new BadRequestException('Payment currency does not match');
    }

    if (payload.transaction.payment_method !== payment.paymentMethod) {
      throw new BadRequestException('Payment method does not match');
    }

    if (
      payload.order.order_status !== 'CAPTURED' ||
      payload.transaction.transaction_status !== 'APPROVED'
    ) {
      throw new ForbiddenException('Payment is not approved');
    }
  }

  private toPaymentResponse(payment: {
    invoiceNumber: string;
    plan: SubscriptionPlan;
    paymentMethod: PaymentMethod;
    amount: number;
    currency: string;
    status: PaymentStatus;
    paidAt: Date | null;
    expiresAt: Date;
    createdAt: Date;
  }): PaymentOrderDto {
    return {
      invoiceNumber: payment.invoiceNumber,
      plan: payment.plan,
      paymentMethod: payment.paymentMethod,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paidAt: payment.paidAt?.toISOString() ?? null,
      expiresAt: payment.expiresAt.toISOString(),
      createdAt: payment.createdAt.toISOString(),
    };
  }
}
