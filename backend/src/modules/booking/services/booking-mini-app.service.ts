import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, MoreThan } from "typeorm";
import { Bot, BotStatus } from "../../../database/entities/bot.entity";
import { Specialist } from "../../../database/entities/specialist.entity";
import { Service } from "../../../database/entities/service.entity";
import { TimeSlot } from "../../../database/entities/time-slot.entity";
import {
  Booking,
  BookingStatus,
  BookingSource,
} from "../../../database/entities/booking.entity";
import { CreateBookingDto } from "../dto/booking.dto";

@Injectable()
export class BookingMiniAppService {
  constructor(
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    @InjectRepository(Specialist)
    private specialistRepository: Repository<Specialist>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(TimeSlot)
    private timeSlotRepository: Repository<TimeSlot>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>
  ) {}

  async getPublicBotForBooking(botId: string): Promise<any> {
    const bot = await this.botRepository.findOne({
      where: {
        id: botId,
        status: BotStatus.ACTIVE,
        isBookingEnabled: true,
      },
    });

    if (!bot) {
      throw new NotFoundException(
        "Бот не найден или система бронирования не активна"
      );
    }

    return {
      id: bot.id,
      name: bot.name,
      description: bot.description,
      bookingTitle: bot.bookingTitle,
      bookingDescription: bot.bookingDescription,
      bookingLogoUrl: bot.bookingLogoUrl,
      bookingCustomStyles: bot.bookingCustomStyles,
      bookingButtonTypes: bot.bookingButtonTypes,
      bookingButtonSettings: bot.bookingButtonSettings,
      bookingSettings: bot.bookingSettings || bot.defaultBookingSettings,
      bookingUrl: bot.bookingUrl,
    };
  }

  async getPublicSpecialists(botId: string): Promise<Specialist[]> {
    return this.specialistRepository.find({
      where: {
        botId,
        isActive: true,
      },
      relations: ["services"],
      order: { name: "ASC" },
    });
  }

  async getPublicServices(botId: string): Promise<Service[]> {
    return this.serviceRepository
      .createQueryBuilder("service")
      .innerJoin("service.specialists", "specialist")
      .where("specialist.botId = :botId", { botId })
      .andWhere("service.isActive = :isActive", { isActive: true })
      .andWhere("specialist.isActive = :specialistActive", {
        specialistActive: true,
      })
      .leftJoinAndSelect("service.specialists", "allSpecialists")
      .orderBy("service.name", "ASC")
      .getMany();
  }

  async getPublicServicesBySpecialist(
    botId: string,
    specialistId: string
  ): Promise<Service[]> {
    // Проверяем, что специалист принадлежит боту
    const specialist = await this.specialistRepository.findOne({
      where: { id: specialistId, botId },
    });

    if (!specialist) {
      throw new NotFoundException("Специалист не найден");
    }

    return this.serviceRepository
      .createQueryBuilder("service")
      .innerJoin("service.specialists", "specialist")
      .where("specialist.id = :specialistId", { specialistId })
      .andWhere("service.isActive = :isActive", { isActive: true })
      .leftJoinAndSelect("service.specialists", "allSpecialists")
      .orderBy("service.name", "ASC")
      .getMany();
  }

  async getPublicTimeSlots(
    botId: string,
    specialistId: string,
    serviceId?: string,
    date?: string
  ): Promise<TimeSlot[]> {
    // Проверяем, что специалист принадлежит боту
    const specialist = await this.specialistRepository.findOne({
      where: { id: specialistId, botId },
    });

    if (!specialist) {
      throw new NotFoundException("Специалист не найден");
    }

    // Получаем длительность услуги
    let serviceDuration: number | null = null;
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

    let query = this.timeSlotRepository
      .createQueryBuilder("timeSlot")
      .leftJoinAndSelect("timeSlot.specialist", "specialist")
      .where("specialist.id = :specialistId", { specialistId })
      .andWhere("specialist.botId = :botId", { botId })
      .andWhere("timeSlot.isAvailable = :isAvailable", { isAvailable: true })
      .andWhere("timeSlot.isBooked = :isBooked", { isBooked: false })
      .andWhere("timeSlot.startTime > :now", { now: new Date() })
      .orderBy("timeSlot.startTime", "ASC");

    // Фильтр по дате
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setUTCDate(endDate.getUTCDate() + 1);

      query = query
        .andWhere("timeSlot.startTime >= :startDate", { startDate })
        .andWhere("timeSlot.startTime < :endDate", { endDate });
    }

    const availableSlots = await query.getMany();

    // Если услуга указана, объединяем последовательные слоты
    if (serviceDuration && availableSlots.length > 0) {
      return this.mergeConsecutiveSlots(availableSlots, serviceDuration);
    }

    return availableSlots;
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

  async createPublicBooking(
    botId: string,
    createBookingDto: CreateBookingDto
  ): Promise<Booking> {
    // Проверяем, что все связанные сущности существуют и принадлежат боту
    const specialist = await this.specialistRepository.findOne({
      where: { id: createBookingDto.specialistId, botId },
    });

    if (!specialist) {
      throw new NotFoundException("Специалист не найден");
    }

    const service = await this.serviceRepository
      .createQueryBuilder("service")
      .innerJoin("service.specialists", "specialist")
      .where("service.id = :serviceId", {
        serviceId: createBookingDto.serviceId,
      })
      .andWhere("specialist.id = :specialistId", {
        specialistId: createBookingDto.specialistId,
      })
      .getOne();

    if (!service) {
      throw new NotFoundException(
        "Услуга не найдена или не связана с этим специалистом"
      );
    }

    // Проверяем, является ли это объединенным слотом
    const isMergedSlot = createBookingDto.timeSlotId.startsWith("merged_");
    let timeSlot: TimeSlot | null = null;
    let slotsToBook: TimeSlot[] = [];

    if (isMergedSlot) {
      // Извлекаем ID составных слотов из metadata
      // Формат: merged_{firstSlotId}_{lastSlotId}
      const parts = createBookingDto.timeSlotId.split("_");
      if (parts.length < 3) {
        throw new BadRequestException("Некорректный ID объединенного слота");
      }

      const firstSlotId = parts[1];

      // Получаем первый слот, чтобы получить информацию о времени
      const firstSlot = await this.timeSlotRepository.findOne({
        where: { id: firstSlotId },
      });

      if (!firstSlot) {
        throw new NotFoundException("Первый слот не найден");
      }

      // Находим все последовательные слоты для этого времени и длительности
      const requiredDurationMs = service.duration * 60 * 1000;
      let currentTime = new Date(firstSlot.startTime);
      let accumulatedDuration = 0;

      while (accumulatedDuration < requiredDurationMs) {
        const nextSlot = await this.timeSlotRepository.findOne({
          where: {
            specialistId: createBookingDto.specialistId,
            startTime: currentTime,
            isAvailable: true,
            isBooked: false,
          },
        });

        if (!nextSlot) {
          throw new NotFoundException(
            "Один из необходимых слотов недоступен для бронирования"
          );
        }

        slotsToBook.push(nextSlot);
        accumulatedDuration += nextSlot.getDuration();
        currentTime = new Date(nextSlot.endTime);
      }

      // Используем первый слот как основной timeSlot для бронирования
      timeSlot = firstSlot;
    } else {
      // Обычный слот
      timeSlot = await this.timeSlotRepository.findOne({
        where: {
          id: createBookingDto.timeSlotId,
          specialistId: createBookingDto.specialistId,
          isAvailable: true,
          isBooked: false,
        },
      });

      if (!timeSlot) {
        throw new NotFoundException("Таймслот недоступен для бронирования");
      }

      slotsToBook = [timeSlot];
    }

    // Проверяем, что время слота не в прошлом
    if (timeSlot.isInPast()) {
      throw new BadRequestException("Нельзя забронировать время в прошлом");
    }

    // Проверяем, что специалист работает в это время
    if (!specialist.isWorkingAt(timeSlot.startTime)) {
      throw new BadRequestException("Специалист не работает в указанное время");
    }

    // Проверяем, что нет перерыва в это время
    if (specialist.isOnBreak(timeSlot.startTime)) {
      throw new BadRequestException("В указанное время у специалиста перерыв");
    }

    // Создаем бронирование
    const booking = this.bookingRepository.create({
      ...createBookingDto,
      status: BookingStatus.PENDING,
      source: BookingSource.MINI_APP,
    });

    // Генерируем код подтверждения если требуется
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (bot?.bookingSettings?.requireConfirmation) {
      booking.generateConfirmationCode();
    }

    // Сохраняем информацию о всех составных слотах в metadata бронирования
    if (slotsToBook.length > 1) {
      booking.clientData = {
        ...booking.clientData,
        mergedSlotIds: slotsToBook.map((s) => s.id),
      };
    }

    const savedBooking = await this.bookingRepository.save(booking);

    // Помечаем все слоты как забронированные
    for (const slot of slotsToBook) {
      slot.isBooked = true;
      await this.timeSlotRepository.save(slot);
    }

    return savedBooking;
  }

  async getBookingByCode(confirmationCode: string): Promise<Booking | null> {
    return this.bookingRepository.findOne({
      where: { confirmationCode },
      relations: ["specialist", "service", "timeSlot"],
    });
  }

  async confirmBookingByCode(confirmationCode: string): Promise<Booking> {
    const booking = await this.getBookingByCode(confirmationCode);

    if (!booking) {
      throw new NotFoundException("Бронирование не найдено");
    }

    if (!booking.canBeConfirmed) {
      throw new BadRequestException("Бронирование не может быть подтверждено");
    }

    booking.confirm();

    return this.bookingRepository.save(booking);
  }

  async cancelBookingByCode(
    confirmationCode: string,
    reason?: string
  ): Promise<Booking> {
    const booking = await this.getBookingByCode(confirmationCode);

    if (!booking) {
      throw new NotFoundException("Бронирование не найдено");
    }

    if (!booking.canBeCancelled) {
      throw new BadRequestException("Бронирование не может быть отменено");
    }

    booking.cancel(reason);

    // Освобождаем все составные слоты
    const slotIdsToFree: string[] = [];

    // Проверяем, есть ли информация о составных слотах в metadata
    if (booking.clientData?.mergedSlotIds) {
      slotIdsToFree.push(...booking.clientData.mergedSlotIds);
    } else {
      // Если нет информации о составных слотах, освобождаем только основной
      slotIdsToFree.push(booking.timeSlotId);
    }

    // Освобождаем все слоты
    for (const slotId of slotIdsToFree) {
      const slot = await this.timeSlotRepository.findOne({
        where: { id: slotId },
      });
      if (slot) {
        slot.isBooked = false;
        await this.timeSlotRepository.save(slot);
      }
    }

    return this.bookingRepository.save(booking);
  }

  async getBookingStatistics(botId: string): Promise<any> {
    const totalBookings = await this.bookingRepository.count({
      where: { specialist: { botId } },
    });

    const todayBookings = await this.bookingRepository.count({
      where: {
        specialist: { botId },
        timeSlot: {
          startTime: Between(
            new Date(new Date().setUTCHours(0, 0, 0, 0)),
            new Date(new Date().setUTCHours(23, 59, 59, 999))
          ),
        },
      },
    });

    const upcomingBookings = await this.bookingRepository.count({
      where: {
        specialist: { botId },
        status: BookingStatus.CONFIRMED,
        timeSlot: {
          startTime: MoreThan(new Date()),
        },
      },
    });

    return {
      total: totalBookings,
      today: todayBookings,
      upcoming: upcomingBookings,
    };
  }
}
