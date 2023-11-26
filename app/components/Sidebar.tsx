import { NavLink } from "@remix-run/react"
import {
  BookIcon,
  ListOrderedIcon,
  MenuIcon,
  TableIcon,
  UsersIcon,
} from "lucide-react"
import { useUser } from "~/utils/hooks"

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
}

const baseNavItems: NavItem[] = [
  {
    title: "Menu Items",
    href: "/menu-items",
    icon: MenuIcon,
  },
  {
    title: "Orders",
    href: "/orders",
    icon: ListOrderedIcon,
  },
  {
    title: "Tables",
    href: "/tables",
    icon: TableIcon,
  },
  
]

const managerNavItems: NavItem[] = [
  ...baseNavItems,
  {
    title: "Bookings",
    href: "/bookings",
    icon: BookIcon,
  },
  {
    title: "Waiters",
    href: "/waiters",
    icon: UsersIcon,
  },
]

const waiterNavItems = [...baseNavItems]

function classNames(...classes: string[]): string {
  return classes.filter(Boolean).join(" ")
}

export function Sidebar() {
  let navItems: NavItem[] = []
  const user = useUser()

  if (user.role === "MANAGER") {
    navItems = managerNavItems
  } else {
    navItems = waiterNavItems
  }

  return (
    <>
      <div className="h-full">
        <nav className="mt-3 flex flex-1 flex-col">
          <ul className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul className="-mx-2 flex flex-col gap-4 space-y-1 p-7">
                {navItems.map((item: any) => (
                  <li
                    key={item.title}
                    className="rounded-md border border-black"
                  >
                    <NavLink
                      to={item.href}
                      className={({ isActive }) =>
                        classNames(
                          isActive
                            ? "bg-blue-500 text-white"
                            : "text-black hover:bg-blue-500 hover:text-white",
                          "group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6"
                        )
                      }
                    >
                      <item.icon
                        className="h-6 w-6 shrink-0"
                        aria-hidden="true"
                      />
                      {item.title}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    </>
  )
}
