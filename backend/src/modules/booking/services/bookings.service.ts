import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, MoreThan } from "typeorm";
import {
  Booking,
  BookingStatus,
  BookingSource,
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
    private botRepository: Repository<Bot>
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

    const service = await this.serviceRepository.findOne({
      where: {
        id: createBookingDto.serviceId,
        specialistId: createBookingDto.specialistId,
      },
    });

    if (!service) {
      throw new NotFoundException("Услуга не найдена");
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

    // Освобождаем слот
    const timeSlot = await this.timeSlotRepository.findOne({
      where: { id: booking.timeSlotId },
    });

    if (timeSlot) {
      timeSlot.isBooked = false;
      await this.timeSlotRepository.save(timeSlot);
    }

    return this.bookingRepository.save(booking);
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

    // Освобождаем слот
    const timeSlot = await this.timeSlotRepository.findOne({
      where: { id: booking.timeSlotId },
    });

    if (timeSlot) {
      timeSlot.isBooked = false;
      await this.timeSlotRepository.save(timeSlot);
    }

    await this.bookingRepository.remove(booking);
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
      relations: ["specialist", "service", "timeSlot", "specialist.bot"],
    });
  }

  async getStatistics(botId: string): Promise<any> {
    const totalBookings = await this.bookingRepository.count({
      where: { specialist: { botId } },
    });

    const confirmedBookings = await this.bookingRepository.count({
      where: {
        specialist: { botId },
        status: BookingStatus.CONFIRMED,
      },
    });

    const completedBookings = await this.bookingRepository.count({
      where: {
        specialist: { botId },
        status: BookingStatus.COMPLETED,
      },
    });

    const cancelledBookings = await this.bookingRepository.count({
      where: {
        specialist: { botId },
        status: BookingStatus.CANCELLED,
      },
    });

    const noShowBookings = await this.bookingRepository.count({
      where: {
        specialist: { botId },
        status: BookingStatus.NO_SHOW,
      },
    });

    return {
      total: totalBookings,
      confirmed: confirmedBookings,
      completed: completedBookings,
      cancelled: cancelledBookings,
      noShow: noShowBookings,
      confirmationRate:
        totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0,
      completionRate:
        confirmedBookings > 0
          ? (completedBookings / confirmedBookings) * 100
          : 0,
      cancellationRate:
        totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0,
      noShowRate:
        confirmedBookings > 0 ? (noShowBookings / confirmedBookings) * 100 : 0,
    };
  }
}
