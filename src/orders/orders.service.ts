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
import { ChangeOrderStatusDto, OrderPaginationDto, PaidOrderDto } from './dto';
import { NATS_SERVICE } from 'src/config';
import { firstValueFrom } from 'rxjs';
import { OrderWithProducts } from './interfaces/order-with-products.interface';
export interface Iproduct {
  id: number;
  name: string;
  price: number;
}

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(@Inject(NATS_SERVICE) private readonly natsClient: ClientProxy) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the database');
  }
  private async getProducts(ids): Promise<Iproduct[]> {
    try {
      const products = await firstValueFrom(
        this.natsClient.send({ cmd: 'validate_products' }, { ids }),
      );
      return products;
    } catch (error) {
      throw new RpcException(error);
    }
  }
  async create(createOrderDto: CreateOrderDto) {
    const ids = createOrderDto.items.map((item) => item.productId);
    try {
      const products = await this.getProducts(ids);
      const totalAmount = createOrderDto.items.reduce((_acc, orderItem) => {
        const item = products.find((r) => r.id === orderItem.productId);
        return _acc + item.price * orderItem.quantity;
      }, 0);

      const totalItems = createOrderDto.items.reduce((_acc, orderItem) => {
        return orderItem.quantity + _acc;
      }, 0);

      const ordersItemsData = createOrderDto.items.map((orderItem) => {
        const { price } = products.find((r) => r.id === orderItem.productId);
        const quantity = orderItem.quantity;
        const productId = orderItem.productId;
        return {
          price,
          quantity,
          productId,
        };
      });
      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItem: {
            createMany: {
              data: [...ordersItemsData],
            },
          },
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true,
            },
          },
        },
      });
      return {
        ...order,
        OrderItem: order.OrderItem.map((item) => {
          return {
            ...item,
            name: products.find((r) => r.id === item.productId).name,
          };
        }),
      };
    } catch (error) {
      throw new RpcException(error);
    }
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
      include: {
        OrderItem: {
          select: {
            price: true,
            quantity: true,
            productId: true,
          },
        },
      },
    });
    if (!order) {
      throw new RpcException({
        message: `order with id ${id} not exists`,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const ids = order.OrderItem.map((item) => item.productId);
    const products = await this.getProducts(ids);

    return {
      ...order,
      OrderItem: order.OrderItem.map((item) => {
        return {
          ...item,
          name: products.find((r) => r.id === item.productId).name,
        };
      }),
    };
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

  async createPaymentSession(order: OrderWithProducts) {
    try {
      const paymentSession = await firstValueFrom(
        this.natsClient.send(
          { cmd: 'create-session-payment' },
          {
            orderId: order.id,
            currency: 'mxn',
            items: order.OrderItem.map((item) => {
              return {
                price: item.price,
                quantity: item.quantity,
                name: item.name,
              };
            }),
          },
        ),
      );
      return paymentSession;
    } catch (error) {
      console.log(error);
      throw new RpcException(error);
    }
  }

  async paidOrder(paidOrderDto: PaidOrderDto) {
    const order = await this.order.update({
      where: { id: paidOrderDto.orderId },
      data: {
        status: 'PAID',
        paid: true,
        paidAt: new Date(),
        stripeChargedId: paidOrderDto.stripePaymentId,
        //RALCION CON LA TABLA
        OrderReceipt: {
          create: {
            receiptUrl: paidOrderDto.receiptUrl,
          },
        },
      },
    });
    return order;
  }
}
