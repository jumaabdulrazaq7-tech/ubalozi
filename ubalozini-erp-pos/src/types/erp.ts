export type UserRole = "admin" | "sales_person";
export type BranchStatus = "active" | "inactive";
export type ProductCategory = "Phones" | "Accessories" | "Spare Parts";
export type ImeiStatus = "In Stock" | "Sold" | "Reserved" | "Returned";
export type PaymentMethod = "Cash" | "Bank Transfer" | "Mobile Money";

export type Branch = {
  id: string;
  name: string;
  location: string;
  code: string;
  status: BranchStatus;
  salesToday: number;
  inventoryValue: number;
  lowStockItems: number;
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: ProductCategory;
  barcode: string;
  qrCode: string;
  description: string;
  imageUrl?: string;
  stock: number;
  lowStockThreshold: number;
};

export type ImeiDevice = {
  id: string;
  productId: string;
  productName: string;
  imeiNumber: string;
  serialNumber: string;
  purchasePriceAed: number;
  exchangeRate: number;
  purchasePriceTzs: number;
  sellingPriceTzs: number;
  profitTzs: number;
  branch: string;
  supplier: string;
  warrantyMonths: number;
  status: ImeiStatus;
  history: string[];
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  outstandingBalance: number;
};
