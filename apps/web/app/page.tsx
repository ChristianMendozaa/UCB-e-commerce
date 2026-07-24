import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/header"
import { GraduationCap, ShoppingBag, Users, Star, ArrowRight, BookOpen, Laptop, Wrench } from "lucide-react"

export default function HomePage() {
  const careers = [
    {
      name: "Ingeniería de Sistemas",
      icon: Laptop,
      description: "Tecnología, programación y desarrollo",
      color: "bg-blue-500",
      products: 15,
    },
    {
      name: "Psicopedagogía",
      icon: BookOpen,
      description: "Educación y desarrollo humano",
      color: "bg-green-500",
      products: 12,
    },
    {
      name: "Mecatrónica",
      icon: Wrench,
      description: "Robótica y automatización",
      color: "bg-purple-500",
      products: 18,
    },
  ]

  const features = [
    {
      icon: GraduationCap,
      title: "Productos Especializados",
      description: "Material específico para cada carrera universitaria",
    },
    {
      icon: Users,
      title: "Comunidad UCB",
      description: "Exclusivo para estudiantes, docentes y personal",
    },
    {
      icon: ShoppingBag,
      title: "Compra Segura",
      description: "Proceso de compra simple y confiable",
    },
    {
      icon: Star,
      title: "Calidad Garantizada",
      description: "Productos seleccionados por expertos académicos",
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative py-12 md:py-20 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <Badge variant="secondary" className="mb-4">
              Universidad Católica Boliviana
            </Badge>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-balance mb-6">
              Tu tienda universitaria
              <span className="text-primary block">especializada</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground text-pretty mb-8 max-w-2xl mx-auto">
              Encuentra todo lo que necesitas para tu carrera universitaria. Productos especializados, libros,
              tecnología y más.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/catalog">
                <Button size="lg" className="w-full sm:w-auto">
                  Explorar Catálogo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/careers">
                <Button variant="outline" size="lg" className="w-full sm:w-auto bg-transparent">
                  Ver por Carrera
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Careers Section */}
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Productos por Carrera</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Encuentra productos específicos para tu área de estudio
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {careers.map((career, index) => {
              const IconComponent = career.icon
              return (
                <Link key={index} href={`/careers/${encodeURIComponent(career.name)}`}>
                  <Card className="h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                    <CardHeader className="text-center">
                      <div
                        className={`w-16 h-16 ${career.color} rounded-full flex items-center justify-center mx-auto mb-4`}
                      >
                        <IconComponent className="h-8 w-8 text-white" />
                      </div>
                      <CardTitle className="text-xl">{career.name}</CardTitle>
                      <CardDescription>{career.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                      <Badge variant="secondary">{career.products} productos disponibles</Badge>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">¿Por qué elegir UCB Store?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Una plataforma diseñada específicamente para la comunidad universitaria
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const IconComponent = feature.icon
              return (
                <Card key={index} className="text-center">
                  <CardHeader>
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">¿Listo para comenzar?</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Únete a la comunidad UCB y accede a productos especializados para tu carrera
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto bg-transparent">
                Iniciar Sesión
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">UCB</span>
                </div>
                <div>
                  <h3 className="font-bold">UCB Store</h3>
                  <p className="text-xs text-muted-foreground">Universidad Católica Boliviana</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Plataforma oficial de e-commerce de la Universidad Católica Boliviana. Productos especializados para
                estudiantes, docentes y personal administrativo.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Enlaces</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/catalog" className="hover:text-foreground">
                    Catálogo
                  </Link>
                </li>
                <li>
                  <Link href="/careers" className="hover:text-foreground">
                    Por Carrera
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-foreground">
                    Acerca de
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-foreground">
                    Contacto
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Soporte</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/help" className="hover:text-foreground">
                    Ayuda
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-foreground">
                    Términos
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-foreground">
                    Privacidad
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2025 Universidad Católica Boliviana. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
