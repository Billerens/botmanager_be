import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Lead, LeadStatus } from "../../database/entities/lead.entity";
import { CreateLeadDto, UpdateLeadDto } from "./dto/lead.dto";

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private leadRepository: Repository<Lead>
  ) {}

  async create(createLeadDto: CreateLeadDto): Promise<Lead> {
    const lead = this.leadRepository.create(createLeadDto);
    return this.leadRepository.save(lead);
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
    Object.assign(lead, updateLeadDto);
    return this.leadRepository.save(lead);
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
