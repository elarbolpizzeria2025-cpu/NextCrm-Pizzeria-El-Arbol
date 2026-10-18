import React from 'react';
import {
  ArrowRight,
  ChartNoAxesCombined,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  PackageCheck,
  Pizza,
  Smartphone,
  UsersRound,
  WalletCards
} from 'lucide-react';

const features = [
  {
    title: 'Toma de pedidos',
    description: 'Organizá pedidos de mostrador, mesas y delivery en un mismo lugar.',
    icon: ClipboardList
  },
  {
    title: 'Pantalla de cocina',
    description: 'Seguimiento de comandas con el monitor KDS para preparar cada pedido.',
    icon: ChefHat
  },
  {
    title: 'Pedidos prontos',
    description: 'Visualizá los pedidos listos según su destino: retiro, salón o envío.',
    icon: PackageCheck
  },
  {
    title: 'Caja y ventas',
    description: 'Accedé al control de turnos, cobros y reportes desde Gestión.',
    icon: WalletCards
  },
  {
    title: 'Clientes y menú',
    description: 'Mantené ordenados los datos de clientes, productos y precios.',
    icon: UsersRound
  },
  {
    title: 'Gestión de tu negocio',
    description: 'Consultá inventario, historial y métricas con accesos por módulo.',
    icon: ChartNoAxesCombined
  }
];

export default function PizzeriaLanding() {
  return (
    <div className="pizzeria-public-landing">
      <header className="pizzeria-landing-topbar">
        <div className="pizzeria-landing-wrap flex items-center justify-between gap-4 py-4">
          <a href="/pizzeria" className="flex items-center gap-3 text-white no-underline" aria-label="Inicio de NEXTCRM Pizzería">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-300/30 bg-purple-400/20">
              <Pizza size={24} />
            </span>
            <span className="block">
              <strong className="block text-base sm:text-lg font-black leading-tight tracking-tight">NEXTCRM</strong>
              <span className="block text-[10px] sm:text-xs font-bold tracking-wider text-purple-200">PIZZERÍA EL ÁRBOL</span>
            </span>
          </a>
          <a className="pizzeria-landing-link" href="/">
            Ingresar <ArrowRight size={16} />
          </a>
        </div>
      </header>

      <main>
        <section className="pizzeria-landing-wrap grid lg:grid-cols-[1.05fr_.95fr] items-center gap-10 lg:gap-14 py-16 sm:py-20 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-200/25 bg-pink-200/10 px-4 py-2 text-xs font-bold uppercase tracking-[.14em] text-pink-100">
              <LayoutDashboard size={15} /> Sistema de gestión para pizzería
            </div>
            <h1 className="mt-7 text-4xl sm:text-5xl xl:text-6xl font-black leading-[1.07] tracking-tight">
              Todo tu negocio, <span className="text-pink-200">en un solo lugar.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-purple-100/90">
              Pedidos, cocina, caja y gestión: una experiencia diseñada para trabajar con claridad,
              desde el mostrador hasta la entrega.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="/" className="pizzeria-landing-link">
                Entrar al software <ArrowRight size={17} />
              </a>
              <a href="#funciones" className="pizzeria-landing-link secondary">
                Conocer los módulos
              </a>
            </div>
            <p className="mt-4 text-xs text-purple-200/80">
              El ingreso al sistema mantiene sus permisos y credenciales habituales.
            </p>
          </div>

          <div className="pizzeria-landing-panel p-5 sm:p-7" aria-label="Vista ilustrativa de los módulos del sistema">
            <div className="flex items-center justify-between gap-3 border-b border-purple-300/15 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.16em] text-purple-200">Panel operativo</p>
                <h2 className="mt-1 text-xl font-black">Pizzería El Árbol</h2>
              </div>
              <span className="rounded-xl bg-purple-400/15 px-3 py-2 text-xs font-bold text-purple-100">Vista ilustrativa</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                { label: 'Toma de pedido', icon: ClipboardList },
                { label: 'Cocina · KDS', icon: ChefHat },
                { label: 'Pedidos prontos', icon: PackageCheck },
                { label: 'Gestión', icon: LayoutDashboard }
              ].map(({ label, icon: Icon }) => (
                <div key={label} className="rounded-2xl border border-purple-300/20 bg-[#170b2e]/75 p-4 sm:p-5">
                  <Icon size={23} className="text-pink-200" />
                  <p className="mt-4 text-sm font-bold leading-snug">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-pink-200/20 bg-pink-200/10 p-4">
              <Smartphone size={22} className="shrink-0 text-pink-200" />
              <p className="text-xs sm:text-sm text-purple-100">
                Una estética consistente y adaptable a computadoras, tablets y celulares.
              </p>
            </div>
          </div>
        </section>

        <section id="funciones" className="pizzeria-landing-wrap pb-20 sm:pb-24">
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-pink-200">Funciones principales</p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-black">Cada área, conectada con tu operación</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ title, description, icon: Icon }) => (
              <article key={title} className="pizzeria-landing-panel p-6">
                <span className="pizzeria-landing-icon"><Icon size={23} /></span>
                <h3 className="mt-5 text-lg font-black">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-purple-100/80">{description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-purple-200/20">
        <div className="pizzeria-landing-wrap flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-6 text-sm text-purple-100/75">
          <span>© NEXTCRM · Pizzería El Árbol</span>
          <a href="/" className="font-bold text-pink-100 hover:text-white underline underline-offset-4">
            Ingresar al sistema
          </a>
        </div>
      </footer>
    </div>
  );
}
