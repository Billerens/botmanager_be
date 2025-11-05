import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Lead, LeadStatus } from "../../database/entities/lead.entity";
import { Bot } from "../../database/entities/bot.entity";
import { CreateLeadDto, UpdateLeadDto } from "./dto/lead.dto";
import { NotificationService } from "../websocket/services/notification.service";
import { NotificationType } from "../websocket/interfaces/notification.interface";

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private leadRepository: Repository<Lead>,
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    private notificationService: NotificationService
  ) {}

  async create(createLeadDto: CreateLeadDto): Promise<Lead> {
    const lead = this.leadRepository.create(createLeadDto);
    const savedLead = await this.leadRepository.save(lead);

    // Получаем информацию о боте для отправки уведомления владельцу
    if (savedLead.botId) {
      const bot = await this.botRepository.findOne({
        where: { id: savedLead.botId },
      });

      if (bot && bot.ownerId) {
        // Отправляем уведомление о создании лида
        this.notificationService
          .sendToUser(bot.ownerId, NotificationType.LEAD_CREATED, {
            botId: bot.id,
            botName: bot.name,
            lead: {
              id: savedLead.id,
              name: savedLead.fullName,
              phone: savedLead.phone,
              email: savedLead.email,
              status: savedLead.status,
            },
          })
          .catch((error) => {
            console.error(
              "Ошибка отправки уведомления о создании лида:",
              error
            );
          });
      }
    }

    return savedLead;
  }

  async findAll(
    botId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<Lead[]> {
    return this.leadRepository.find({
      where: { botId },
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findOne(id: string): Promise<Lead> {
    return this.leadRepository.findOne({ where: { id } });
  }

  async update(id: string, updateLeadDto: UpdateLeadDto): Promise<Lead> {
    const lead = await this.findOne(id);
    const oldStatus = lead.status;
    Object.assign(lead, updateLeadDto);
    const updatedLead = await this.leadRepository.save(lead);

    // Проверяем, изменился ли статус
    const statusChanged = oldStatus !== updatedLead.status;

    // Получаем информацию о боте для отправки уведомления владельцу
    if (updatedLead.botId) {
      const bot = await this.botRepository.findOne({
        where: { id: updatedLead.botId },
      });

      if (bot && bot.ownerId) {
        // Отправляем уведомление об обновлении лида
        this.notificationService
          .sendToUser(bot.ownerId, NotificationType.LEAD_UPDATED, {
            botId: bot.id,
            botName: bot.name,
            lead: {
              id: updatedLead.id,
              name: updatedLead.fullName,
              phone: updatedLead.phone,
              email: updatedLead.email,
              status: updatedLead.status,
            },
            changes: updateLeadDto,
          })
          .catch((error) => {
            console.error(
              "Ошибка отправки уведомления об обновлении лида:",
              error
            );
          });

        // Если статус изменился, отправляем отдельное уведомление
        if (statusChanged) {
          this.notificationService
            .sendToUser(bot.ownerId, NotificationType.LEAD_STATUS_CHANGED, {
              botId: bot.id,
              botName: bot.name,
              lead: {
                id: updatedLead.id,
                name: updatedLead.fullName,
              },
              oldStatus,
              newStatus: updatedLead.status,
            })
            .catch((error) => {
              console.error(
                "Ошибка отправки уведомления об изменении статуса лида:",
                error
              );
            });
        }
      }
    }

    return updatedLead;
  }

  async delete(id: string): Promise<void> {
    const lead = await this.findOne(id);
    await this.leadRepository.remove(lead);
  }

  async getStats(botId: string): Promise<{
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    closed: number;
  }> {
    const [total, newCount, contacted, qualified, closed] = await Promise.all([
      this.leadRepository.count({ where: { botId } }),
      this.leadRepository.count({ where: { botId, status: LeadStatus.NEW } }),
      this.leadRepository.count({
        where: { botId, status: LeadStatus.CONTACTED },
      }),
      this.leadRepository.count({
        where: { botId, status: LeadStatus.QUALIFIED },
      }),
      this.leadRepository.count({ where: { botId, isClosed: true } }),
    ]);

    return {
      total,
      new: newCount,
      contacted,
      qualified,
      closed,
    };
  }
}
