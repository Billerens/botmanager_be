import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, LessThan, MoreThan } from "typeorm";
import {
  Specialist,
  WorkingHours,
} from "../../../database/entities/specialist.entity";
import { Service } from "../../../database/entities/service.entity";
import { TimeSlot } from "../../../database/entities/time-slot.entity";
import {
  Booking,
  BookingStatus,
} from "../../../database/entities/booking.entity";
import { Bot } from "../../../database/entities/bot.entity";
import {
  CreateSpecialistDto,
  UpdateSpecialistDto,
  CreateServiceDto,
  UpdateServiceDto,
  CreateTimeSlotDto,
  UpdateTimeSlotDto,
  CreateBookingDto,
  UpdateBookingDto,
  GenerateTimeSlotsDto,
  GetAvailableSlotsDto,
} from "../dto/booking.dto";

@Injectable()
export class SpecialistsService {
  constructor(
    @InjectRepository(Specialist)
    private specialistRepository: Repository<Specialist>,
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>
  ) {}

  async create(
    createSpecialistDto: CreateSpecialistDto,
    botId: string
  ): Promise<Specialist> {
    // Проверяем, что бот существует и принадлежит пользователю
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    const specialist = this.specialistRepository.create({
      ...createSpecialistDto,
      botId,
    });

    return this.specialistRepository.save(specialist);
  }

  async findAll(botId: string): Promise<Specialist[]> {
    return this.specialistRepository.find({
      where: { botId },
      relations: ["services"],
      order: { name: "ASC" },
    });
  }

  async findOne(
    id: string,
    botId: string,
    includeRelations: boolean = true
  ): Promise<Specialist> {
    const relations = includeRelations
      ? ["services", "timeSlots", "bookings"]
      : [];

    const specialist = await this.specialistRepository.findOne({
      where: { id, botId },
      relations,
    });

    if (!specialist) {
      throw new NotFoundException("Специалист не найден");
    }

    return specialist;
  }

  async update(
    id: string,
    updateSpecialistDto: UpdateSpecialistDto,
    botId: string
  ): Promise<Specialist> {
    const specialist = await this.findOne(id, botId);

    Object.assign(specialist, updateSpecialistDto);

    return this.specialistRepository.save(specialist);
  }

  async remove(id: string, botId: string): Promise<void> {
    const specialist = await this.findOne(id, botId);
    await this.specialistRepository.remove(specialist);
  }

  async getWorkingHours(id: string, botId: string): Promise<any> {
    const specialist = await this.findOne(id, botId);
    return specialist.workingHours;
  }

  async updateWorkingHours(
    id: string,
    workingHours: any,
    botId: string
  ): Promise<Specialist> {
    const specialist = await this.findOne(id, botId);
    specialist.workingHours = workingHours;
    return this.specialistRepository.save(specialist);
  }

  // Проверка доступности специалиста в определенное время
  async isAvailableAt(specialistId: string, date: Date): Promise<boolean> {
    const specialist = await this.specialistRepository.findOne({
      where: { id: specialistId },
    });

    if (!specialist || !specialist.isActive) {
      return false;
    }

    return specialist.isWorkingAt(date) && !specialist.isOnBreak(date);
  }

  // Получение расписания специалиста на день
  async getScheduleForDay(specialistId: string, date: Date): Promise<any> {
    const specialist = await this.specialistRepository.findOne({
      where: { id: specialistId },
    });

    if (!specialist) {
      throw new NotFoundException("Специалист не найден");
    }

    const dayOfWeek = this.getDayOfWeek(date) as keyof WorkingHours;
    const daySchedule = specialist.getWorkingHoursForDay(dayOfWeek);

    return {
      specialist: specialist.name,
      date: date.toISOString().substring(0, 10),
      dayOfWeek,
      schedule: daySchedule,
      isWorking: daySchedule?.isWorking || false,
    };
  }

  private getDayOfWeek(date: Date): string {
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    return days[date.getUTCDay()];
  }
}
