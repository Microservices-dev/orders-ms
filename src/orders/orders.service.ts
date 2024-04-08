import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaClient } from '@prisma/client';
import { RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);
  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the database');
  }
  create(createOrderDto: CreateOrderDto) {
    return this.order.create({
      data: createOrderDto,
    });
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const { limit, page, status } = orderPaginationDto;
    const totalPages = await this.order.count({
      where: {
        status,
      },
    });
    const lastPage = Math.ceil(totalPages / limit);
    const data = await this.order.findMany({
      take: limit,
      skip: (page - 1) * limit,
      where: {
        status,
      },
    });
    return {
      data: data,
      meta: {
        page,
        limit,
        lastPage,
        total: totalPages,
      },
    };
  }

  async findOne(id: string) {
    const order = await this.order.findUnique({
      where: {
        id,
      },
    });
    if (!order) {
      throw new RpcException({
        message: `order with id ${id} not exists`,
        status: HttpStatus.NOT_FOUND,
      });
    }
    return order;
  }
}
