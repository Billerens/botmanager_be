import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionPlan, SubscriptionStatus } from '../../database/entities/subscription.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
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

    return this.subscriptionRepository.save(subscription);
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
