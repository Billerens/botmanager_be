import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, MoreThan } from "typeorm";
import { OnEvent } from "@nestjs/event-emitter";
import {
  Booking,
  BookingStatus,
} from "../../../database/entities/booking.entity";
import { TimeSlot } from "../../../database/entities/time-slot.entity";
import { Specialist } from "../../../database/entities/specialist.entity";
import { Service } from "../../../database/entities/service.entity";
import { BookingSystem } from "../../../database/entities/booking-system.entity";
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
import { PaymentConfigService } from "../../payments/services/payment-config.service";
import { PaymentEntityType } from "../../../database/entities/payment-config.entity";
import {
  Payment,
  EntityPaymentStatus,
  PaymentTargetType,
} from "../../../database/entities/payment.entity";
import { PaymentEvent } from "../../payments/services/payment-transaction.service";

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(TimeSlot)
    private timeSlotRepository: Repository<TimeSlot>,
    @InjectRepository(Specialist)
    private specialistRepository: Repository<Specialist>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(BookingSystem)
    private bookingSystemRepository: Repository<BookingSystem>,
    @Inject(forwardRef(() => BookingNotificationsService))
    private notificationsService: BookingNotificationsService,
    private notificationService: NotificationService,
    private activityLogService: ActivityLogService,
    @Inject(forwardRef(() => PaymentConfigService))
    private paymentConfigService: PaymentConfigService
  ) {}

  // =====================================================
  // ОБРАБОТЧИКИ СОБЫТИЙ ПЛАТЕЖЕЙ
  // =====================================================

  /**
   * Обработка события успешного платежа
   */
  @OnEvent(PaymentEvent.SUCCEEDED)
  async handlePaymentSucceeded(payment: Payment): Promise<void> {
    if (payment.targetType !== PaymentTargetType.BOOKING) {
      return;
    }

    this.logger.log(`Payment succeeded for booking ${payment.targetId}`);

    try {
      const booking = await this.bookingRepository.findOne({
        where: { id: payment.targetId },
      });

      if (!booking) {
        this.logger.warn(`Booking ${payment.targetId} not found for payment`);
        return;
      }

      // Обновляем статус оплаты
      booking.paymentId = payment.id;
      booking.paymentStatus = EntityPaymentStatus.PAID;

      // Автоматически подтверждаем бронирование при успешной оплате
      if (booking.status === BookingStatus.PENDING) {
        booking.status = BookingStatus.CONFIRMED;
      }

      await this.bookingRepository.save(booking);

      this.logger.log(`Booking ${booking.id} payment status updated to PAID`);
    } catch (error) {
      this.logger.error(
        `Error handling payment succeeded for booking ${payment.targetId}`,
        error
      );
    }
  }

  /**
   * Обработка события неудачного платежа
   */
  @OnEvent(PaymentEvent.FAILED)
  async handlePaymentFailed(payment: Payment): Promise<void> {
    if (payment.targetType !== PaymentTargetType.BOOKING) {
      return;
    }

    this.logger.log(`Payment failed for booking ${payment.targetId}`);

    try {
      await this.bookingRepository.update(payment.targetId, {
        paymentId: payment.id,
        paymentStatus: EntityPaymentStatus.FAILED,
      });
    } catch (error) {
      this.logger.error(
        `Error handling payment failed for booking ${payment.targetId}`,
        error
      );
    }
  }

  /**
   * Обработка события возврата платежа
   */
  @OnEvent(PaymentEvent.REFUNDED)
  async handlePaymentRefunded(payment: Payment): Promise<void> {
    if (payment.targetType !== PaymentTargetType.BOOKING) {
      return;
    }

    this.logger.log(`Payment refunded for booking ${payment.targetId}`);

    try {
      await this.bookingRepository.update(payment.targetId, {
        paymentStatus: payment.isFullyRefunded
          ? EntityPaymentStatus.REFUNDED
          : EntityPaymentStatus.PARTIALLY_REFUNDED,
      });
    } catch (error) {
      this.logger.error(
        `Error handling payment refunded for booking ${payment.targetId}`,
        error
      );
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

  /**
   * Получить бронирования для напоминаний
   * Используется планировщиком напоминаний
   */
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
      relations: ["specialist", "service", "timeSlot", "specialist.bookingSystem"],
    });
  }

  /**
   * Создать бронирование для системы бронирования (публичный метод)
   */
  async createByBookingSystem(
    bookingSystemId: string,
    createBookingDto: CreateBookingDto
  ): Promise<Booking> {
    // Проверяем, что все связанные сущности существуют и принадлежат системе бронирования
    const specialist = await this.specialistRepository.findOne({
      where: { id: createBookingDto.specialistId, bookingSystemId },
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
    const bookingSystem = await this.bookingSystemRepository.findOne({
      where: { id: bookingSystemId },
    });
    if (bookingSystem?.settings?.requireConfirmation) {
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
      }
    }

    // Отправляем уведомление владельцу системы бронирования
    if (bookingSystem && bookingSystem.ownerId) {
      const fullBooking = await this.bookingRepository.findOne({
        where: { id: savedBooking.id },
        relations: ["specialist", "service", "timeSlot"],
      });

      if (fullBooking) {
        this.notificationService
          .sendToUser(bookingSystem.ownerId, NotificationType.BOOKING_CREATED, {
            bookingSystemId: bookingSystem.id,
            bookingSystemName: bookingSystem.name,
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
      this.activityLogService
        .create({
          type: ActivityType.BOOKING_CREATED,
          level: ActivityLevel.SUCCESS,
          message: `Создано бронирование от ${savedBooking.clientName || "неизвестно"}`,
          userId: bookingSystem.ownerId,
          metadata: {
            bookingId: savedBooking.id,
            clientName: savedBooking.clientName,
            clientPhone: savedBooking.clientPhone,
            specialistId: savedBooking.specialistId,
            serviceId: savedBooking.serviceId,
            timeSlotId: savedBooking.timeSlotId,
            status: savedBooking.status,
            bookingSystemId,
          },
        })
        .catch((error) => {
          console.error("Ошибка логирования создания бронирования:", error);
        });
    }

    return savedBooking;
  }

  /**
   * Получить все бронирования системы бронирования
   */
  async findAllByBookingSystem(
    bookingSystemId: string,
    userId: string
  ): Promise<Booking[]> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);

    return this.bookingRepository.find({
      where: {
        specialist: { bookingSystemId },
      },
      relations: ["specialist", "service", "timeSlot"],
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Получить бронирование по ID для системы бронирования
   */
  async findOneByBookingSystem(
    id: string,
    bookingSystemId: string,
    userId: string
  ): Promise<Booking> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);

    const booking = await this.bookingRepository.findOne({
      where: {
        id,
        specialist: { bookingSystemId },
      },
      relations: ["specialist", "service", "timeSlot"],
    });

    if (!booking) {
      throw new NotFoundException("Бронирование не найдено");
    }

    return booking;
  }

  /**
   * Обновить бронирование для системы бронирования
   */
  async updateByBookingSystem(
    id: string,
    bookingSystemId: string,
    userId: string,
    updateBookingDto: UpdateBookingDto
  ): Promise<Booking> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);
    const booking = await this.findOneByBookingSystem(id, bookingSystemId, userId);

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

    // Логируем обновление бронирования
    this.activityLogService
      .create({
        type: ActivityType.BOOKING_UPDATED,
        level: ActivityLevel.INFO,
        message: `Обновлено бронирование #${updatedBooking.id} от ${updatedBooking.clientName || "неизвестно"}`,
        userId,
        metadata: {
          bookingId: updatedBooking.id,
          clientName: updatedBooking.clientName,
          changes: updateBookingDto,
          bookingSystemId,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования обновления бронирования:", error);
      });

    return updatedBooking;
  }

  /**
   * Подтвердить бронирование для системы бронирования (публичный)
   */
  async confirmByBookingSystem(
    bookingSystemId: string,
    id: string,
    confirmBookingDto: ConfirmBookingDto
  ): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: {
        id,
        specialist: { bookingSystemId },
      },
      relations: ["specialist"],
    });

    if (!booking) {
      throw new NotFoundException("Бронирование не найдено");
    }

    if (!booking.canBeConfirmed) {
      throw new BadRequestException("Бронирование не может быть подтверждено");
    }

    if (booking.confirmationCode !== confirmBookingDto.confirmationCode) {
      throw new BadRequestException("Неверный код подтверждения");
    }

    booking.confirm();

    const savedBooking = await this.bookingRepository.save(booking);

    // Логируем подтверждение бронирования
    const bookingSystem = await this.bookingSystemRepository.findOne({
      where: { id: bookingSystemId },
    });
    if (bookingSystem && bookingSystem.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.BOOKING_CONFIRMED,
          level: ActivityLevel.SUCCESS,
          message: `Подтверждено бронирование #${savedBooking.id} от ${savedBooking.clientName || "неизвестно"}`,
          userId: bookingSystem.ownerId,
          metadata: {
            bookingId: savedBooking.id,
            clientName: savedBooking.clientName,
            clientPhone: savedBooking.clientPhone,
            bookingSystemId,
          },
        })
        .catch((error) => {
          console.error("Ошибка логирования подтверждения бронирования:", error);
        });
    }

    return savedBooking;
  }

  /**
   * Отменить бронирование для системы бронирования
   */
  async cancelByBookingSystem(
    id: string,
    bookingSystemId: string,
    userId: string,
    cancelBookingDto: CancelBookingDto
  ): Promise<Booking> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);
    const booking = await this.findOneByBookingSystem(id, bookingSystemId, userId);

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
    }

    // Отправляем уведомление об отмене
    if (cancelBookingDto.cancellationReason && booking.telegramUserId) {
      try {
        await this.notificationsService.sendCancellationNotification(
          booking.id,
          cancelBookingDto.cancellationReason
        );
      } catch (error) {
        console.error("Failed to send cancellation notification:", error);
      }
    }

    // Логируем отмену бронирования
    this.activityLogService
      .create({
        type: ActivityType.BOOKING_CANCELLED,
        level: ActivityLevel.WARNING,
        message: `Отменено бронирование #${savedBooking.id} от ${savedBooking.clientName || "неизвестно"}`,
        userId,
        metadata: {
          bookingId: savedBooking.id,
          clientName: savedBooking.clientName,
          cancellationReason: cancelBookingDto.cancellationReason,
          bookingSystemId,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования отмены бронирования:", error);
      });

    return savedBooking;
  }

  /**
   * Завершить бронирование для системы бронирования
   */
  async markAsCompletedByBookingSystem(
    id: string,
    bookingSystemId: string,
    userId: string
  ): Promise<Booking> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);
    const booking = await this.findOneByBookingSystem(id, bookingSystemId, userId);

    booking.markAsCompleted();

    const savedBooking = await this.bookingRepository.save(booking);

    // Логируем завершение бронирования
    this.activityLogService
      .create({
        type: ActivityType.BOOKING_COMPLETED,
        level: ActivityLevel.SUCCESS,
        message: `Завершено бронирование #${savedBooking.id} от ${savedBooking.clientName || "неизвестно"}`,
        userId,
        metadata: {
          bookingId: savedBooking.id,
          clientName: savedBooking.clientName,
          bookingSystemId,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования завершения бронирования:", error);
      });

    return savedBooking;
  }

  /**
   * Получить статистику для системы бронирования
   */
  async getStatisticsByBookingSystem(
    bookingSystemId: string,
    userId: string
  ): Promise<any> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);

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
      .where("specialist.bookingSystemId = :bookingSystemId", { bookingSystemId })
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
