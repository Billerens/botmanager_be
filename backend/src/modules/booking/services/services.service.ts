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
    @InjectRepository(BookingSystem)
    private bookingSystemRepository: Repository<BookingSystem>,
    private activityLogService: ActivityLogService
  ) {}

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
