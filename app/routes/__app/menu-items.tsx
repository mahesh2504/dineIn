import { PlusIcon } from "@heroicons/react/24/solid"
import {
  Button,
  Drawer,
  MultiSelect,
  NumberInput,
  TextInput,
  clsx,
} from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import type { Menu } from "@prisma/client"
import type { ActionFunction } from "@remix-run/node"
import { json } from "@remix-run/node"
import { useFetcher } from "@remix-run/react"
import * as React from "react"
import { TailwindContainer } from "~/components/TailwindContainer"
import { createOrUpdateMenu } from "~/lib/menu.server"
import { useAppData } from "~/utils/hooks"
import { categories, formatCurrency, formatList } from "~/utils/misc"
import { badRequest } from "~/utils/misc.server"
import type { inferErrors } from "~/utils/validation"
import { validateAction } from "~/utils/validation"
import { ManageMenuItemSchema } from "~/utils/zod.schema"

enum MODE {
  edit,
  add,
}

interface ActionData {
  success: boolean
  fieldErrors?: inferErrors<typeof ManageMenuItemSchema>
}

export const action: ActionFunction = async ({ request }) => {
  const { fields, fieldErrors } = await validateAction(
    request,
    ManageMenuItemSchema
  )

  if (fieldErrors) {
    return badRequest<ActionData>({ success: false, fieldErrors })
  }

  await createOrUpdateMenu(fields)
  return json({ success: true })
}

export default function ManageMenuItems() {
  const fetcher = useFetcher<ActionData>()
  const { menuItems, isWaiter } = useAppData()

  const [selectedItemId, setSelectedItemId] = React.useState<Menu["id"] | null>(
    null
  )
  const [selectedItem, setSelectedItem] = React.useState<
    typeof menuItems[number] | null
  >(null)
  const [mode, setMode] = React.useState<MODE>(MODE.edit)
  const [isModalOpen, handleModal] = useDisclosure(false)

  const isSubmitting = fetcher.state !== "idle"

  React.useEffect(() => {
    if (fetcher.state !== "idle" && fetcher.submission === undefined) {
      return
    }

    if (fetcher.data?.success) {
      setSelectedItemId(null)
      handleModal.close()
    }
    // handleModal is not meemoized, so we don't need to add it to the dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data?.success, fetcher.state, fetcher.submission])

  React.useEffect(() => {
    if (!selectedItemId) {
      setSelectedItem(null)
      return
    }

    const item = menuItems.find((item) => item.id === selectedItemId)
    if (!item) return

    setSelectedItem(item)
    handleModal.open()
    // handleModal is not meemoized, so we don't need to add it to the dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuItems, selectedItemId])

  return (
    <>
      <TailwindContainer className="rounded-md bg-white">
        <div className="mt-8 sm:px-6 lg:px-8">
          <div className="sm:flex sm:flex-auto sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">
                Manage Menu Items
              </h1>
              <p className="mt-2 text-sm text-gray-700">
                A list of all the menu items in the restaurant
              </p>
            </div>
            <div>
              <Button
                loading={isSubmitting}
                loaderPosition="left"
                disabled={isWaiter}
                onClick={() => {
                  setMode(MODE.add)
                  handleModal.open()
                }}
              >
                <PlusIcon className="h-4 w-4" />
                <span className="ml-2">Add item</span>
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
                        Price
                      </th>

                      <th
                        scope="col"
                        className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 md:pl-0"
                      >
                        Category
                      </th>

                      <th
                        scope="col"
                        className="relative py-3.5 pl-3 pr-4 sm:pr-6 md:pr-0"
                      ></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {menuItems.map((item) => (
                      <tr key={item.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
                          {item.name}
                        </td>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
                          {formatList(item.category)}
                        </td>
                        <td className="relative space-x-4 whitespace-nowrap py-4 pl-3 pr-4 text-left text-sm font-medium sm:pr-6 md:pr-0">
                          <div className="flex items-center gap-6">
                            <Button
                              loading={isSubmitting}
                              variant="subtle"
                              loaderPosition="right"
                              disabled={isWaiter}
                              onClick={() => {
                                setSelectedItemId(item.id)
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
          setSelectedItemId(null)
          handleModal.close()
        }}
        title={clsx({
          "Edit item": mode === MODE.edit,
          "Add item": mode === MODE.add,
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
            <input hidden name="itemId" value={selectedItem?.id} />

            <TextInput
              name="name"
              label="Name"
              defaultValue={selectedItem?.name}
              error={fetcher.data?.fieldErrors?.name}
              required
            />

            <NumberInput
              name="price"
              label="Price"
              icon="$"
              defaultValue={selectedItem?.price}
              error={fetcher.data?.fieldErrors?.price}
              precision={2}
              required
              min={1}
            />

            <MultiSelect
              name="category"
              label="Category"
              required
              data={categories}
              defaultValue={selectedItem?.category}
              placeholder="Select categories"
              searchable
              error={fetcher.data?.fieldErrors?.category}
            />

            <div className="mt-1 flex items-center justify-end gap-4">
              <Button
                variant="subtle"
                disabled={isSubmitting}
                onClick={() => {
                  setSelectedItem(null)
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
                {mode === MODE.edit ? "Save changes" : "Add item"}
              </Button>
            </div>
          </fieldset>
        </fetcher.Form>
      </Drawer>
    </>
  )
}
