import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionStatus } from '../generated/prisma/client';

const cron = Cron as unknown as (cronTime: string) => MethodDecorator;
const EVERY_DAY_AT_MIDNIGHT = '0 0 * * *';

@Injectable()
export class SubscriptionCron {
  private readonly logger = new Logger(SubscriptionCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @cron(EVERY_DAY_AT_MIDNIGHT)
  async checkExpiredSubscriptions(): Promise<void> {
    this.logger.log('Starting cron job: checking expired subscriptions...');

    try {
      const now = new Date();

      const updateResult = await this.prisma.userSubscription.updateMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          expiresAt: {
            lt: now,
          },
        },
        data: {
          status: SubscriptionStatus.EXPIRED,
        },
      });

      if (updateResult.count > 0) {
        this.logger.log(
          `Successfully marked ${updateResult.count} subscriptions as EXPIRED.`,
        );
      } else {
        this.logger.log('No expired subscriptions found to update.');
      }
    } catch (error) {
      this.logger.error(
        'Failed to run checkExpiredSubscriptions cron job',
        error,
      );
    }
  }
}
