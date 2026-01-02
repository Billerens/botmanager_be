import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Specialist,
  WorkingHours,
} from "../../../database/entities/specialist.entity";
import { BookingSystem } from "../../../database/entities/booking-system.entity";
import {
  CreateSpecialistDto,
  UpdateSpecialistDto,
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
    @InjectRepository(BookingSystem)
    private bookingSystemRepository: Repository<BookingSystem>,
    private activityLogService: ActivityLogService
  ) {}

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
