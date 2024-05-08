import { OrderStatus } from '@prisma/client';

export const OrderStatusList = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PAID,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];
