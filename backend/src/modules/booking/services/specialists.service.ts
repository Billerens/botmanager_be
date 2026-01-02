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
import { BookingSystem } from "../../../database/entities/booking-system.entity";
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
import { ActivityLogService } from "../../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../../database/entities/activity-log.entity";

@Injectable()
export class SpecialistsService {
  constructor(
    @InjectRepository(Specialist)
    private specialistRepository: Repository<Specialist>,
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    @InjectRepository(BookingSystem)
    private bookingSystemRepository: Repository<BookingSystem>,
    private activityLogService: ActivityLogService
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

    const savedSpecialist = await this.specialistRepository.save(specialist);

    // Логируем создание специалиста
    if (bot.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.SPECIALIST_CREATED,
          level: ActivityLevel.SUCCESS,
          message: `Создан специалист "${savedSpecialist.name}"`,
          userId: bot.ownerId,
          botId,
          metadata: {
            specialistId: savedSpecialist.id,
            specialistName: savedSpecialist.name,
          },
        })
        .catch((error) => {
          console.error("Ошибка логирования создания специалиста:", error);
        });
    }

    return savedSpecialist;
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
    const bot = await this.botRepository.findOne({ where: { id: botId } });

    Object.assign(specialist, updateSpecialistDto);

    const updatedSpecialist = await this.specialistRepository.save(specialist);

    // Логируем обновление специалиста
    if (bot && bot.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.SPECIALIST_UPDATED,
          level: ActivityLevel.SUCCESS,
          message: `Обновлен специалист "${updatedSpecialist.name}"`,
          userId: bot.ownerId,
          botId,
          metadata: {
            specialistId: updatedSpecialist.id,
            specialistName: updatedSpecialist.name,
          },
        })
        .catch((error) => {
          console.error("Ошибка логирования обновления специалиста:", error);
        });
    }

    return updatedSpecialist;
  }

  async remove(id: string, botId: string): Promise<void> {
    const specialist = await this.findOne(id, botId);
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    const specialistName = specialist.name;

    await this.specialistRepository.remove(specialist);

    // Логируем удаление специалиста
    if (bot && bot.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.SPECIALIST_DELETED,
          level: ActivityLevel.SUCCESS,
          message: `Удален специалист "${specialistName}"`,
          userId: bot.ownerId,
          botId,
          metadata: {
            specialistId: id,
            specialistName,
          },
        })
        .catch((error) => {
          console.error("Ошибка логирования удаления специалиста:", error);
        });
    }
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
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    specialist.workingHours = workingHours;
    const updatedSpecialist = await this.specialistRepository.save(specialist);

    // Логируем обновление расписания специалиста
    if (bot && bot.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.SPECIALIST_SCHEDULE_UPDATED,
          level: ActivityLevel.SUCCESS,
          message: `Обновлено расписание специалиста "${updatedSpecialist.name}"`,
          userId: bot.ownerId,
          botId,
          metadata: {
            specialistId: updatedSpecialist.id,
            specialistName: updatedSpecialist.name,
          },
        })
        .catch((error) => {
          console.error(
            "Ошибка логирования обновления расписания специалиста:",
            error
          );
        });
    }

    return updatedSpecialist;
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

  // ============================================================================
  // МЕТОДЫ ДЛЯ РАБОТЫ ЧЕРЕЗ bookingSystemId (новая архитектура)
  // ============================================================================

  /**
   * Проверка владения системой бронирования
   */
  async validateBookingSystemOwnership(
    bookingSystemId: string,
    userId: string
  ): Promise<BookingSystem> {
    const bookingSystem = await this.bookingSystemRepository.findOne({
      where: { id: bookingSystemId },
    });

    if (!bookingSystem) {
      throw new NotFoundException("Система бронирования не найдена");
    }

    if (bookingSystem.ownerId !== userId) {
      throw new ForbiddenException("Нет доступа к этой системе бронирования");
    }

    return bookingSystem;
  }

  /**
   * Создать специалиста для системы бронирования
   */
  async createByBookingSystem(
    createSpecialistDto: CreateSpecialistDto,
    bookingSystemId: string,
    userId: string
  ): Promise<Specialist> {
    const bookingSystem = await this.validateBookingSystemOwnership(
      bookingSystemId,
      userId
    );

    const specialist = this.specialistRepository.create({
      ...createSpecialistDto,
      bookingSystemId,
      // Для обратной совместимости устанавливаем botId если система привязана к боту
      botId: bookingSystem.botId || undefined,
    });

    const savedSpecialist = await this.specialistRepository.save(specialist);

    // Логируем создание специалиста
    this.activityLogService
      .create({
        type: ActivityType.SPECIALIST_CREATED,
        level: ActivityLevel.SUCCESS,
        message: `Создан специалист "${savedSpecialist.name}"`,
        userId,
        botId: bookingSystem.botId,
        metadata: {
          specialistId: savedSpecialist.id,
          specialistName: savedSpecialist.name,
          bookingSystemId,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования создания специалиста:", error);
      });

    return savedSpecialist;
  }

  /**
   * Получить всех специалистов системы бронирования
   */
  async findAllByBookingSystem(
    bookingSystemId: string,
    userId: string
  ): Promise<Specialist[]> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);

    return this.specialistRepository.find({
      where: { bookingSystemId },
      relations: ["services"],
      order: { name: "ASC" },
    });
  }

  /**
   * Получить специалиста по ID в контексте системы бронирования
   */
  async findOneByBookingSystem(
    id: string,
    bookingSystemId: string,
    userId: string,
    includeRelations: boolean = true
  ): Promise<Specialist> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);

    const relations = includeRelations
      ? ["services", "timeSlots", "bookings"]
      : [];

    const specialist = await this.specialistRepository.findOne({
      where: { id, bookingSystemId },
      relations,
    });

    if (!specialist) {
      throw new NotFoundException("Специалист не найден");
    }

    return specialist;
  }

  /**
   * Обновить специалиста в контексте системы бронирования
   */
  async updateByBookingSystem(
    id: string,
    updateSpecialistDto: UpdateSpecialistDto,
    bookingSystemId: string,
    userId: string
  ): Promise<Specialist> {
    const bookingSystem = await this.validateBookingSystemOwnership(
      bookingSystemId,
      userId
    );
    const specialist = await this.findOneByBookingSystem(
      id,
      bookingSystemId,
      userId
    );

    Object.assign(specialist, updateSpecialistDto);
    const updatedSpecialist = await this.specialistRepository.save(specialist);

    // Логируем обновление специалиста
    this.activityLogService
      .create({
        type: ActivityType.SPECIALIST_UPDATED,
        level: ActivityLevel.SUCCESS,
        message: `Обновлен специалист "${updatedSpecialist.name}"`,
        userId,
        botId: bookingSystem.botId,
        metadata: {
          specialistId: updatedSpecialist.id,
          specialistName: updatedSpecialist.name,
          bookingSystemId,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования обновления специалиста:", error);
      });

    return updatedSpecialist;
  }

  /**
   * Удалить специалиста в контексте системы бронирования
   */
  async removeByBookingSystem(
    id: string,
    bookingSystemId: string,
    userId: string
  ): Promise<void> {
    const bookingSystem = await this.validateBookingSystemOwnership(
      bookingSystemId,
      userId
    );
    const specialist = await this.findOneByBookingSystem(
      id,
      bookingSystemId,
      userId
    );
    const specialistName = specialist.name;

    await this.specialistRepository.remove(specialist);

    // Логируем удаление специалиста
    this.activityLogService
      .create({
        type: ActivityType.SPECIALIST_DELETED,
        level: ActivityLevel.SUCCESS,
        message: `Удален специалист "${specialistName}"`,
        userId,
        botId: bookingSystem.botId,
        metadata: {
          specialistId: id,
          specialistName,
          bookingSystemId,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования удаления специалиста:", error);
      });
  }

  /**
   * Обновить расписание специалиста в контексте системы бронирования
   */
  async updateWorkingHoursByBookingSystem(
    id: string,
    workingHours: any,
    bookingSystemId: string,
    userId: string
  ): Promise<Specialist> {
    const bookingSystem = await this.validateBookingSystemOwnership(
      bookingSystemId,
      userId
    );
    const specialist = await this.findOneByBookingSystem(
      id,
      bookingSystemId,
      userId,
      false
    );

    specialist.workingHours = workingHours;
    const updatedSpecialist = await this.specialistRepository.save(specialist);

    // Логируем обновление расписания специалиста
    this.activityLogService
      .create({
        type: ActivityType.SPECIALIST_SCHEDULE_UPDATED,
        level: ActivityLevel.SUCCESS,
        message: `Обновлено расписание специалиста "${updatedSpecialist.name}"`,
        userId,
        botId: bookingSystem.botId,
        metadata: {
          specialistId: updatedSpecialist.id,
          specialistName: updatedSpecialist.name,
          bookingSystemId,
        },
      })
      .catch((error) => {
        console.error(
          "Ошибка логирования обновления расписания специалиста:",
          error
        );
      });

    return updatedSpecialist;
  }

  /**
   * Получить расписание специалиста в контексте системы бронирования
   */
  async getWorkingHoursByBookingSystem(
    id: string,
    bookingSystemId: string,
    userId: string
  ): Promise<any> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);
    const specialist = await this.findOneByBookingSystem(
      id,
      bookingSystemId,
      userId,
      false
    );
    return specialist.workingHours;
  }
}
