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
import { NotificationService } from "../../websocket/services/notification.service";
import { NotificationType } from "../../websocket/interfaces/notification.interface";
import { ActivityLogService } from "../../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../../database/entities/activity-log.entity";

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
    private notificationsService: BookingNotificationsService,
    private notificationService: NotificationService,
    private activityLogService: ActivityLogService
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

    // Отправляем уведомление владельцу бота о создании бронирования
    if (bot && bot.ownerId) {
      const fullBooking = await this.bookingRepository.findOne({
        where: { id: savedBooking.id },
        relations: ["specialist", "service", "timeSlot"],
      });

      if (fullBooking) {
        this.notificationService
          .sendToUser(bot.ownerId, NotificationType.BOOKING_CREATED, {
            botId: bot.id,
            botName: bot.name,
            booking: {
              id: fullBooking.id,
              clientName: fullBooking.clientName,
              clientPhone: fullBooking.clientPhone,
              status: fullBooking.status,
            },
            specialist: fullBooking.specialist
              ? { name: fullBooking.specialist.name }
              : undefined,
            service: fullBooking.service
              ? { name: fullBooking.service.name }
              : undefined,
            timeSlot: fullBooking.timeSlot
              ? { startTime: fullBooking.timeSlot.startTime }
              : undefined,
          })
          .catch((error) => {
            console.error(
              "Ошибка отправки уведомления о создании бронирования:",
              error
            );
          });
      }

      // Логируем создание бронирования
      if (bot && bot.ownerId) {
        this.activityLogService
          .create({
            type: ActivityType.BOOKING_CREATED,
            level: ActivityLevel.SUCCESS,
            message: `Создано бронирование от ${savedBooking.clientName || "неизвестно"}`,
            userId: bot.ownerId,
            botId,
            metadata: {
              bookingId: savedBooking.id,
              clientName: savedBooking.clientName,
              clientPhone: savedBooking.clientPhone,
              specialistId: savedBooking.specialistId,
              serviceId: savedBooking.serviceId,
              timeSlotId: savedBooking.timeSlotId,
              status: savedBooking.status,
            },
          })
          .catch((error) => {
            console.error("Ошибка логирования создания бронирования:", error);
          });
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
    const updatedBooking = await this.bookingRepository.save(booking);

    // Отправляем уведомление владельцу бота об обновлении бронирования
    if (updatedBooking.specialist?.botId) {
      const bot = await this.botRepository.findOne({
        where: { id: updatedBooking.specialist.botId },
      });

      if (bot && bot.ownerId) {
        this.notificationService
          .sendToUser(bot.ownerId, NotificationType.BOOKING_UPDATED, {
            botId: bot.id,
            botName: bot.name,
            booking: {
              id: updatedBooking.id,
              clientName: updatedBooking.clientName,
              status: updatedBooking.status,
            },
            changes: updateBookingDto,
          })
          .catch((error) => {
            console.error(
              "Ошибка отправки уведомления об обновлении бронирования:",
              error
            );
          });
      }

      // Логируем обновление бронирования
      if (bot && bot.ownerId) {
        this.activityLogService
          .create({
            type: ActivityType.BOOKING_UPDATED,
            level: ActivityLevel.INFO,
            message: `Обновлено бронирование #${updatedBooking.id} от ${updatedBooking.clientName || "неизвестно"}`,
            userId: bot.ownerId,
            botId: bot.id,
            metadata: {
              bookingId: updatedBooking.id,
              clientName: updatedBooking.clientName,
              changes: updateBookingDto,
            },
          })
          .catch((error) => {
            console.error("Ошибка логирования обновления бронирования:", error);
          });
      }
    }

    return updatedBooking;
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

    const savedBooking = await this.bookingRepository.save(booking);

    // Логируем подтверждение бронирования
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (bot && bot.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.BOOKING_CONFIRMED,
          level: ActivityLevel.SUCCESS,
          message: `Подтверждено бронирование #${savedBooking.id} от ${savedBooking.clientName || "неизвестно"}`,
          userId: bot.ownerId,
          botId,
          metadata: {
            bookingId: savedBooking.id,
            clientName: savedBooking.clientName,
            clientPhone: savedBooking.clientPhone,
          },
        })
        .catch((error) => {
          console.error("Ошибка логирования подтверждения бронирования:", error);
        });
    }

    return savedBooking;
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

    // Отменяем все запланированные напоминания
    try {
      await this.notificationsService.cancelReminders(booking.id);
    } catch (error) {
      console.error("Failed to cancel reminders:", error);
      // Не прерываем отмену бронирования из-за ошибки отмены напоминаний
    }

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

    // Отправляем уведомление владельцу бота об отмене бронирования
    if (savedBooking.specialist?.botId) {
      const bot = await this.botRepository.findOne({
        where: { id: savedBooking.specialist.botId },
      });

      if (bot && bot.ownerId) {
        this.notificationService
          .sendToUser(bot.ownerId, NotificationType.BOOKING_CANCELLED, {
            botId: bot.id,
            botName: bot.name,
            booking: {
              id: savedBooking.id,
              clientName: savedBooking.clientName,
              clientPhone: savedBooking.clientPhone,
            },
            cancellationReason: cancelBookingDto.cancellationReason,
          })
          .catch((error) => {
            console.error(
              "Ошибка отправки уведомления об отмене бронирования:",
              error
            );
          });
      }

      // Логируем отмену бронирования
      if (bot && bot.ownerId) {
        this.activityLogService
          .create({
            type: ActivityType.BOOKING_CANCELLED,
            level: ActivityLevel.WARNING,
            message: `Отменено бронирование #${savedBooking.id} от ${savedBooking.clientName || "неизвестно"}`,
            userId: bot.ownerId,
            botId: bot.id,
            metadata: {
              bookingId: savedBooking.id,
              clientName: savedBooking.clientName,
              cancellationReason: cancelBookingDto.cancellationReason,
            },
          })
          .catch((error) => {
            console.error("Ошибка логирования отмены бронирования:", error);
          });
      }
    }

    return savedBooking;
  }

  async markAsCompleted(id: string, botId: string): Promise<Booking> {
    const booking = await this.findOne(id, botId);

    booking.markAsCompleted();

    const savedBooking = await this.bookingRepository.save(booking);

    // Логируем завершение бронирования
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (bot && bot.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.BOOKING_COMPLETED,
          level: ActivityLevel.SUCCESS,
          message: `Завершено бронирование #${savedBooking.id} от ${savedBooking.clientName || "неизвестно"}`,
          userId: bot.ownerId,
          botId,
          metadata: {
            bookingId: savedBooking.id,
            clientName: savedBooking.clientName,
          },
        })
        .catch((error) => {
          console.error("Ошибка логирования завершения бронирования:", error);
        });
    }

    return savedBooking;
  }

  async markAsNoShow(id: string, botId: string): Promise<Booking> {
    const booking = await this.findOne(id, botId);

    booking.markAsNoShow();

    const savedBooking = await this.bookingRepository.save(booking);

    // Логируем неявку
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (bot && bot.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.BOOKING_NO_SHOW,
          level: ActivityLevel.WARNING,
          message: `Отмечена неявка для бронирования #${savedBooking.id} от ${savedBooking.clientName || "неизвестно"}`,
          userId: bot.ownerId,
          botId,
          metadata: {
            bookingId: savedBooking.id,
            clientName: savedBooking.clientName,
          },
        })
        .catch((error) => {
          console.error("Ошибка логирования неявки:", error);
        });
    }

    return savedBooking;
  }

  async remove(id: string, botId: string): Promise<void> {
    const booking = await this.findOne(id, botId);
    const bookingData = {
      id: booking.id,
      clientName: booking.clientName,
    };

    // Освобождаем все составные слоты
    await this.freeBookingSlots(booking);

    await this.bookingRepository.remove(booking);

    // Логируем удаление бронирования
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (bot && bot.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.BOOKING_DELETED,
          level: ActivityLevel.WARNING,
          message: `Удалено бронирование #${bookingData.id} от ${bookingData.clientName || "неизвестно"}`,
          userId: bot.ownerId,
          botId,
          metadata: {
            bookingId: bookingData.id,
            clientName: bookingData.clientName,
          },
        })
        .catch((error) => {
          console.error("Ошибка логирования удаления бронирования:", error);
        });
    }
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
