import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, LessThan, MoreThan } from "typeorm";
import { TimeSlot } from "../../../database/entities/time-slot.entity";
import {
  Specialist,
  WorkingHours,
} from "../../../database/entities/specialist.entity";
import { Service } from "../../../database/entities/service.entity";
import {
  CreateTimeSlotDto,
  UpdateTimeSlotDto,
  GenerateTimeSlotsDto,
  GetAvailableSlotsDto,
} from "../dto/booking.dto";

@Injectable()
export class TimeSlotsService {
  constructor(
    @InjectRepository(TimeSlot)
    private timeSlotRepository: Repository<TimeSlot>,
    @InjectRepository(Specialist)
    private specialistRepository: Repository<Specialist>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>
  ) {}

  async create(
    createTimeSlotDto: CreateTimeSlotDto,
    botId: string
  ): Promise<TimeSlot> {
    // Проверяем, что специалист существует и принадлежит боту
    const specialist = await this.specialistRepository.findOne({
      where: { id: createTimeSlotDto.specialistId, botId },
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
    // Для недоступных слотов (исключения) пропускаем эти проверки
    if (createTimeSlotDto.isAvailable !== false) {
      // Проверяем, что специалист работает в это время
      if (!specialist.isWorkingAt(startTime)) {
        throw new BadRequestException(
          "Специалист не работает в указанное время"
        );
      }

      // Проверяем, что нет перерыва в это время
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

    return this.timeSlotRepository.save(timeSlot);
  }

  async findAll(botId: string): Promise<TimeSlot[]> {
    return this.timeSlotRepository.find({
      where: {
        specialist: { botId },
      },
      relations: ["specialist"],
      order: { startTime: "ASC" },
    });
  }

  async findBySpecialist(
    specialistId: string,
    botId: string
  ): Promise<TimeSlot[]> {
    // Проверяем, что специалист принадлежит боту
    const specialist = await this.specialistRepository.findOne({
      where: { id: specialistId, botId },
    });

    if (!specialist) {
      throw new NotFoundException("Специалист не найден");
    }

    return this.timeSlotRepository.find({
      where: { specialistId },
      relations: ["specialist", "booking"],
      order: { startTime: "ASC" },
    });
  }

  async findAvailableSlots(
    getAvailableSlotsDto: GetAvailableSlotsDto,
    botId: string
  ): Promise<TimeSlot[]> {
    const { specialistId, serviceId, date } = getAvailableSlotsDto;

    // Проверяем, что специалист принадлежит боту
    const specialist = await this.specialistRepository.findOne({
      where: { id: specialistId, botId },
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

    return this.timeSlotRepository.find({
      where: {
        specialistId,
        startTime: Between(startDate, endDate),
        isAvailable: true,
        isBooked: false,
      },
      relations: ["specialist"],
      order: { startTime: "ASC" },
    });
  }

  async findOne(id: string, botId: string): Promise<TimeSlot> {
    const timeSlot = await this.timeSlotRepository.findOne({
      where: {
        id,
        specialist: { botId },
      },
      relations: ["specialist", "booking"],
    });

    if (!timeSlot) {
      throw new NotFoundException("Таймслот не найден");
    }

    return timeSlot;
  }

  async update(
    id: string,
    updateTimeSlotDto: UpdateTimeSlotDto,
    botId: string
  ): Promise<TimeSlot> {
    const timeSlot = await this.findOne(id, botId);

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

    return this.timeSlotRepository.save(timeSlot);
  }

  async remove(id: string, botId: string): Promise<void> {
    const timeSlot = await this.findOne(id, botId);

    if (timeSlot.isBooked) {
      throw new BadRequestException("Нельзя удалить забронированный слот");
    }

    await this.timeSlotRepository.remove(timeSlot);
  }

  // Метод для предпросмотра слотов (виртуальные + реальные)
  async previewTimeSlots(
    specialistId: string,
    date: string,
    botId: string
  ): Promise<TimeSlot[]> {
    // Проверяем, что специалист принадлежит боту
    const specialist = await this.specialistRepository.findOne({
      where: { id: specialistId, botId },
    });

    if (!specialist) {
      throw new NotFoundException("Специалист не найден");
    }

    const targetDate = new Date(date);
    const duration = specialist.defaultSlotDuration;
    const buffer = specialist.bufferTime;

    // Генерируем виртуальные слоты для дня (не сохраняя в БД)
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
      relations: ["booking", "booking.service"],
      order: { startTime: "ASC" },
    });

    // Создаем Map для быстрого поиска существующих слотов по времени
    const existingSlotsMap = new Map<string, TimeSlot>();
    existingSlots.forEach((slot) => {
      const key = `${slot.startTime.toISOString()}_${slot.endTime.toISOString()}`;
      existingSlotsMap.set(key, slot);
    });

    // Объединяем виртуальные и реальные слоты
    const resultSlots: TimeSlot[] = [];

    for (const virtualSlot of virtualSlots) {
      const key = `${virtualSlot.startTime.toISOString()}_${virtualSlot.endTime.toISOString()}`;
      const existingSlot = existingSlotsMap.get(key);

      if (existingSlot) {
        // Если слот существует в БД, используем его
        resultSlots.push(existingSlot);
        existingSlotsMap.delete(key);
      } else {
        // Иначе используем виртуальный слот
        resultSlots.push(virtualSlot);
      }
    }

    // Добавляем оставшиеся реальные слоты (которые не совпали с виртуальными)
    existingSlotsMap.forEach((slot) => {
      resultSlots.push(slot);
    });

    return resultSlots.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );
  }

  async generateTimeSlots(
    generateTimeSlotsDto: GenerateTimeSlotsDto,
    botId: string
  ): Promise<TimeSlot[]> {
    const { specialistId, startDate, endDate, slotDuration, bufferTime } =
      generateTimeSlotsDto;

    // Проверяем, что специалист принадлежит боту
    const specialist = await this.specialistRepository.findOne({
      where: { id: specialistId, botId },
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
    return this.timeSlotRepository.save(slots);
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
}
