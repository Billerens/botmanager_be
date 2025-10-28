import {
  Injectable,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Inject,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, MoreThan, In } from "typeorm";
import {
  Booking,
  BookingStatus,
} from "../../../database/entities/booking.entity";
import { TimeSlot } from "../../../database/entities/time-slot.entity";
import { Specialist } from "../../../database/entities/specialist.entity";
import { Service } from "../../../database/entities/service.entity";
import { Bot } from "../../../database/entities/bot.entity";
import {
  CreateBookingDto,
  UpdateBookingDto,
  ConfirmBookingDto,
  CancelBookingDto,
} from "../dto/booking.dto";
import { BookingNotificationsService } from "./booking-notifications.service";

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(TimeSlot)
    private timeSlotRepository: Repository<TimeSlot>,
    @InjectRepository(Specialist)
    private specialistRepository: Repository<Specialist>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    @Inject(forwardRef(() => BookingNotificationsService))
    private notificationsService: BookingNotificationsService
  ) {}

  async create(
    createBookingDto: CreateBookingDto,
    botId: string
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

    const timeSlot = await this.timeSlotRepository.findOne({
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

    // Проверяем длительность услуги
    const slotDuration = timeSlot.getDuration();
    if (slotDuration < service.duration) {
      throw new BadRequestException(
        "Длительность слота меньше длительности услуги"
      );
    }

    // Создаем бронирование
    const booking = this.bookingRepository.create({
      ...createBookingDto,
      status: BookingStatus.PENDING,
    });

    // Генерируем код подтверждения если требуется
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (bot?.bookingSettings?.requireConfirmation) {
      booking.generateConfirmationCode();
    }

    const savedBooking = await this.bookingRepository.save(booking);

    // Помечаем слот как забронированный
    timeSlot.isBooked = true;
    await this.timeSlotRepository.save(timeSlot);

    // Планируем напоминания если они указаны
    if (savedBooking.reminders && savedBooking.reminders.length > 0) {
      try {
        await this.notificationsService.scheduleReminders(savedBooking);
      } catch (error) {
        console.error("Failed to schedule reminders:", error);
        // Не прерываем создание бронирования из-за ошибки планирования
      }
    }

    return savedBooking;
  }

  async findAll(botId: string): Promise<Booking[]> {
    return this.bookingRepository.find({
      where: {
        specialist: { botId },
      },
      relations: ["specialist", "service", "timeSlot"],
      order: { createdAt: "DESC" },
    });
  }

  async findBySpecialist(
    specialistId: string,
    botId: string
  ): Promise<Booking[]> {
    // Проверяем, что специалист принадлежит боту
    const specialist = await this.specialistRepository.findOne({
      where: { id: specialistId, botId },
    });

    if (!specialist) {
      throw new NotFoundException("Специалист не найден");
    }

    return this.bookingRepository.find({
      where: { specialistId },
      relations: ["specialist", "service", "timeSlot"],
      order: { createdAt: "DESC" },
    });
  }

  async findByDateRange(
    botId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Booking[]> {
    return this.bookingRepository.find({
      where: {
        specialist: { botId },
        timeSlot: {
          startTime: Between(startDate, endDate),
        },
      },
      relations: ["specialist", "service", "timeSlot"],
      order: { timeSlot: { startTime: "ASC" } },
    });
  }

  async findOne(id: string, botId: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: {
        id,
        specialist: { botId },
      },
      relations: ["specialist", "service", "timeSlot"],
    });

    if (!booking) {
      throw new NotFoundException("Бронирование не найдено");
    }

    return booking;
  }

  async update(
    id: string,
    updateBookingDto: UpdateBookingDto,
    botId: string
  ): Promise<Booking> {
    const booking = await this.findOne(id, botId);

    // Ограничиваем изменения в зависимости от статуса
    if (booking.isConfirmed || booking.isCompleted) {
      const allowedFields = ["notes", "clientData"];
      const updateFields = Object.keys(updateBookingDto);
      const hasRestrictedFields = updateFields.some(
        (field) => !allowedFields.includes(field)
      );

      if (hasRestrictedFields) {
        throw new BadRequestException(
          "Нельзя изменять подтвержденное или завершенное бронирование"
        );
      }
    }

    Object.assign(booking, updateBookingDto);

    return this.bookingRepository.save(booking);
  }

  async confirm(
    id: string,
    confirmBookingDto: ConfirmBookingDto,
    botId: string
  ): Promise<Booking> {
    const booking = await this.findOne(id, botId);

    if (!booking.canBeConfirmed) {
      throw new BadRequestException("Бронирование не может быть подтверждено");
    }

    if (booking.confirmationCode !== confirmBookingDto.confirmationCode) {
      throw new BadRequestException("Неверный код подтверждения");
    }

    booking.confirm();

    return this.bookingRepository.save(booking);
  }

  async cancel(
    id: string,
    cancelBookingDto: CancelBookingDto,
    botId: string
  ): Promise<Booking> {
    const booking = await this.findOne(id, botId);

    if (!booking.canBeCancelled) {
      throw new BadRequestException("Бронирование не может быть отменено");
    }

    booking.cancel(cancelBookingDto.cancellationReason);

    // Освобождаем все составные слоты
    await this.freeBookingSlots(booking);

    const savedBooking = await this.bookingRepository.save(booking);

    // Отправляем уведомление об отмене, если есть причина
    if (cancelBookingDto.cancellationReason && booking.telegramUserId) {
      try {
        await this.notificationsService.sendCancellationNotification(
          booking.id,
          cancelBookingDto.cancellationReason
        );
      } catch (error) {
        console.error("Failed to send cancellation notification:", error);
        // Не прерываем отмену бронирования из-за ошибки отправки уведомления
      }
    }

    return savedBooking;
  }

  async markAsCompleted(id: string, botId: string): Promise<Booking> {
    const booking = await this.findOne(id, botId);

    booking.markAsCompleted();

    return this.bookingRepository.save(booking);
  }

  async markAsNoShow(id: string, botId: string): Promise<Booking> {
    const booking = await this.findOne(id, botId);

    booking.markAsNoShow();

    return this.bookingRepository.save(booking);
  }

  async remove(id: string, botId: string): Promise<void> {
    const booking = await this.findOne(id, botId);

    // Освобождаем все составные слоты
    await this.freeBookingSlots(booking);

    await this.bookingRepository.remove(booking);
  }

  /**
   * Освобождает все слоты, связанные с бронированием
   * (включая составные слоты для объединенных бронирований)
   */
  private async freeBookingSlots(booking: Booking): Promise<void> {
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
  }

  async getBookingsByStatus(
    botId: string,
    status: BookingStatus
  ): Promise<Booking[]> {
    return this.bookingRepository.find({
      where: {
        specialist: { botId },
        status,
      },
      relations: ["specialist", "service", "timeSlot"],
      order: { createdAt: "DESC" },
    });
  }

  async getUpcomingBookings(
    botId: string,
    limit: number = 10
  ): Promise<Booking[]> {
    const now = new Date();

    return this.bookingRepository.find({
      where: {
        specialist: { botId },
        status: BookingStatus.CONFIRMED,
        timeSlot: {
          startTime: MoreThan(now),
        },
      },
      relations: ["specialist", "service", "timeSlot"],
      order: { timeSlot: { startTime: "ASC" } },
      take: limit,
    });
  }

  async getBookingsForReminder(): Promise<Booking[]> {
    const now = new Date();
    const reminderTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 часа вперед
    const reminderEndTime = new Date(reminderTime.getTime() + 60 * 60 * 1000); // +1 час

    return this.bookingRepository.find({
      where: {
        status: BookingStatus.CONFIRMED,
        timeSlot: {
          startTime: Between(reminderTime, reminderEndTime),
        },
      },
      relations: ["specialist", "service", "timeSlot"],
    });
  }

  /**
   * Получить записи бота с данными бота для уведомлений
   * Используется когда нужен доступ к настройкам бота через записи
   */
  async getBookingsForReminderWithBotData(): Promise<
    Array<Booking & { bot: Bot }>
  > {
    const bookings = await this.getBookingsForReminder();

    // Получаем уникальные botId из специалистов
    const botIds = [...new Set(bookings.map((b) => b.specialist.botId))];

    // Загружаем ботов одним запросом
    const bots = await this.botRepository.find({
      where: { id: In(botIds) },
    });

    // Создаем Map для быстрого поиска ботов
    const botMap = new Map(bots.map((bot) => [bot.id, bot]));

    // Добавляем данные бота к записям
    return bookings.map(
      (booking) =>
        ({
          ...booking,
          bot: botMap.get(booking.specialist.botId),
        }) as Booking & { bot: Bot }
    );
  }

  async getStatistics(botId: string): Promise<any> {
    const stats = await this.bookingRepository
      .createQueryBuilder("booking")
      .leftJoin("booking.specialist", "specialist")
      .select([
        "COUNT(*) as total",
        "COUNT(CASE WHEN booking.status = :confirmed THEN 1 END) as confirmed",
        "COUNT(CASE WHEN booking.status = :completed THEN 1 END) as completed",
        "COUNT(CASE WHEN booking.status = :cancelled THEN 1 END) as cancelled",
        "COUNT(CASE WHEN booking.status = :noShow THEN 1 END) as noShow",
      ])
      .where("specialist.botId = :botId", { botId })
      .setParameters({
        confirmed: BookingStatus.CONFIRMED,
        completed: BookingStatus.COMPLETED,
        cancelled: BookingStatus.CANCELLED,
        noShow: BookingStatus.NO_SHOW,
      })
      .getRawOne();

    const total = parseInt(stats.total) || 0;
    const confirmed = parseInt(stats.confirmed) || 0;
    const completed = parseInt(stats.completed) || 0;
    const cancelled = parseInt(stats.cancelled) || 0;
    const noShow = parseInt(stats.noShow) || 0;

    return {
      total,
      confirmed,
      completed,
      cancelled,
      noShow,
      confirmationRate: total > 0 ? (confirmed / total) * 100 : 0,
      completionRate: confirmed > 0 ? (completed / confirmed) * 100 : 0,
      cancellationRate: total > 0 ? (cancelled / total) * 100 : 0,
      noShowRate: confirmed > 0 ? (noShow / confirmed) * 100 : 0,
    };
  }
}
