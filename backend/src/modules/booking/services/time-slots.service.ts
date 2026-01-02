import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, LessThan, MoreThan, In } from "typeorm";
import { TimeSlot } from "../../../database/entities/time-slot.entity";
import {
  Specialist,
  WorkingHours,
} from "../../../database/entities/specialist.entity";
import { Service } from "../../../database/entities/service.entity";
import {
  Booking,
  BookingStatus,
} from "../../../database/entities/booking.entity";
import { BookingSystem } from "../../../database/entities/booking-system.entity";
import {
  CreateTimeSlotDto,
  UpdateTimeSlotDto,
  GenerateTimeSlotsDto,
  GetAvailableSlotsDto,
} from "../dto/booking.dto";
import { ActivityLogService } from "../../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../../database/entities/activity-log.entity";

@Injectable()
export class TimeSlotsService {
  constructor(
    @InjectRepository(TimeSlot)
    private timeSlotRepository: Repository<TimeSlot>,
    @InjectRepository(Specialist)
    private specialistRepository: Repository<Specialist>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(BookingSystem)
    private bookingSystemRepository: Repository<BookingSystem>,
    private activityLogService: ActivityLogService
  ) {}

  /**
   * Объединяет виртуальные и физические слоты, приоритет у физических
   */
  private mergePhysicalAndVirtualSlots(
    virtualSlots: TimeSlot[],
    physicalSlots: TimeSlot[]
  ): TimeSlot[] {
    // Создаем Map для быстрого поиска физических слотов по времени
    const physicalSlotsMap = new Map<string, TimeSlot>();
    physicalSlots.forEach((slot) => {
      const key = `${slot.startTime.toISOString()}_${slot.endTime.toISOString()}`;
      physicalSlotsMap.set(key, slot);
    });

    const resultSlots: TimeSlot[] = [];

    // Проходим по виртуальным слотам
    for (const virtualSlot of virtualSlots) {
      const key = `${virtualSlot.startTime.toISOString()}_${virtualSlot.endTime.toISOString()}`;
      const physicalSlot = physicalSlotsMap.get(key);

      if (physicalSlot) {
        // Если есть физический слот, используем его (он может быть недоступен - исключение)
        if (physicalSlot.isAvailable && !physicalSlot.isBooked) {
          resultSlots.push(physicalSlot);
        }
        physicalSlotsMap.delete(key);
      } else {
        // Иначе используем виртуальный слот
        resultSlots.push(virtualSlot);
      }
    }

    // Добавляем оставшиеся физические слоты (которые не совпали с виртуальными)
    physicalSlotsMap.forEach((slot) => {
      if (slot.isAvailable && !slot.isBooked) {
        resultSlots.push(slot);
      }
    });

    return resultSlots.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );
  }

  /**
   * Объединяет последовательные слоты в слоты нужной длительности
   */
  private mergeConsecutiveSlots(
    slots: TimeSlot[],
    requiredDuration: number
  ): TimeSlot[] {
    if (slots.length === 0) {
      return [];
    }

    const mergedSlots: TimeSlot[] = [];
    const requiredDurationMs = requiredDuration * 60 * 1000; // в миллисекундах

    // Проходим по всем слотам и пытаемся найти последовательности нужной длины
    for (let i = 0; i < slots.length; i++) {
      const startSlot = slots[i];
      let currentEndTime = new Date(startSlot.endTime);
      let currentDuration =
        startSlot.endTime.getTime() - startSlot.startTime.getTime();

      // Если текущий слот уже подходит по длительности
      if (currentDuration >= requiredDurationMs) {
        mergedSlots.push(startSlot);
        continue;
      }

      // Пытаемся найти последовательные слоты
      let consecutiveSlots = [startSlot];
      for (let j = i + 1; j < slots.length; j++) {
        const nextSlot = slots[j];

        // Проверяем, что следующий слот идет сразу после текущего (или с допустимым gap)
        const timeDiff =
          nextSlot.startTime.getTime() - currentEndTime.getTime();
        const maxGapMs = 1 * 60 * 1000; // максимальный разрыв 1 минута

        if (timeDiff > maxGapMs) {
          // Слоты не последовательные, прерываем
          break;
        }

        consecutiveSlots.push(nextSlot);
        currentEndTime = new Date(nextSlot.endTime);
        currentDuration =
          currentEndTime.getTime() - startSlot.startTime.getTime();

        // Если набрали нужную длительность
        if (currentDuration >= requiredDurationMs) {
          // Создаем виртуальный объединенный слот
          const mergedSlot = new TimeSlot();
          mergedSlot.id = `merged_${startSlot.id}_${nextSlot.id}`;
          mergedSlot.specialistId = startSlot.specialistId;
          mergedSlot.specialist = startSlot.specialist;
          mergedSlot.startTime = new Date(startSlot.startTime);
          mergedSlot.endTime = new Date(currentEndTime);
          mergedSlot.isAvailable = true;
          mergedSlot.isBooked = false;
          // Сохраняем информацию о составных слотах в metadata
          mergedSlot.metadata = {
            mergedSlotIds: consecutiveSlots.map((s) => s.id),
            isMerged: true,
          };

          mergedSlots.push(mergedSlot);
          break;
        }
      }
    }

    return mergedSlots;
  }

  // Генерирует виртуальные слоты (не сохраняя в БД) для предпросмотра
  private async generateVirtualSlotsForDay(
    specialist: Specialist,
    date: Date,
    duration: number,
    buffer: number
  ): Promise<TimeSlot[]> {
    const dayOfWeek = this.getDayOfWeek(date);
    const daySchedule = specialist.getWorkingHoursForDay(dayOfWeek);

    if (!daySchedule || !daySchedule.isWorking) {
      return [];
    }

    const slots: TimeSlot[] = [];
    const startTime = this.parseTime(daySchedule.startTime, date);
    const endTime = this.parseTime(daySchedule.endTime, date);

    let currentTime = new Date(startTime);

    while (currentTime < endTime) {
      const slotEndTime = new Date(
        currentTime.getTime() + duration * 60 * 1000
      );

      if (slotEndTime > endTime) {
        break;
      }

      // Проверяем, что слот не попадает на перерыв
      const breaks = daySchedule.breaks || specialist.breakTimes || [];

      const isOnBreak = breaks.some((breakTime) => {
        const breakStart = this.parseTime(breakTime.startTime, date);
        const breakEnd = this.parseTime(breakTime.endTime, date);
        return currentTime < breakEnd && slotEndTime > breakStart;
      });

      if (!isOnBreak) {
        // Создаем виртуальный слот без проверки конфликтов
        const virtualSlot = new TimeSlot();
        // Генерируем временный ID на основе времени для виртуальных слотов
        virtualSlot.id = `virtual_${currentTime.getTime()}_${slotEndTime.getTime()}`;
        virtualSlot.specialistId = specialist.id;
        virtualSlot.startTime = new Date(currentTime);
        virtualSlot.endTime = new Date(slotEndTime);
        virtualSlot.isAvailable = true;
        virtualSlot.isBooked = false;
        slots.push(virtualSlot);
      }

      // Переходим к следующему слоту с учетом буферного времени
      currentTime = new Date(slotEndTime.getTime() + buffer * 60 * 1000);
    }

    return slots;
  }

  private async generateSlotsForDay(
    specialist: Specialist,
    date: Date,
    duration: number,
    buffer: number
  ): Promise<TimeSlot[]> {
    const dayOfWeek = this.getDayOfWeek(date);
    const daySchedule = specialist.getWorkingHoursForDay(dayOfWeek);

    if (!daySchedule || !daySchedule.isWorking) {
      return [];
    }

    const slots: TimeSlot[] = [];
    const startTime = this.parseTime(daySchedule.startTime, date);
    const endTime = this.parseTime(daySchedule.endTime, date);

    let currentTime = new Date(startTime);

    while (currentTime < endTime) {
      const slotEndTime = new Date(
        currentTime.getTime() + duration * 60 * 1000
      );

      if (slotEndTime > endTime) {
        break;
      }

      // Проверяем, что слот не попадает на перерыв
      // Сначала проверяем перерывы конкретного дня (они переопределяют глобальные)
      const breaks = daySchedule.breaks || specialist.breakTimes || [];

      const isOnBreak = breaks.some((breakTime) => {
        const breakStart = this.parseTime(breakTime.startTime, date);
        const breakEnd = this.parseTime(breakTime.endTime, date);
        return currentTime < breakEnd && slotEndTime > breakStart;
      });

      if (!isOnBreak) {
        // Проверяем, что слот не конфликтует с существующими
        const existingSlot = await this.timeSlotRepository.findOne({
          where: {
            specialistId: specialist.id,
            startTime: LessThan(slotEndTime),
            endTime: MoreThan(currentTime),
          },
        });

        if (!existingSlot) {
          slots.push(
            this.timeSlotRepository.create({
              specialistId: specialist.id,
              startTime: new Date(currentTime),
              endTime: new Date(slotEndTime),
              isAvailable: true,
              isBooked: false,
            })
          );
        }
      }

      // Переходим к следующему слоту с учетом буферного времени
      currentTime = new Date(slotEndTime.getTime() + buffer * 60 * 1000);
    }

    return slots;
  }

  private getDayOfWeek(date: Date): keyof WorkingHours {
    const days: (keyof WorkingHours)[] = [
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

  private parseTime(timeStr: string, date: Date): Date {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const result = new Date(date);
    result.setUTCHours(hours, minutes, 0, 0);
    return result;
  }

  async cleanupPastSlots(): Promise<number> {
    const now = new Date();

    const result = await this.timeSlotRepository
      .createQueryBuilder()
      .delete()
      .where("endTime < :now", { now })
      .andWhere("isBooked = :isBooked", { isBooked: false })
      .execute();

    return result.affected || 0;
  }

  /**
   * Создать таймслот для системы бронирования
   */
  async createByBookingSystem(
    bookingSystemId: string,
    userId: string,
    createTimeSlotDto: CreateTimeSlotDto
  ): Promise<TimeSlot> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);

    // Проверяем, что специалист принадлежит системе бронирования
    const specialist = await this.specialistRepository.findOne({
      where: { id: createTimeSlotDto.specialistId, bookingSystemId },
    });

    if (!specialist) {
      throw new NotFoundException("Специалист не найден");
    }

    const startTime = new Date(createTimeSlotDto.startTime);
    const endTime = new Date(createTimeSlotDto.endTime);

    // Проверяем, что время корректное
    if (startTime >= endTime) {
      throw new BadRequestException(
        "Время начала должно быть раньше времени окончания"
      );
    }

    // Для доступных слотов проверяем рабочее время и перерывы
    if (createTimeSlotDto.isAvailable !== false) {
      if (!specialist.isWorkingAt(startTime)) {
        throw new BadRequestException(
          "Специалист не работает в указанное время"
        );
      }

      if (specialist.isOnBreak(startTime)) {
        throw new BadRequestException(
          "В указанное время у специалиста перерыв"
        );
      }
    }

    // Проверяем конфликты с существующими слотами
    const conflictingSlots = await this.timeSlotRepository.find({
      where: {
        specialistId: createTimeSlotDto.specialistId,
        startTime: LessThan(endTime),
        endTime: MoreThan(startTime),
      },
    });

    if (conflictingSlots.length > 0) {
      throw new BadRequestException(
        "Время конфликтует с существующими слотами"
      );
    }

    const timeSlot = this.timeSlotRepository.create({
      ...createTimeSlotDto,
      startTime,
      endTime,
    });

    const savedTimeSlot = await this.timeSlotRepository.save(timeSlot);

    // Логируем создание таймслота
    this.activityLogService
      .create({
        type: ActivityType.TIME_SLOT_CREATED,
        level: ActivityLevel.SUCCESS,
        message: `Создан таймслот для специалиста`,
        userId,
        metadata: {
          timeSlotId: savedTimeSlot.id,
          specialistId: savedTimeSlot.specialistId,
          startTime: savedTimeSlot.startTime.toISOString(),
          endTime: savedTimeSlot.endTime.toISOString(),
          isAvailable: savedTimeSlot.isAvailable,
          bookingSystemId,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования создания таймслота:", error);
      });

    return savedTimeSlot;
  }

  /**
   * Получить все таймслоты системы бронирования
   */
  async findAllByBookingSystem(
    bookingSystemId: string,
    userId: string
  ): Promise<TimeSlot[]> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);

    return this.timeSlotRepository.find({
      where: {
        specialist: { bookingSystemId },
      },
      relations: ["specialist"],
      order: { startTime: "ASC" },
    });
  }

  /**
   * Получить таймслот по ID для системы бронирования
   */
  async findOneByBookingSystem(
    id: string,
    bookingSystemId: string,
    userId: string
  ): Promise<TimeSlot> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);

    const timeSlot = await this.timeSlotRepository.findOne({
      where: {
        id,
        specialist: { bookingSystemId },
      },
      relations: ["specialist", "booking"],
    });

    if (!timeSlot) {
      throw new NotFoundException("Таймслот не найден");
    }

    return timeSlot;
  }

  /**
   * Обновить таймслот для системы бронирования
   */
  async updateByBookingSystem(
    id: string,
    bookingSystemId: string,
    userId: string,
    updateTimeSlotDto: UpdateTimeSlotDto
  ): Promise<TimeSlot> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);
    const timeSlot = await this.findOneByBookingSystem(
      id,
      bookingSystemId,
      userId
    );

    // Если слот забронирован, ограничиваем изменения
    if (timeSlot.isBooked) {
      const allowedFields = ["isAvailable", "metadata"];
      const updateFields = Object.keys(updateTimeSlotDto);
      const hasRestrictedFields = updateFields.some(
        (field) => !allowedFields.includes(field)
      );

      if (hasRestrictedFields) {
        throw new BadRequestException("Нельзя изменять забронированный слот");
      }
    }

    Object.assign(timeSlot, updateTimeSlotDto);

    const updatedTimeSlot = await this.timeSlotRepository.save(timeSlot);

    // Логируем обновление таймслота
    this.activityLogService
      .create({
        type: ActivityType.TIME_SLOT_UPDATED,
        level: ActivityLevel.SUCCESS,
        message: `Обновлен таймслот`,
        userId,
        metadata: {
          timeSlotId: updatedTimeSlot.id,
          specialistId: updatedTimeSlot.specialistId,
          startTime: updatedTimeSlot.startTime.toISOString(),
          endTime: updatedTimeSlot.endTime.toISOString(),
          isAvailable: updatedTimeSlot.isAvailable,
          bookingSystemId,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования обновления таймслота:", error);
      });

    return updatedTimeSlot;
  }

  /**
   * Удалить таймслот для системы бронирования
   */
  async removeByBookingSystem(
    id: string,
    bookingSystemId: string,
    userId: string
  ): Promise<void> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);
    const timeSlot = await this.findOneByBookingSystem(
      id,
      bookingSystemId,
      userId
    );

    if (timeSlot.isBooked) {
      throw new BadRequestException("Нельзя удалить забронированный слот");
    }

    const timeSlotData = {
      specialistId: timeSlot.specialistId,
      startTime: timeSlot.startTime.toISOString(),
      endTime: timeSlot.endTime.toISOString(),
    };

    await this.timeSlotRepository.remove(timeSlot);

    // Логируем удаление таймслота
    this.activityLogService
      .create({
        type: ActivityType.TIME_SLOT_DELETED,
        level: ActivityLevel.SUCCESS,
        message: `Удален таймслот`,
        userId,
        metadata: {
          timeSlotId: id,
          ...timeSlotData,
          bookingSystemId,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования удаления таймслота:", error);
      });
  }

  /**
   * Получить доступные слоты для системы бронирования (публичный метод)
   */
  async findAvailableSlotsByBookingSystem(
    bookingSystemId: string,
    getAvailableSlotsDto: GetAvailableSlotsDto
  ): Promise<TimeSlot[]> {
    const { specialistId, serviceId, date } = getAvailableSlotsDto;

    // Проверяем, что специалист принадлежит системе бронирования
    const specialist = await this.specialistRepository.findOne({
      where: { id: specialistId, bookingSystemId },
    });

    if (!specialist) {
      throw new NotFoundException("Специалист не найден");
    }

    // Если указана услуга, проверяем её длительность
    let serviceDuration = specialist.defaultSlotDuration;
    if (serviceId) {
      const service = await this.serviceRepository
        .createQueryBuilder("service")
        .innerJoin("service.specialists", "specialist")
        .where("service.id = :serviceId", { serviceId })
        .andWhere("specialist.id = :specialistId", { specialistId })
        .getOne();
      if (service) {
        serviceDuration = service.duration;
      }
    }

    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    // Загружаем физические слоты за день
    const physicalSlots = await this.timeSlotRepository.find({
      where: {
        specialistId,
        startTime: Between(startDate, endDate),
      },
      relations: ["specialist"],
      order: { startTime: "ASC" },
    });

    // Генерируем виртуальные слоты
    const targetDate = new Date(date);
    const duration = specialist.defaultSlotDuration;
    const buffer = specialist.bufferTime;

    const virtualSlots = await this.generateVirtualSlotsForDay(
      specialist,
      targetDate,
      duration,
      buffer
    );

    // Объединяем виртуальные и физические слоты
    const availableSlots = this.mergePhysicalAndVirtualSlots(
      virtualSlots,
      physicalSlots
    );

    // Если услуга не указана или слотов нет, возвращаем как есть
    if (!serviceDuration || availableSlots.length === 0) {
      return availableSlots;
    }

    // Объединяем последовательные слоты для создания слотов нужной длительности
    return this.mergeConsecutiveSlots(availableSlots, serviceDuration);
  }

  /**
   * Генерировать таймслоты для системы бронирования
   */
  async generateTimeSlotsByBookingSystem(
    bookingSystemId: string,
    userId: string,
    generateTimeSlotsDto: GenerateTimeSlotsDto
  ): Promise<TimeSlot[]> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);

    const { specialistId, startDate, endDate, slotDuration, bufferTime } =
      generateTimeSlotsDto;

    // Проверяем, что специалист принадлежит системе бронирования
    const specialist = await this.specialistRepository.findOne({
      where: { id: specialistId, bookingSystemId },
    });

    if (!specialist) {
      throw new NotFoundException("Специалист не найден");
    }

    const duration = slotDuration || specialist.defaultSlotDuration;
    const buffer = bufferTime || specialist.bufferTime;
    const slots: TimeSlot[] = [];

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Генерируем слоты для каждого дня
    for (
      let date = new Date(start);
      date < end;
      date.setUTCDate(date.getUTCDate() + 1)
    ) {
      const daySlots = await this.generateSlotsForDay(
        specialist,
        date,
        duration,
        buffer
      );
      slots.push(...daySlots);
    }

    // Сохраняем все слоты
    const savedSlots = await this.timeSlotRepository.save(slots);

    // Логируем генерацию таймслотов
    this.activityLogService
      .create({
        type: ActivityType.TIME_SLOT_GENERATED,
        level: ActivityLevel.SUCCESS,
        message: `Сгенерировано ${savedSlots.length} таймслотов для специалиста`,
        userId,
        metadata: {
          specialistId,
          slotsCount: savedSlots.length,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          slotDuration: duration,
          bufferTime: buffer,
          bookingSystemId,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования генерации таймслотов:", error);
      });

    return savedSlots;
  }

  /**
   * Предпросмотр слотов для системы бронирования
   */
  async previewTimeSlotsByBookingSystem(
    bookingSystemId: string,
    userId: string,
    specialistId: string,
    date: string
  ): Promise<TimeSlot[]> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);

    // Проверяем, что специалист принадлежит системе бронирования
    const specialist = await this.specialistRepository.findOne({
      where: { id: specialistId, bookingSystemId },
    });

    if (!specialist) {
      throw new NotFoundException("Специалист не найден");
    }

    const targetDate = new Date(date);
    const duration = specialist.defaultSlotDuration;
    const buffer = specialist.bufferTime;

    // Генерируем виртуальные слоты для дня
    const virtualSlots = await this.generateVirtualSlotsForDay(
      specialist,
      targetDate,
      duration,
      buffer
    );

    // Загружаем реальные слоты из БД для этого дня
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const existingSlots = await this.timeSlotRepository.find({
      where: {
        specialistId: specialist.id,
        startTime: Between(startOfDay, endOfDay),
      },
      order: { startTime: "ASC" },
    });

    // Загружаем все активные бронирования на этот день
    const bookingsOnDay = await this.bookingRepository.find({
      where: {
        specialistId: specialist.id,
        status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
        timeSlot: {
          startTime: Between(startOfDay, endOfDay),
        },
      },
      relations: ["service", "timeSlot"],
    });

    // Создаем Map для поиска бронирований по timeSlotId
    const bookingsBySlotId = new Map<string, any>();
    bookingsOnDay.forEach((booking) => {
      bookingsBySlotId.set(booking.timeSlotId, booking);

      if (booking.clientData?.mergedSlotIds) {
        booking.clientData.mergedSlotIds.forEach((slotId: string) => {
          bookingsBySlotId.set(slotId, booking);
        });
      }
    });

    // Создаем Map для быстрого поиска существующих слотов по времени
    const existingSlotsMap = new Map<string, any>();
    existingSlots.forEach((slot) => {
      const key = `${slot.startTime.toISOString()}_${slot.endTime.toISOString()}`;
      existingSlotsMap.set(key, {
        ...slot,
        booking: bookingsBySlotId.get(slot.id),
      });
    });

    // Объединяем виртуальные и реальные слоты
    const resultSlots: TimeSlot[] = [];

    for (const virtualSlot of virtualSlots) {
      const key = `${virtualSlot.startTime.toISOString()}_${virtualSlot.endTime.toISOString()}`;
      const existingSlot = existingSlotsMap.get(key);

      if (existingSlot) {
        resultSlots.push(existingSlot);
        existingSlotsMap.delete(key);
      } else {
        resultSlots.push(virtualSlot);
      }
    }

    // Добавляем оставшиеся реальные слоты
    existingSlotsMap.forEach((slot) => {
      resultSlots.push(slot);
    });

    return resultSlots.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );
  }

  /**
   * Валидация владения системой бронирования
   */
  private async validateBookingSystemOwnership(
    bookingSystemId: string,
    userId: string
  ): Promise<void> {
    const bookingSystem = await this.bookingSystemRepository.findOne({
      where: { id: bookingSystemId, ownerId: userId },
    });
    if (!bookingSystem) {
      throw new ForbiddenException(
        "У вас нет доступа к этой системе бронирования"
      );
    }
  }
}
