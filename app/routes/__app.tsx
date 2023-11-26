import { Button, Modal, PasswordInput, ScrollArea } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import type { LoaderArgs, SerializeFrom } from "@remix-run/node"
import { json } from "@remix-run/node"
import type { ShouldReloadFunction } from "@remix-run/react"
import {
  Form,
  Outlet,
  useFetcher,
  useLoaderData,
  useLocation,
} from "@remix-run/react"
import * as React from "react"
import { Sidebar } from "~/components/Sidebar"
import { getAllMenuItems } from "~/lib/menu.server"
import {
  cancelReservationCron,
  getAllReservations,
} from "~/lib/reservation.server"
import { getAllTables } from "~/lib/table.server"
import { getAllWaiters } from "~/lib/waiter.server"
import { isWaiter, requireUser } from "~/session.server"
import { useUser } from "~/utils/hooks"

export type AppLoaderData = SerializeFrom<typeof loader>
export const loader = async ({ request }: LoaderArgs) => {
  const user = await requireUser(request)

  const [tables, menuItems, reservations, , waiters] = await Promise.all([
    getAllTables(),
    getAllMenuItems(),
    getAllReservations(),
    cancelReservationCron(),
    getAllWaiters(),
  ])

  return json({
    tables,
    menuItems,
    reservations,
    waiters,
    role: user.role,
    userId: user.id,
    isWaiter: await isWaiter(request),
    hasResetPassword: user.hasResetPassword,
  })
}

export default function AppLayout() {
  return (
    <>
      <div className="flex h-full flex-col overflow-hidden">
        <HeaderComponent />
        <div className="grid grid-cols-12">
          <div className="col-span-2 overflow-hidden border-r">
            <Sidebar />
          </div>
          <div className="col-span-10 h-[calc(100vh-100px)] overflow-y-auto">
            <ScrollArea classNames={{ root: "h-full" }} type="always">
              <Content />
            </ScrollArea>
          </div>
        </div>
      </div>
    </>
  )
}

function HeaderComponent() {
  const location = useLocation()

  const user = useUser()

  const fetcher = useFetcher()
  const { hasResetPassword } = useLoaderData<typeof loader>()
  const [isModalOpen, handleModal] = useDisclosure(
    user.role === "WAITER" ? !hasResetPassword : false
  )

  const isSubmitting = fetcher.state !== "idle"

  React.useEffect(() => {
    if (fetcher.type !== "done") {
      return
    }

    if (!fetcher.data.success) {
      return
    }

    handleModal.close()
  }, [fetcher.data, fetcher.type, handleModal])
  return (
    <>
      <Form replace action="/api/auth/logout" method="post" id="logout-form" />
      <header className="h-[110px] border-b bg-blue-200 p-4">
        <div className="flex h-full w-full items-center justify-between">
          <div>
            <img src="/logo.png" alt="logo" className="h-20 w-24" />
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col items-center">
                  <span>{user.name}</span>
                  <span>{user.email}</span>
                </div>
                <div className="flex items-center justify-center">
                  <Button
                    type="submit"
                    form="logout-form"
                    variant="light"
                    color="red"
                  >
                    Logout
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button variant="light" color="blue">
                  Login
                </Button>
                <Button variant="light" color="blue">
                  Create Account
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <Modal
        opened={isModalOpen}
        onClose={handleModal.close}
        title="Reset Password"
        padding="xl"
        withCloseButton={false}
        closeOnEscape={false}
        closeOnClickOutside={false}
      >
        <fetcher.Form
          method="post"
          replace
          className="flex flex-col gap-4"
          action="/api/reset-password"
        >
          <div className="mt-6 flex flex-col gap-4">
            <input hidden name="userId" defaultValue={user.id} />
            <PasswordInput
              required
              name="password"
              label="Enter new password"
              placeholder="Password"
            />

            <Button
              variant="filled"
              type="submit"
              fullWidth
              loading={isSubmitting}
              loaderPosition="right"
            >
              Update
            </Button>
          </div>
        </fetcher.Form>
      </Modal>
    </>
  )
}

function Content() {
  return (
    <main>
      <Outlet />
    </main>
  )
}

export const unstable_shouldReload: ShouldReloadFunction = ({
  submission,
  prevUrl,
  url,
}) => {
  if (!submission && prevUrl.pathname === url.pathname) {
    return false
  }

  return true
}
