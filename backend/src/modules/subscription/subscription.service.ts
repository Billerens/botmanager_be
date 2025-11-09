import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionPlan, SubscriptionStatus } from '../../database/entities/subscription.entity';
import { ActivityLogService } from '../activity-log/activity-log.service';
import {
  ActivityType,
  ActivityLevel,
} from '../../database/entities/activity-log.entity';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    private activityLogService: ActivityLogService,
  ) {}

  async create(userId: string, plan: SubscriptionPlan): Promise<Subscription> {
    const subscription = this.subscriptionRepository.create({
      userId,
      plan,
      status: SubscriptionStatus.ACTIVE,
      amount: this.getPlanPrice(plan),
      currency: 'USD',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 дней
    });

    const savedSubscription = await this.subscriptionRepository.save(subscription);

    // Логируем создание подписки
    this.activityLogService
      .create({
        type: ActivityType.SUBSCRIPTION_CREATED,
        level: ActivityLevel.SUCCESS,
        message: `Создана подписка ${plan} на сумму ${savedSubscription.amount} ${savedSubscription.currency}`,
        userId,
        metadata: {
          subscriptionId: savedSubscription.id,
          plan,
          amount: savedSubscription.amount,
          currency: savedSubscription.currency,
          status: savedSubscription.status,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования создания подписки:", error);
      });

    return savedSubscription;
  }

  async update(subscriptionId: string, updates: Partial<Subscription>, userId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) {
      throw new Error('Подписка не найдена');
    }

    const oldStatus = subscription.status;
    const oldPlan = subscription.plan;

    Object.assign(subscription, updates);
    const updatedSubscription = await this.subscriptionRepository.save(subscription);

    // Логируем обновление подписки
    this.activityLogService
      .create({
        type: ActivityType.SUBSCRIPTION_UPDATED,
        level: ActivityLevel.INFO,
        message: `Обновлена подписка ${updatedSubscription.plan}`,
        userId,
        metadata: {
          subscriptionId: updatedSubscription.id,
          oldStatus,
          newStatus: updatedSubscription.status,
          oldPlan,
          newPlan: updatedSubscription.plan,
          changes: updates,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования обновления подписки:", error);
      });

    return updatedSubscription;
  }

  async cancel(subscriptionId: string, userId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) {
      throw new Error('Подписка не найдена');
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    const cancelledSubscription = await this.subscriptionRepository.save(subscription);

    // Логируем отмену подписки
    this.activityLogService
      .create({
        type: ActivityType.SUBSCRIPTION_CANCELLED,
        level: ActivityLevel.WARNING,
        message: `Отменена подписка ${cancelledSubscription.plan}`,
        userId,
        metadata: {
          subscriptionId: cancelledSubscription.id,
          plan: cancelledSubscription.plan,
          amount: cancelledSubscription.amount,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования отмены подписки:", error);
      });

    return cancelledSubscription;
  }

  async findByUserId(userId: string): Promise<Subscription | null> {
    return this.subscriptionRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  private getPlanPrice(plan: SubscriptionPlan): number {
    switch (plan) {
      case SubscriptionPlan.START:
        return 15;
      case SubscriptionPlan.BUSINESS:
        return 35;
      case SubscriptionPlan.PRO:
        return 75;
      default:
        return 0;
    }
  }
}
