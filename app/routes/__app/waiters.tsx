import { PlusIcon } from "@heroicons/react/24/solid"
import { Button, Drawer, PasswordInput, TextInput, clsx } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import type { User } from "@prisma/client"
import type { ActionFunction, LoaderArgs } from "@remix-run/node"
import { json, redirect } from "@remix-run/node"
import { useFetcher } from "@remix-run/react"
import * as React from "react"
import { TailwindContainer } from "~/components/TailwindContainer"
import { createOrUpdateWaiter } from "~/lib/waiter.server"
import { isWaiter, requireUser } from "~/session.server"
import { useAppData } from "~/utils/hooks"
import { badRequest } from "~/utils/misc.server"
import type { inferErrors } from "~/utils/validation"
import { validateAction } from "~/utils/validation"
import { ManageWaiterSchema } from "~/utils/zod.schema"

enum MODE {
  edit,
  add,
}

export const loader = async ({ request }: LoaderArgs) => {
  const user = await requireUser(request)

  if (await isWaiter(request)) {
    return redirect("/")
  }

  return json({
    adminId: user.id,
  })
}

interface ActionData {
  success: boolean
  fieldErrors?: inferErrors<typeof ManageWaiterSchema>
}

export const action: ActionFunction = async ({ request }) => {
  const { fields, fieldErrors } = await validateAction(
    request,
    ManageWaiterSchema
  )

  if (fieldErrors) {
    return badRequest<ActionData>({ success: false, fieldErrors })
  }

  return createOrUpdateWaiter(fields)
    .then(() => json({ success: true }))
    .catch((e) => {
      console.error(e)
      return json({
        success: false,
        fieldErrors: {
          password: e.message,
        },
      })
    })
}

export default function ManageWaiters() {
  const fetcher = useFetcher<ActionData>()
  const { waiters } = useAppData()

  const [selectedWaiterId, setSelectedWaiterId] = React.useState<
    User["id"] | null
  >(null)
  const [selectedWaiter, setSelectedWaiter] = React.useState<
    typeof waiters[number] | null
  >(null)
  const [mode, setMode] = React.useState<MODE>(MODE.edit)
  const [isModalOpen, handleModal] = useDisclosure(false)

  const isSubmitting = fetcher.state !== "idle"

  React.useEffect(() => {
    if (fetcher.state !== "idle" && fetcher.submission === undefined) {
      return
    }

    if (fetcher.data?.success) {
      setSelectedWaiterId(null)
      handleModal.close()
    }
    // handleModal is not meemoized, so we don't need to add it to the dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data?.success, fetcher.state, fetcher.submission])

  React.useEffect(() => {
    if (!selectedWaiterId) {
      setSelectedWaiter(null)
      return
    }

    const waiter = waiters.find((w) => w.id === selectedWaiterId)
    if (!waiter) return

    setSelectedWaiter(waiter)
    handleModal.open()
    // handleModal is not meemoized, so we don't need to add it to the dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiters, selectedWaiterId])

  return (
    <>
      <TailwindContainer className="rounded-md bg-white">
        <div className="mt-8 sm:px-6 lg:px-8">
          <div className="sm:flex sm:flex-auto sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">
                Manage Waiter
              </h1>
              <p className="mt-2 text-sm text-gray-700">
                A list of all the waiters in the waiter.
              </p>
            </div>
            <div>
              <Button
                loading={isSubmitting}
                loaderPosition="left"
                onClick={() => {
                  setMode(MODE.add)
                  handleModal.open()
                }}
              >
                <PlusIcon className="h-4 w-4" />
                <span className="ml-2">Add waiter</span>
              </Button>
            </div>
          </div>
          <div className="mt-8 flex flex-col">
            <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 md:pl-0"
                      >
                        Name
                      </th>

                      <th
                        scope="col"
                        className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 md:pl-0"
                      >
                        Email
                      </th>
                      <th
                        scope="col"
                        className="relative py-3.5 pl-3 pr-4 sm:pr-6 md:pr-0"
                      ></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {waiters.map((waiter) => (
                      <tr key={waiter.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
                          {waiter.name}
                        </td>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
                          {waiter.email}
                        </td>
                        <td className="relative space-x-4 whitespace-nowrap py-4 pl-3 pr-4 text-left text-sm font-medium sm:pr-6 md:pr-0">
                          <div className="flex items-center gap-6">
                            <Button
                              loading={isSubmitting}
                              variant="subtle"
                              loaderPosition="right"
                              onClick={() => {
                                setSelectedWaiterId(waiter.id)
                                setMode(MODE.edit)
                              }}
                            >
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </TailwindContainer>

      <Drawer
        opened={isModalOpen}
        onClose={() => {
          setSelectedWaiterId(null)
          handleModal.close()
        }}
        title={clsx({
          "Edit waiter": mode === MODE.edit,
          "Add waiter": mode === MODE.add,
        })}
        position="right"
        padding={2}
        overlayBlur={1.2}
        overlayOpacity={0.6}
        closeOnEscape={false}
        closeOnClickOutside={false}
      >
        <fetcher.Form method="post" replace>
          <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
            <input hidden name="userId" value={selectedWaiter?.id} />

            <TextInput
              name="name"
              label="Name"
              defaultValue={selectedWaiter?.name}
              error={fetcher.data?.fieldErrors?.name}
              required
            />

            <TextInput
              name="email"
              label="Email"
              type="email"
              defaultValue={selectedWaiter?.email}
              error={fetcher.data?.fieldErrors?.email}
              required
            />

            {mode === MODE.add ? (
              <PasswordInput
                name="password"
                label="Password"
                error={fetcher.data?.fieldErrors?.password}
                required
              />
            ) : null}

            <div className="mt-1 flex items-center justify-end gap-4">
              <Button
                variant="subtle"
                disabled={isSubmitting}
                onClick={() => {
                  setSelectedWaiter(null)
                  handleModal.close()
                }}
                color="red"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isSubmitting}
                loaderPosition="right"
              >
                {mode === MODE.edit ? "Save changes" : "Add waiter"}
              </Button>
            </div>
          </fieldset>
        </fetcher.Form>
      </Drawer>
    </>
  )
}
