import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Service } from "../../../database/entities/service.entity";
import { Specialist } from "../../../database/entities/specialist.entity";
import { Bot } from "../../../database/entities/bot.entity";
import { BookingSystem } from "../../../database/entities/booking-system.entity";
import { CreateServiceDto, UpdateServiceDto } from "../dto/booking.dto";
import { BookingStatus } from "../../../database/entities/booking.entity";
import { ActivityLogService } from "../../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../../database/entities/activity-log.entity";

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(Specialist)
    private specialistRepository: Repository<Specialist>,
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    @InjectRepository(BookingSystem)
    private bookingSystemRepository: Repository<BookingSystem>,
    private activityLogService: ActivityLogService
  ) {}

  async create(
    createServiceDto: CreateServiceDto,
    botId: string
  ): Promise<Service> {
    // Проверяем, что все специалисты существуют и принадлежат боту
    const specialists = await this.specialistRepository.findBy({
      id: In(createServiceDto.specialistIds),
      botId,
    });

    if (specialists.length !== createServiceDto.specialistIds.length) {
      throw new NotFoundException("Один или несколько специалистов не найдены");
    }

    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    const { specialistIds, ...serviceData } = createServiceDto;
    const service = this.serviceRepository.create({
      ...serviceData,
      specialists,
    });
    const savedService = await this.serviceRepository.save(service);

    // Логируем создание услуги
    if (bot.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.SERVICE_CREATED,
          level: ActivityLevel.SUCCESS,
          message: `Создана услуга "${savedService.name}"`,
          userId: bot.ownerId,
          botId,
          metadata: {
            serviceId: savedService.id,
            serviceName: savedService.name,
            duration: savedService.duration,
            price: savedService.price,
          },
        })
        .catch((error) => {
          console.error("Ошибка логирования создания услуги:", error);
        });
    }

    return savedService;
  }

  async findAll(botId: string): Promise<Service[]> {
    return this.serviceRepository
      .createQueryBuilder("service")
      .leftJoinAndSelect("service.specialists", "specialist")
      .where("specialist.botId = :botId", { botId })
      .andWhere("service.isActive = :isActive", { isActive: true })
      .orderBy("service.name", "ASC")
      .getMany();
  }

  async findBySpecialist(
    specialistId: string,
    botId: string
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
      .leftJoinAndSelect("service.specialists", "specialist")
      .where("specialist.id = :specialistId", { specialistId })
      .andWhere("service.isActive = :isActive", { isActive: true })
      .orderBy("service.name", "ASC")
      .getMany();
  }

  async findOne(id: string, botId: string): Promise<Service> {
    const service = await this.serviceRepository
      .createQueryBuilder("service")
      .leftJoinAndSelect("service.specialists", "specialist")
      .leftJoinAndSelect("service.bookings", "bookings")
      .where("service.id = :id", { id })
      .andWhere("specialist.botId = :botId", { botId })
      .getOne();

    if (!service) {
      throw new NotFoundException("Услуга не найдена");
    }

    return service;
  }

  async update(
    id: string,
    updateServiceDto: UpdateServiceDto,
    botId: string
  ): Promise<Service> {
    const service = await this.findOne(id, botId);
    const bot = await this.botRepository.findOne({ where: { id: botId } });

    // Если обновляются специалисты, проверяем их существование
    if (updateServiceDto.specialistIds) {
      const specialists = await this.specialistRepository.findBy({
        id: In(updateServiceDto.specialistIds),
        botId,
      });

      if (specialists.length !== updateServiceDto.specialistIds.length) {
        throw new NotFoundException(
          "Один или несколько специалистов не найдены"
        );
      }

      service.specialists = specialists;
    }

    const { specialistIds, ...serviceData } = updateServiceDto;
    Object.assign(service, serviceData);

    const updatedService = await this.serviceRepository.save(service);

    // Логируем обновление услуги
    if (bot && bot.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.SERVICE_UPDATED,
          level: ActivityLevel.SUCCESS,
          message: `Обновлена услуга "${updatedService.name}"`,
          userId: bot.ownerId,
          botId,
          metadata: {
            serviceId: updatedService.id,
            serviceName: updatedService.name,
          },
        })
        .catch((error) => {
          console.error("Ошибка логирования обновления услуги:", error);
        });
    }

    return updatedService;
  }

  async remove(id: string, botId: string): Promise<void> {
    const service = await this.findOne(id, botId);
    const bot = await this.botRepository.findOne({ where: { id: botId } });

    // Проверяем, есть ли активные бронирования
    const activeBookings = await this.serviceRepository
      .createQueryBuilder("service")
      .leftJoin("service.bookings", "booking")
      .where("service.id = :id", { id })
      .andWhere("booking.status IN (:...statuses)", {
        statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      })
      .getCount();

    if (activeBookings > 0) {
      throw new BadRequestException(
        "Нельзя удалить услугу с активными бронированиями"
      );
    }

    const serviceName = service.name;
    await this.serviceRepository.remove(service);

    // Логируем удаление услуги
    if (bot && bot.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.SERVICE_DELETED,
          level: ActivityLevel.SUCCESS,
          message: `Удалена услуга "${serviceName}"`,
          userId: bot.ownerId,
          botId,
          metadata: {
            serviceId: id,
            serviceName,
          },
        })
        .catch((error) => {
          console.error("Ошибка логирования удаления услуги:", error);
        });
    }
  }

  async getServicesByCategory(
    botId: string,
    category?: string
  ): Promise<Service[]> {
    const query = this.serviceRepository
      .createQueryBuilder("service")
      .leftJoinAndSelect("service.specialists", "specialist")
      .where("specialist.botId = :botId", { botId })
      .andWhere("service.isActive = :isActive", { isActive: true });

    if (category) {
      query.andWhere("service.category = :category", { category });
    }

    return query.orderBy("service.name", "ASC").getMany();
  }

  async getPopularServices(
    botId: string,
    limit: number = 10
  ): Promise<Service[]> {
    return this.serviceRepository
      .createQueryBuilder("service")
      .leftJoinAndSelect("service.specialists", "specialist")
      .leftJoin("service.bookings", "booking")
      .where("specialist.botId = :botId", { botId })
      .andWhere("service.isActive = :isActive", { isActive: true })
      .groupBy("service.id")
      .addGroupBy("specialist.id")
      .orderBy("COUNT(booking.id)", "DESC")
      .limit(limit)
      .getMany();
  }

  // ============================================
  // Методы для работы через BookingSystem
  // ============================================

  /**
   * Создать услугу для системы бронирования
   */
  async createByBookingSystem(
    bookingSystemId: string,
    userId: string,
    createServiceDto: CreateServiceDto
  ): Promise<Service> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);

    // Проверяем, что все специалисты принадлежат этой системе бронирования
    const specialists = await this.specialistRepository.findBy({
      id: In(createServiceDto.specialistIds),
      bookingSystemId,
    });

    if (specialists.length !== createServiceDto.specialistIds.length) {
      throw new NotFoundException("Один или несколько специалистов не найдены");
    }

    const bookingSystem = await this.bookingSystemRepository.findOne({
      where: { id: bookingSystemId },
    });

    const { specialistIds, ...serviceData } = createServiceDto;
    const service = this.serviceRepository.create({
      ...serviceData,
      specialists,
    });
    const savedService = await this.serviceRepository.save(service);

    // Логируем создание услуги
    this.activityLogService
      .create({
        type: ActivityType.SERVICE_CREATED,
        level: ActivityLevel.SUCCESS,
        message: `Создана услуга "${savedService.name}"`,
        userId,
        metadata: {
          serviceId: savedService.id,
          serviceName: savedService.name,
          duration: savedService.duration,
          price: savedService.price,
          bookingSystemId,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования создания услуги:", error);
      });

    return savedService;
  }

  /**
   * Получить все услуги системы бронирования
   */
  async findAllByBookingSystem(
    bookingSystemId: string,
    userId: string
  ): Promise<Service[]> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);

    return this.serviceRepository
      .createQueryBuilder("service")
      .leftJoinAndSelect("service.specialists", "specialist")
      .where("specialist.bookingSystemId = :bookingSystemId", {
        bookingSystemId,
      })
      .andWhere("service.isActive = :isActive", { isActive: true })
      .orderBy("service.name", "ASC")
      .getMany();
  }

  /**
   * Получить услугу по ID для системы бронирования
   */
  async findOneByBookingSystem(
    id: string,
    bookingSystemId: string,
    userId: string
  ): Promise<Service> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);

    const service = await this.serviceRepository
      .createQueryBuilder("service")
      .leftJoinAndSelect("service.specialists", "specialist")
      .leftJoinAndSelect("service.bookings", "bookings")
      .where("service.id = :id", { id })
      .andWhere("specialist.bookingSystemId = :bookingSystemId", {
        bookingSystemId,
      })
      .getOne();

    if (!service) {
      throw new NotFoundException("Услуга не найдена");
    }

    return service;
  }

  /**
   * Обновить услугу для системы бронирования
   */
  async updateByBookingSystem(
    id: string,
    bookingSystemId: string,
    userId: string,
    updateServiceDto: UpdateServiceDto
  ): Promise<Service> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);
    const service = await this.findOneByBookingSystem(
      id,
      bookingSystemId,
      userId
    );

    // Если обновляются специалисты, проверяем их существование
    if (updateServiceDto.specialistIds) {
      const specialists = await this.specialistRepository.findBy({
        id: In(updateServiceDto.specialistIds),
        bookingSystemId,
      });

      if (specialists.length !== updateServiceDto.specialistIds.length) {
        throw new NotFoundException(
          "Один или несколько специалистов не найдены"
        );
      }

      service.specialists = specialists;
    }

    const { specialistIds, ...serviceData } = updateServiceDto;
    Object.assign(service, serviceData);

    const updatedService = await this.serviceRepository.save(service);

    // Логируем обновление услуги
    this.activityLogService
      .create({
        type: ActivityType.SERVICE_UPDATED,
        level: ActivityLevel.SUCCESS,
        message: `Обновлена услуга "${updatedService.name}"`,
        userId,
        metadata: {
          serviceId: updatedService.id,
          serviceName: updatedService.name,
          bookingSystemId,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования обновления услуги:", error);
      });

    return updatedService;
  }

  /**
   * Удалить услугу для системы бронирования
   */
  async removeByBookingSystem(
    id: string,
    bookingSystemId: string,
    userId: string
  ): Promise<void> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);
    const service = await this.findOneByBookingSystem(
      id,
      bookingSystemId,
      userId
    );

    // Проверяем, есть ли активные бронирования
    const activeBookings = await this.serviceRepository
      .createQueryBuilder("service")
      .leftJoin("service.bookings", "booking")
      .where("service.id = :id", { id })
      .andWhere("booking.status IN (:...statuses)", {
        statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      })
      .getCount();

    if (activeBookings > 0) {
      throw new BadRequestException(
        "Нельзя удалить услугу с активными бронированиями"
      );
    }

    const serviceName = service.name;
    await this.serviceRepository.remove(service);

    // Логируем удаление услуги
    this.activityLogService
      .create({
        type: ActivityType.SERVICE_DELETED,
        level: ActivityLevel.SUCCESS,
        message: `Удалена услуга "${serviceName}"`,
        userId,
        metadata: {
          serviceId: id,
          serviceName,
          bookingSystemId,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования удаления услуги:", error);
      });
  }

  /**
   * Получить услуги по специалисту для системы бронирования
   */
  async findBySpecialistByBookingSystem(
    specialistId: string,
    bookingSystemId: string,
    userId: string
  ): Promise<Service[]> {
    await this.validateBookingSystemOwnership(bookingSystemId, userId);

    // Проверяем, что специалист принадлежит системе бронирования
    const specialist = await this.specialistRepository.findOne({
      where: { id: specialistId, bookingSystemId },
    });

    if (!specialist) {
      throw new NotFoundException("Специалист не найден");
    }

    return this.serviceRepository
      .createQueryBuilder("service")
      .leftJoinAndSelect("service.specialists", "specialist")
      .where("specialist.id = :specialistId", { specialistId })
      .andWhere("service.isActive = :isActive", { isActive: true })
      .orderBy("service.name", "ASC")
      .getMany();
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
