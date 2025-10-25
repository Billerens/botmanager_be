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
    return this.serviceRepository.find({
      where: {
        specialist: { botId },
        isActive: true,
      },
      relations: ["specialist"],
      order: { name: "ASC" },
    });
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

    return this.serviceRepository.find({
      where: {
        specialistId,
        isActive: true,
      },
      relations: ["specialist"],
      order: { name: "ASC" },
    });
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

    let query = this.timeSlotRepository
      .createQueryBuilder("timeSlot")
      .leftJoin("timeSlot.specialist", "specialist")
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

    // Фильтр по услуге (проверяем длительность)
    if (serviceId) {
      const service = await this.serviceRepository.findOne({
        where: { id: serviceId, specialistId },
      });

      if (service) {
        query = query.andWhere(
          "EXTRACT(EPOCH FROM (timeSlot.endTime - timeSlot.startTime)) >= :duration",
          {
            duration: service.duration * 60, // конвертируем минуты в секунды
          }
        );
      }
    }

    return query.getMany();
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
      source: BookingSource.MINI_APP,
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
