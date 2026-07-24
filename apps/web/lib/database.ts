export interface User {
  id: string
  email: string
  password: string
  name: string
  role: "student" | "teacher" | "admin"
  career?: string
  platformAdmin?: boolean
  adminCareers?: string[]
  createdAt: Date
}

export interface Product {
  id: string
  name: string
  description: string
  price: number
  category: string
  career: string
  stock: number
  image: string
  createdAt: Date
}

export interface CartItem {
  id: string
  userId: string
  productId: string
  quantity: number
  addedAt: Date
}

export interface Order {
  id: string
  userId: string
  items: Array<{
    productId: string
    quantity: number
    price: number
  }>
  total: number
  status: "pending" | "confirmed" | "shipped" | "delivered"
  createdAt: Date
}

// Simulación de colecciones NoSQL
class NoSQLDatabase {
  private users: User[] = []
  private products: Product[] = []
  private cartItems: CartItem[] = []
  private orders: Order[] = []

  constructor() {
    this.initializeData()
  }

  private initializeData() {
    // Usuarios iniciales
    this.users = [
      {
        id: "1",
        email: "admin@ucb.edu.bo",
        password: "admin123",
        name: "Administrador UCB",
        role: "admin",
        createdAt: new Date(),
      },
      {
        id: "2",
        email: "estudiante@ucb.edu.bo",
        password: "student123",
        name: "Juan Pérez",
        role: "student",
        career: "Ingeniería de Sistemas",
        createdAt: new Date(),
      },
    ]

    // Productos iniciales por carrera
    this.products = [
      // Ingeniería de Sistemas
      {
        id: "1",
        name: "Laptop Dell Inspiron 15",
        description: "Laptop ideal para programación y desarrollo de software",
        price: 4500,
        category: "Tecnología",
        career: "Ingeniería de Sistemas",
        stock: 10,
        image: "/laptop-dell-programming.jpg",
        createdAt: new Date(),
      },
      {
        id: "2",
        name: "Libro: Algoritmos y Estructuras de Datos",
        description: "Libro fundamental para estudiantes de programación",
        price: 280,
        category: "Libros",
        career: "Ingeniería de Sistemas",
        stock: 25,
        image: "/programming-algorithms-book.jpg",
        createdAt: new Date(),
      },
      {
        id: "3",
        name: "Kit de Desarrollo Arduino",
        description: "Kit completo para proyectos de electrónica y programación",
        price: 350,
        category: "Electrónica",
        career: "Ingeniería de Sistemas",
        stock: 15,
        image: "/arduino-development-kit.jpg",
        createdAt: new Date(),
      },
      // Psicopedagogía
      {
        id: "4",
        name: "Manual de Psicología Educativa",
        description: "Guía completa para profesionales en psicopedagogía",
        price: 320,
        category: "Libros",
        career: "Psicopedagogía",
        stock: 20,
        image: "/educational-psychology-manual.jpg",
        createdAt: new Date(),
      },
      {
        id: "5",
        name: "Kit de Evaluación Psicopedagógica",
        description: "Herramientas profesionales para evaluación educativa",
        price: 850,
        category: "Material Educativo",
        career: "Psicopedagogía",
        stock: 8,
        image: "/educational-assessment-tools.jpg",
        createdAt: new Date(),
      },
      // Mecatrónica
      {
        id: "6",
        name: "Kit de Sensores Industriales",
        description: "Conjunto de sensores para proyectos de mecatrónica",
        price: 680,
        category: "Electrónica",
        career: "Mecatrónica",
        stock: 12,
        image: "/industrial-sensors-kit.jpg",
        createdAt: new Date(),
      },
      {
        id: "7",
        name: "Motor Servo de Precisión",
        description: "Motor servo de alta precisión para proyectos robóticos",
        price: 450,
        category: "Componentes",
        career: "Mecatrónica",
        stock: 18,
        image: "/precision-servo-motor.jpg",
        createdAt: new Date(),
      },
    ]
  }

  // Métodos para Users
  async findUser(email: string, password?: string): Promise<User | null> {
    return this.users.find((user) => user.email === email && (!password || user.password === password)) || null
  }

  async createUser(userData: Omit<User, "id" | "createdAt">): Promise<User> {
    const newUser: User = {
      ...userData,
      id: Date.now().toString(),
      createdAt: new Date(),
    }
    this.users.push(newUser)
    return newUser
  }

  async getAllUsers(): Promise<User[]> {
    return this.users
  }

  // Métodos para Products
  async getProducts(career?: string): Promise<Product[]> {
    if (career) {
      return this.products.filter((product) => product.career === career)
    }
    return this.products
  }

  async getProduct(id: string): Promise<Product | null> {
    return this.products.find((product) => product.id === id) || null
  }

  async createProduct(productData: Omit<Product, "id" | "createdAt">): Promise<Product> {
    const newProduct: Product = {
      ...productData,
      id: Date.now().toString(),
      createdAt: new Date(),
    }
    this.products.push(newProduct)
    return newProduct
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
    const index = this.products.findIndex((product) => product.id === id)
    if (index === -1) return null

    this.products[index] = { ...this.products[index], ...updates }
    return this.products[index]
  }

  async deleteProduct(id: string): Promise<boolean> {
    const index = this.products.findIndex((product) => product.id === id)
    if (index === -1) return false

    this.products.splice(index, 1)
    return true
  }

  // Métodos para Cart
  async getCartItems(userId: string): Promise<CartItem[]> {
    return this.cartItems.filter((item) => item.userId === userId)
  }

  async addToCart(userId: string, productId: string, quantity = 1): Promise<CartItem> {
    const existingItem = this.cartItems.find((item) => item.userId === userId && item.productId === productId)

    if (existingItem) {
      existingItem.quantity += quantity
      return existingItem
    }

    const newItem: CartItem = {
      id: Date.now().toString(),
      userId,
      productId,
      quantity,
      addedAt: new Date(),
    }
    this.cartItems.push(newItem)
    return newItem
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | null> {
    const item = this.cartItems.find((item) => item.id === id)
    if (!item) return null

    item.quantity = quantity
    return item
  }

  async removeFromCart(id: string): Promise<boolean> {
    const index = this.cartItems.findIndex((item) => item.id === id)
    if (index === -1) return false

    this.cartItems.splice(index, 1)
    return true
  }

  // Métodos para Orders
  async createOrder(orderData: Omit<Order, "id" | "createdAt">): Promise<Order> {
    const newOrder: Order = {
      ...orderData,
      id: Date.now().toString(),
      createdAt: new Date(),
    }
    this.orders.push(newOrder)
    return newOrder
  }

  async getOrders(userId?: string): Promise<Order[]> {
    if (userId) {
      return this.orders.filter((order) => order.userId === userId)
    }
    return this.orders
  }

  async updateOrderStatus(id: string, status: Order["status"]): Promise<Order | null> {
    const order = this.orders.find((order) => order.id === id)
    if (!order) return null

    order.status = status
    return order
  }

  // Método para obtener carreras disponibles
  getCareers(): string[] {
    return ["Ingeniería de Sistemas", "Psicopedagogía", "Mecatrónica"]
  }
}

// Instancia singleton de la base de datos
export const db = new NoSQLDatabase()

export class DatabaseService {
  // User management methods
  static async getAllUsers() {
    const users = await db.getAllUsers()
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      career: user.career,
      registrationDate: user.createdAt.toISOString(),
      status: "active" as const,
      lastLogin: user.createdAt.toISOString(),
    }))
  }

  static createUser(userData: {
    name: string
    email: string
    password: string
    role: "student" | "teacher" | "admin"
    career?: string
  }) {
    return db.createUser(userData).then((user) => user.id)
  }

  static updateUser(userId: string, updates: any) {
    const userIndex = db["users"].findIndex((u: User) => u.id === userId)
    if (userIndex !== -1) {
      db["users"][userIndex] = { ...db["users"][userIndex], ...updates }
      return true
    }
    return false
  }

  static deleteUser(userId: string) {
    const userIndex = db["users"].findIndex((u: User) => u.id === userId)
    if (userIndex !== -1) {
      db["users"].splice(userIndex, 1)
      return true
    }
    return false
  }

  // Order management methods
  static async getAllOrders() {
    const orders = await db.getOrders()
    return orders.map((order) => {
      const user = db["users"].find((u: User) => u.id === order.userId)
      return {
        id: order.id,
        userId: order.userId,
        userName: user?.name || "Usuario desconocido",
        userEmail: user?.email || "email@desconocido.com",
        items: order.items.map((item) => {
          const product = db["products"].find((p: Product) => p.id === item.productId)
          return {
            id: item.productId,
            name: product?.name || "Producto desconocido",
            price: item.price,
            quantity: item.quantity,
            image: product?.image || "/placeholder.svg",
          }
        }),
        total: order.total,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        shippingAddress: {
          street: "Calle Principal 123",
          city: "La Paz",
          zipCode: "00000",
          phone: "+591 70000000",
        },
      }
    })
  }

  static updateOrderStatus(orderId: string, status: "pending" | "processing" | "shipped" | "delivered" | "cancelled") {
    return db.updateOrderStatus(orderId, status as any)
  }

  // Product management methods
  static getAllProducts() {
    return db.getProducts()
  }

  static createProduct(productData: Omit<Product, "id" | "createdAt">) {
    return db.createProduct(productData)
  }

  static updateProduct(productId: string, updates: Partial<Product>) {
    return db.updateProduct(productId, updates)
  }

  static deleteProduct(productId: string) {
    return db.deleteProduct(productId)
  }

  // Statistics methods
  static getStatistics() {
    const users = db["users"]
    const products = db["products"]
    const orders = db["orders"]

    return Promise.resolve({
      totalUsers: users.length,
      totalProducts: products.length,
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum: number, order: Order) => sum + order.total, 0),
      recentOrders: orders.slice(-5).reverse(),
      lowStockProducts: products.filter((p: Product) => p.stock < 5),
    })
  }
}
