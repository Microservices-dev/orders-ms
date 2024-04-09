import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { ChangeOrderStatusDto, OrderPaginationDto } from './dto';
import { PRODUCT_SERVICE } from 'src/config';
import { catchError } from 'rxjs';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(PRODUCT_SERVICE) private readonly productsClient: ClientProxy,
  ) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the database');
  }
  async create(createOrderDto: CreateOrderDto) {
    const ids = createOrderDto.items.map((item) => item.productId);
    console.log(ids);
    const products = await this.productsClient
      .send({ cmd: 'validate_products' }, { ids })
      .pipe(
        catchError((err) => {
          throw new RpcException(err);
        }),
      );
    return products;
    // return await this.order.create({
    //   data: createOrderDto,
    // });
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

  async changeStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;

    const order = await this.findOne(id);
    if (order.status === status) {
      return order;
    }

    return this.order.update({
      where: { id },
      data: { status: status },
    });
  }
}
