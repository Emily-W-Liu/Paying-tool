import type { Product } from "./order-types";

export const products: Product[] = [
  {
    id: "ticket",
    name: "活动入场券",
    description: "单人入场凭证，现场核对订单姓名。",
    price: 68,
    stock: 45,
    stockLocations: {},
    accent: "bg-[#f66f4d]",
    imageUrl: "",
    isActive: true,
  },
  {
    id: "bag",
    name: "限定帆布袋",
    description: "活动限定周边，到场凭已支付订单领取。",
    price: 39,
    stock: 18,
    stockLocations: {},
    accent: "bg-[#3b82f6]",
    imageUrl: "",
    isActive: true,
  },
  {
    id: "badge",
    name: "纪念徽章套组",
    description: "三枚一组，库存有限，售完即止。",
    price: 26,
    stock: 0,
    stockLocations: {},
    accent: "bg-[#16a34a]",
    imageUrl: "",
    isActive: true,
  },
];
