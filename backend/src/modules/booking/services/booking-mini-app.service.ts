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

    // Определяем диапазон поиска
    let startDate: Date;
    let endDate: Date;

    if (date) {
      startDate = new Date(date);
      endDate = new Date(date);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
    } else {
      startDate = new Date();
      endDate = new Date();
      endDate.setUTCDate(endDate.getUTCDate() + 30); // 30 дней вперед
    }

    // Загружаем ВСЕ физически существующие слоты (включая забронированные)
    // чтобы корректно исключить их при генерации виртуальных
    const allPhysicalSlots = await this.timeSlotRepository
      .createQueryBuilder("timeSlot")
      .leftJoinAndSelect("timeSlot.specialist", "specialist")
      .where("specialist.id = :specialistId", { specialistId })
      .andWhere("specialist.botId = :botId", { botId })
      .andWhere("timeSlot.startTime >= :startDate", { startDate })
      .andWhere("timeSlot.startTime < :endDate", { endDate })
      .andWhere("timeSlot.startTime > :now", { now: new Date() })
      .orderBy("timeSlot.startTime", "ASC")
      .getMany();

    // Генерируем виртуальные слоты для конкретной даты
    let allSlots: TimeSlot[] = [];

    if (date) {
      const targetDate = new Date(date);
      // Генерируем виртуальные слоты, исключая временные промежутки с физическими слотами
      const virtualSlots = await this.generateVirtualSlotsForDay(
        specialist,
        targetDate,
        allPhysicalSlots // передаем физические слоты для исключения
      );

      // Объединяем физические и виртуальные слоты
      allSlots = [...allPhysicalSlots, ...virtualSlots].sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime()
      );
    } else {
      // Если дата не указана, возвращаем только физические слоты
      allSlots = allPhysicalSlots;
    }

    // Если услуга указана, объединяем последовательные СВОБОДНЫЕ слоты
    // и добавляем занятые слоты к результату
    if (serviceDuration) {
      const availableSlots = allSlots.filter(
        (slot) => slot.isAvailable && !slot.isBooked
      );
      const bookedSlots = allSlots.filter(
        (slot) => !slot.isAvailable || slot.isBooked
      );

      if (availableSlots.length > 0) {
        const mergedAvailableSlots = this.mergeConsecutiveSlots(
          availableSlots,
          serviceDuration
        );
        // Возвращаем объединенные свободные слоты + занятые слоты
        return [...mergedAvailableSlots, ...bookedSlots].sort(
          (a, b) => a.startTime.getTime() - b.startTime.getTime()
        );
      }

      // Если нет свободных слотов для объединения, возвращаем только занятые
      return bookedSlots;
    }

    // Если услуга не указана, возвращаем ВСЕ слоты (и свободные, и занятые)
    return allSlots;
  }

  /**
   * Генерирует виртуальные слоты на день без сохранения в БД
   * @param specialist специалист
   * @param date дата для генерации
   * @param existingPhysicalSlots существующие физические слоты для исключения перекрытий
   */
  private async generateVirtualSlotsForDay(
    specialist: any,
    date: Date,
    existingPhysicalSlots: TimeSlot[] = []
  ): Promise<TimeSlot[]> {
    const dayOfWeek = this.getDayOfWeek(date);
    const workingHours = specialist.workingHours?.[dayOfWeek];

    if (!workingHours || !workingHours.isWorking) {
      return [];
    }

    const slots: TimeSlot[] = [];
    const duration = specialist.defaultSlotDuration;
    const buffer = specialist.bufferTime || 0;

    const startTime = this.parseTime(workingHours.startTime, date);
    const endTime = this.parseTime(workingHours.endTime, date);
    const now = new Date();

    let currentTime = new Date(startTime);

    while (currentTime < endTime) {
      const slotEndTime = new Date(
        currentTime.getTime() + duration * 60 * 1000
      );

      if (slotEndTime > endTime) {
        break;
      }

      // Пропускаем слоты в прошлом
      if (slotEndTime <= now) {
        currentTime = new Date(slotEndTime.getTime() + buffer * 60 * 1000);
        continue;
      }

      // Проверяем перерывы
      const breaks = workingHours.breaks || specialist.breakTimes || [];
      const isOnBreak = breaks.some((breakTime: any) => {
        const breakStart = this.parseTime(breakTime.startTime, date);
        const breakEnd = this.parseTime(breakTime.endTime, date);
        return currentTime < breakEnd && slotEndTime > breakStart;
      });

      if (isOnBreak) {
        currentTime = new Date(slotEndTime.getTime() + buffer * 60 * 1000);
        continue;
      }

      // Проверяем, не перекрывается ли виртуальный слот с физическим
      const overlapsWithPhysical = existingPhysicalSlots.some(
        (physicalSlot) => {
          // Проверяем пересечение временных интервалов
          return (
            currentTime < physicalSlot.endTime &&
            slotEndTime > physicalSlot.startTime
          );
        }
      );

      if (!overlapsWithPhysical) {
        // Создаем виртуальный слот только если он не перекрывается с физическим
        const virtualSlot = new TimeSlot();
        // Генерируем временный ID на основе времени для виртуальных слотов
        virtualSlot.id = `virtual_${currentTime.getTime()}_${slotEndTime.getTime()}`;
        virtualSlot.specialistId = specialist.id;
        virtualSlot.specialist = specialist;
        virtualSlot.startTime = new Date(currentTime);
        virtualSlot.endTime = new Date(slotEndTime);
        virtualSlot.isAvailable = true;
        virtualSlot.isBooked = false;
        slots.push(virtualSlot);
      }

      currentTime = new Date(slotEndTime.getTime() + buffer * 60 * 1000);
    }

    return slots;
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

  private parseTime(timeStr: string, date: Date): Date {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const result = new Date(date);
    result.setUTCHours(hours, minutes, 0, 0);
    return result;
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

    // Проверяем тип слота
    const isMergedSlot = createBookingDto.timeSlotId.startsWith("merged_");
    const isVirtualSlot = createBookingDto.timeSlotId.startsWith("virtual_");
    let timeSlot: TimeSlot | null = null;
    let slotsToBook: TimeSlot[] = [];

    if (isMergedSlot) {
      // Извлекаем ID составных слотов из metadata
      // Формат: merged_{firstSlotId}_{lastSlotId}
      const parts = createBookingDto.timeSlotId.split("_");
      if (parts.length < 3) {
        throw new BadRequestException("Некорректный ID объединенного слота");
      }

      // Проверяем, объединены ли виртуальные слоты
      const isMergedVirtual = parts[1] === "virtual";

      let firstSlot: TimeSlot;

      if (isMergedVirtual) {
        // Merged из виртуальных слотов
        // Формат: merged_virtual_startMs1_endMs1_virtual_startMs2_endMs2_...
        // Извлекаем все пары virtual_startMs_endMs
        const virtualSlotIds: string[] = [];
        for (let i = 1; i < parts.length; i += 3) {
          if (parts[i] === "virtual" && parts[i + 1] && parts[i + 2]) {
            virtualSlotIds.push(`virtual_${parts[i + 1]}_${parts[i + 2]}`);
          }
        }

        if (virtualSlotIds.length === 0) {
          throw new BadRequestException(
            "Не удалось извлечь виртуальные слоты из ID"
          );
        }

        // Создаем физические слоты для каждого виртуального
        for (const virtualId of virtualSlotIds) {
          const virtualParts = virtualId.split("_");
          const startTimeMs = parseInt(virtualParts[1]);
          const endTimeMs = parseInt(virtualParts[2]);

          if (isNaN(startTimeMs) || isNaN(endTimeMs)) {
            throw new BadRequestException(
              "Некорректное время в виртуальном слоте"
            );
          }

          const startTime = new Date(startTimeMs);
          const endTime = new Date(endTimeMs);

          // Проверяем, не существует ли уже слот с таким временем
          let existingSlot = await this.timeSlotRepository.findOne({
            where: {
              specialistId: createBookingDto.specialistId,
              startTime,
              endTime,
            },
          });

          if (!existingSlot) {
            // Создаем новый физический слот
            existingSlot = this.timeSlotRepository.create({
              specialistId: createBookingDto.specialistId,
              startTime,
              endTime,
              isAvailable: true,
              isBooked: false,
            });
            existingSlot = await this.timeSlotRepository.save(existingSlot);
          }

          // Проверяем доступность
          if (existingSlot.isBooked || !existingSlot.isAvailable) {
            throw new NotFoundException(
              `Слот ${virtualId} уже забронирован или недоступен`
            );
          }

          slotsToBook.push(existingSlot);
        }

        // Первый слот для основного бронирования
        firstSlot = slotsToBook[0];
      } else {
        // Merged из физических слотов
        const firstSlotId = parts[1];

        // Получаем первый слот, чтобы получить информацию о времени
        const foundFirstSlot = await this.timeSlotRepository.findOne({
          where: { id: firstSlotId },
        });

        if (!foundFirstSlot) {
          throw new NotFoundException("Первый слот не найден");
        }

        firstSlot = foundFirstSlot;

        // Находим все последовательные свободные слоты в нужном временном диапазоне
        const requiredDurationMs = service.duration * 60 * 1000;
        const endTime = new Date(
          firstSlot.startTime.getTime() + requiredDurationMs
        );

        // Загружаем все доступные слоты в этом временном диапазоне
        const availableSlots = await this.timeSlotRepository
          .createQueryBuilder("slot")
          .where("slot.specialistId = :specialistId", {
            specialistId: createBookingDto.specialistId,
          })
          .andWhere("slot.startTime >= :startTime", {
            startTime: firstSlot.startTime,
          })
          .andWhere("slot.startTime < :endTime", { endTime })
          .andWhere("slot.isAvailable = :isAvailable", { isAvailable: true })
          .andWhere("slot.isBooked = :isBooked", { isBooked: false })
          .orderBy("slot.startTime", "ASC")
          .getMany();

        if (availableSlots.length === 0) {
          throw new NotFoundException(
            "Не найдено доступных слотов для бронирования"
          );
        }

        // Проверяем, что слоты последовательные и покрывают всю необходимую длительность
        let accumulatedDuration = 0;
        let currentEndTime = new Date(firstSlot.startTime);

        for (const slot of availableSlots) {
          // Проверяем последовательность (допускаем разрыв до 1 минуты)
          const gap = slot.startTime.getTime() - currentEndTime.getTime();
          const maxGapMs = 1 * 60 * 1000; // 1 минута

          if (gap > maxGapMs) {
            throw new NotFoundException("Слоты не являются последовательными");
          }

          slotsToBook.push(slot);
          const slotDuration =
            slot.endTime.getTime() - slot.startTime.getTime();
          accumulatedDuration += slotDuration;
          currentEndTime = new Date(slot.endTime);

          // Если набрали достаточную длительность
          if (accumulatedDuration >= requiredDurationMs) {
            break;
          }
        }

        // Проверяем, что набрали достаточную длительность
        if (accumulatedDuration < requiredDurationMs) {
          throw new NotFoundException(
            `Недостаточно последовательных слотов для услуги длительностью ${service.duration} минут`
          );
        }
      }

      // Используем первый слот как основной timeSlot для бронирования
      timeSlot = firstSlot;
    } else if (isVirtualSlot) {
      // Виртуальный слот - создаем его в БД перед бронированием
      // Извлекаем время из ID: virtual_startTimeMs_endTimeMs
      const parts = createBookingDto.timeSlotId.split("_");
      if (parts.length !== 3) {
        throw new BadRequestException("Некорректный ID виртуального слота");
      }

      const startTimeMs = parseInt(parts[1]);
      const endTimeMs = parseInt(parts[2]);

      if (isNaN(startTimeMs) || isNaN(endTimeMs)) {
        throw new BadRequestException(
          "Некорректное время в ID виртуального слота"
        );
      }

      const startTime = new Date(startTimeMs);
      const endTime = new Date(endTimeMs);

      // Проверяем, что слот не в прошлом
      if (endTime <= new Date()) {
        throw new BadRequestException("Нельзя забронировать время в прошлом");
      }

      // Создаем физический слот для бронирования
      timeSlot = this.timeSlotRepository.create({
        specialistId: createBookingDto.specialistId,
        startTime,
        endTime,
        isAvailable: true,
        isBooked: false,
      });

      // Сохраняем слот в БД
      timeSlot = await this.timeSlotRepository.save(timeSlot);
      slotsToBook = [timeSlot];
    } else {
      // Физический слот из БД
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
      timeSlotId: timeSlot.id, // Используем реальный ID первого слота вместо merged_...
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
