import { PencilIcon, UserIcon } from "@heroicons/react/24/solid"
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  Modal,
  NativeSelect,
  NumberInput,
  Select,
  Text,
} from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import type { Customer } from "@prisma/client"
import { ReservationStatus } from "@prisma/client"
import type { ActionFunction } from "@remix-run/node"
import { json, redirect } from "@remix-run/node"
import { useFetcher } from "@remix-run/react"
import appConfig from "app.config"
import * as React from "react"
import { TailwindContainer } from "~/components/TailwindContainer"
import { db } from "~/db.server"
import { addToOrder, generateBill, updateOrder } from "~/lib/order.server"
import { dateDiffInDays } from "~/utils/date"
import { useAppData } from "~/utils/hooks"
import {
  formatCurrency,
  formatDate,
  formatList,
  formatTime,
  splitBillOptions,
} from "~/utils/misc"
import { badRequest } from "~/utils/misc.server"

interface ActionData {
  success: boolean
  fieldErrors?: {
    menuId?: string
    quantity?: string
    customerId?: string
    tip?: string
    splitInto?: string
  }
}

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData()
  const intent = formData.get("intent")?.toString()

  if (intent === "add-order") {
    const customerId = formData.get("customerId")?.toString()
    const menuId = formData.get("menuId")?.toString()
    const quantity = formData.get("quantity")?.toString()

    if (!customerId) {
      return badRequest<ActionData>({
        success: false,
        fieldErrors: { customerId: "Customer is required" },
      })
    }

    if (!menuId) {
      return badRequest<ActionData>({
        success: false,
        fieldErrors: { menuId: "Choose an item to add to order" },
      })
    }

    if (!quantity) {
      return badRequest<ActionData>({
        success: false,
        fieldErrors: { quantity: "Quantity is required" },
      })
    }

    await addToOrder({
      customerId,
      menuId,
      quantity: Number(quantity),
    })
    return json({ success: true })
  }
  if (intent === "update-order") {
    const customerId = formData.get("customerId")?.toString()
    const menuId = formData.get("menuId")?.toString()
    const quantity = formData.get("quantity")?.toString()

    if (!customerId) {
      return badRequest<ActionData>({
        success: false,
        fieldErrors: { customerId: "Customer is required" },
      })
    }

    if (!menuId) {
      return badRequest<ActionData>({
        success: false,
        fieldErrors: { menuId: "Choose an item to add to order" },
      })
    }

    if (!quantity) {
      return badRequest<ActionData>({
        success: false,
        fieldErrors: { quantity: "Quantity is required" },
      })
    }

    await updateOrder({
      customerId,
      menuId,
      quantity: Number(quantity),
    })
    return json({ success: true })
  }
  if (intent === "generate-bill") {
    const customerId = formData.get("customerId")?.toString()
    const tip = formData.get("tip")?.toString()
    const splitInto = formData.get("splitInto")?.toString()
    if (!customerId) {
      return badRequest<ActionData>({
        success: false,
        fieldErrors: { customerId: "Customer is required" },
      })
    }
    if (!tip) {
      return badRequest<ActionData>({
        success: false,
        fieldErrors: { tip: "Tip is required" },
      })
    }
    if (!splitInto) {
      return badRequest<ActionData>({
        success: false,
        fieldErrors: { splitInto: "Split into is required" },
      })
    }

    await generateBill({
      customerId,
      tip: Number(tip),
      splitInto: Number(splitInto),
    })
    return redirect(`/bookings`)
  }
  if (intent === "send-to-kitchen") {
    const customerId = formData.get("customerId")?.toString()
    if (!customerId) {
      return badRequest<ActionData>({
        success: false,
        fieldErrors: { customerId: "Customer is required" },
      })
    }

    const reservation = await db.reservation.findFirst({
      where: { customerId },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    })

    if (!reservation) {
      return badRequest<ActionData>({ success: false })
    }

    if (!reservation.order) {
      return badRequest<ActionData>({ success: false })
    }

    const menuItems = reservation.order.items.map((item) => item.id)

    for (const menuItemId of menuItems) {
      await db.menuOrder.update({
        where: { id: menuItemId },
        data: {
          sentToKitchen: true,
        },
      })
    }

    return json({ success: true })
  }

  return badRequest<ActionData>({ success: false })
}

export default function ManageOrders() {
  const orderFetcher = useFetcher<ActionData>()
  const { reservations, menuItems, userId } = useAppData()
  const [isBookingModalOpen, handleBookingModal] = useDisclosure(false)
  const [isBillModalOpen, handleBillModal] = useDisclosure(false)

  const upcomingReservations = React.useMemo(
    () =>
      reservations.filter(
        (reservation) => true
          // reservation.waiterId === userId 
          //reservation.status === ReservationStatus.CONFIRMED &&
          //reservation.table
          //dateDiffInDays(new Date(reservation.bookingDate), new Date()) === 0
      ),
    [reservations, userId]
  )
  const customers = upcomingReservations.map((reservation) => ({
    ...reservation.customer,
    bookingDate: reservation.bookingDate,
    timeSlotStart: reservation.timeSlotStart,
    timeSlotEnd: reservation.timeSlotEnd,
    tableNo: reservation.table?.no,
  }))

  const [customerId, setCustomerId] = React.useState<Customer["id"] | null>(
    null
  )
  const [reservation, setReservation] =
    React.useState<typeof upcomingReservations[number]>()

  const isOrdering = reservation?.order !== null
  const isValidReservation = customerId && reservation
  const isSubmittingOrder = orderFetcher.state !== "idle"

  React.useEffect(() => {
    if (!customerId) {
      setReservation(undefined)
      return
    }

    const reservation = upcomingReservations.find(
      (reservation) => reservation.customer.id === customerId
    )

    setReservation(reservation)
  }, [customerId, upcomingReservations])

  React.useEffect(() => {
    if (
      orderFetcher.state !== "idle" &&
      orderFetcher.submission === undefined
    ) {
      return
    }

    if (orderFetcher.data?.success) {
      handleBookingModal.close()
    }
    // handleModal is not meemoized, so we don't need to add it to the dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderFetcher.data?.success, orderFetcher.state, orderFetcher.submission])

  const hasOrderedItems = reservation?.order?.items
    ? reservation?.order?.items.length > 0
    : false

  const amount =
    reservation && isOrdering
      ? // @ts-expect-error - order is not null
        reservation.order.items.reduce((acc, item) => acc + item.amount, 0)
      : 0
  const tax = (amount * appConfig.taxPercent) / 100
  const netAmount = amount + tax

  return (
    <>
      <TailwindContainer className="rounded-md bg-white">
        <div className="mt-8 sm:px-6 lg:px-8">
          <div className="sm:flex sm:flex-auto sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">
                Manage Orders
              </h1>
              <p className="mt-2 text-sm text-gray-700">
                Take a look at the orders that have been made.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <Select
                w={300}
                label="Customer"
                clearable
                searchable
                disabled={customers.length === 0}
                placeholder={
                  customers.length > 0
                    ? "Select customer"
                    : "No reservations for today!"
                }
                value={customerId}
                itemComponent={SelectItem}
                onChange={setCustomerId}
                data={customers.map((customer) => ({
                  label: `${customer.name} - Table ${customer.tableNo}`,
                  value: customer.id,
                  name: customer.name,
                  phoneNo: customer.phoneNo,
                  bookingDate: customer.bookingDate,
                  timeSlotStart: customer.timeSlotStart,
                  timeSlotEnd: customer.timeSlotEnd,
                  tableNo: customer.tableNo,
                }))}
              />
              <div className="flex flex-col gap-1">
                <Button
                  compact
                  disabled={!isValidReservation || isSubmittingOrder}
                  variant="light"
                  onClick={() => handleBookingModal.open()}
                >
                  Add items
                </Button>
                <Button
                  compact
                  disabled={
                    !isValidReservation || isSubmittingOrder || !hasOrderedItems
                  }
                  variant="light"
                  onClick={() =>
                    orderFetcher.submit(
                      {
                        intent: "send-to-kitchen",
                        customerId: customerId!,
                      },
                      {
                        method: "post",
                        replace: true,
                      }
                    )
                  }
                >
                  Send to kitchen
                </Button>
                {hasOrderedItems ? (
                  <Button
                    compact
                    disabled={!isValidReservation || isSubmittingOrder}
                    variant="light"
                    onClick={() => handleBillModal.open()}
                    color="red"
                  >
                    Generate Bill
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col">
            <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                {customers.length > 0 ? (
                  <>
                    {isValidReservation ? (
                      isOrdering ? (
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
                                Quantity
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
                                Total Price
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {reservation.order?.items.map((item) => (
                              <MenuRow
                                key={item.id}
                                item={item}
                                customerId={customerId}
                              />
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <EmptyCustomerState message="Add an item to the menu to start taking orders" />
                      )
                    ) : (
                      <EmptyCustomerState message="Select a customer to manage orders" />
                    )}
                  </>
                ) : (
                  <EmptyCustomerState message="Allot a table to a customer to start taking order" />
                )}
              </div>
            </div>
          </div>
        </div>
      </TailwindContainer>

      <Drawer
        opened={isBookingModalOpen}
        onClose={() => handleBookingModal.close()}
        title="Order"
        position="right"
        padding={2}
        overlayBlur={1.2}
        overlayOpacity={0.6}
        closeOnEscape={false}
        closeOnClickOutside={false}
      >
        <orderFetcher.Form method="post" replace>
          <input hidden name="customerId" value={customerId!} />

          <fieldset
            disabled={isSubmittingOrder}
            className="flex flex-col gap-4"
          >
            <Select
              name="menuId"
              label="Item"
              placeholder="Select an item"
              error={orderFetcher?.data?.fieldErrors?.menuId}
              data={menuItems.map((m) => ({
                label: `${m.name}  - ${formatList(
                  m.category
                )} (${formatCurrency(m.price)})`,
                value: m.id,
              }))}
            />

            <NumberInput
              name="quantity"
              label="Quantity"
              placeholder="Enter quantity"
              error={orderFetcher?.data?.fieldErrors?.quantity}
              defaultValue={1}
              min={1}
            />

            <div className="mt-1 flex items-center justify-end gap-4">
              <Button
                variant="subtle"
                disabled={isSubmittingOrder}
                onClick={() => handleBookingModal.close()}
                color="red"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isSubmittingOrder}
                loaderPosition="right"
                name="intent"
                value="add-order"
              >
                Confirm order
              </Button>
            </div>
          </fieldset>
        </orderFetcher.Form>
      </Drawer>

      <Drawer
        opened={isBillModalOpen}
        onClose={() => handleBillModal.close()}
        title="Order"
        position="right"
        padding={2}
        overlayBlur={1.2}
        overlayOpacity={0.6}
        closeOnEscape={false}
        closeOnClickOutside={false}
      >
        <orderFetcher.Form method="post" replace>
          <input hidden name="customerId" value={customerId!} />

          <fieldset
            disabled={isSubmittingOrder}
            className="flex flex-col gap-1"
          >
            <hr />
            <div className="flex items-center justify-between gap-4 py-1">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Table No</span>
                </div>
              </div>
              <span className="text-sm font-medium">
                {reservation?.table?.no || "Not assigned"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 py-1">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Waiter</span>
                </div>
              </div>
              <span className="text-sm font-medium">
                {reservation?.waiter?.name || "Not assigned"}
              </span>
            </div>

            <hr className="pb-1" />
            {reservation?.order?.items.map((item) => (
              <div
                key={item.id}
                className="mt-1 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {item.menu.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {item.quantity} x {item.menu.price}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-medium">
                  {formatCurrency(item.quantity * item.menu.price)}
                </span>
              </div>
            ))}

            <hr className="my-1" />
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Amount</span>
                  <span className="text-xs text-gray-500">Total amount</span>
                </div>
              </div>
              <span className="text-sm font-medium">
                {formatCurrency(amount)}
              </span>
            </div>

            <div className="mt-1 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Tax</span>
                  <span className="text-xs text-gray-500">Tax amount</span>
                </div>
              </div>
              <span className="text-sm font-medium">{formatCurrency(tax)}</span>
            </div>

            <hr className="my-1" />
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Net Amount</span>
                  <span className="text-xs text-gray-500">Net amount</span>
                </div>
              </div>
              <span className="text-sm font-medium">
                {formatCurrency(netAmount)}
              </span>
            </div>

            <div className="mt-2 mb-4 grid grid-cols-2 gap-4">
              <NumberInput
                size="xs"
                name="tip"
                label="Tip"
                placeholder="Enter amount"
                icon="$"
                precision={2}
                defaultValue={amount * 0.1}
                error={orderFetcher.data?.fieldErrors?.tip}
                min={1}
              />
              <NativeSelect
                size="xs"
                name="splitInto"
                label="Split Bill"
                defaultValue={splitBillOptions[0].value}
                data={splitBillOptions}
              />
            </div>

            <div className="mt-1 flex items-center justify-end gap-4">
              <Button
                variant="subtle"
                disabled={isSubmittingOrder}
                onClick={() => handleBillModal.close()}
                color="red"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isSubmittingOrder}
                loaderPosition="right"
                name="intent"
                value="generate-bill"
              >
                Generate
              </Button>
            </div>
          </fieldset>
        </orderFetcher.Form>
      </Drawer>
    </>
  )
}

function MenuRow({
  item,
  customerId,
}: {
  item: NonNullable<
    ReturnType<typeof useAppData>["reservations"][number]["order"]
  >["items"][number]
  customerId: string
}) {
  const { menuItems } = useAppData()

  const updateFetcher = useFetcher()

  const isSubmitting = updateFetcher.state !== "idle"
  const [isModalOpen, handleModal] = useDisclosure(false)

  React.useEffect(() => {
    if (
      updateFetcher.state !== "idle" &&
      updateFetcher.submission === undefined
    ) {
      return
    }

    if (updateFetcher.data?.success) {
      handleModal.close()
    }
    // handleModal is not meemoized, so we don't need to add it to the dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    updateFetcher.data?.success,
    updateFetcher.state,
    updateFetcher.submission,
  ])

  return (
    <>
      <tr>
        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
          <div className="font-medium text-gray-900">
            <span>{item.menu.name}</span>
            {item.sentToKitchen && (
              <Badge color="green" className="ml-2">
                Sent to kitchen
              </Badge>
            )}
          </div>
        </td>
        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
          {item.quantity}
        </td>
        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
          {formatCurrency(item.menu.price)}
        </td>
        <td className="relative space-x-4 whitespace-nowrap py-4 pl-3 pr-4 text-left text-sm font-medium sm:pr-6 md:pr-0">
          <div className="flex items-center gap-8">
            <span>{formatCurrency(item.amount)}</span>
            <ActionIcon
              onClick={handleModal.open}
              disabled={item.sentToKitchen}
            >
              <PencilIcon className="h-4 w-4 text-red-500" />
            </ActionIcon>
          </div>
        </td>
      </tr>

      <Modal
        opened={isModalOpen}
        onClose={() => handleModal.close()}
        title="Edit Order"
        centered
        overlayBlur={1.2}
        overlayOpacity={0.6}
        closeOnEscape={false}
        closeOnClickOutside={false}
      >
        <updateFetcher.Form method="post" replace>
          <input hidden name="customerId" value={customerId!} />

          <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
            <Select
              name="menuId"
              label="Item"
              placeholder="Select an item"
              defaultValue={item.menu.id}
              error={updateFetcher?.data?.fieldErrors?.menuId}
              data={menuItems.map((m) => ({
                label: `${m.name}  - ${formatList(
                  m.category
                )} (${formatCurrency(m.price)})`,
                value: m.id,
              }))}
            />

            <NumberInput
              name="quantity"
              label="Quantity"
              placeholder="Enter quantity"
              error={updateFetcher?.data?.fieldErrors?.quantity}
              defaultValue={item.quantity}
              min={0}
            />

            <div className="mt-1 flex items-center justify-end gap-4">
              <Button
                variant="subtle"
                disabled={isSubmitting}
                onClick={() => handleModal.close()}
                color="red"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isSubmitting}
                loaderPosition="right"
                name="intent"
                value="update-order"
              >
                Update order
              </Button>
            </div>
          </fieldset>
        </updateFetcher.Form>
      </Modal>
    </>
  )
}

function EmptyCustomerState({ message }: { message: string }) {
  return (
    <div className="relative block w-full rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
      <UserIcon className="mx-auto h-9 w-9 text-gray-500" />
      <span className="mt-4 block text-sm font-medium text-gray-500">
        {message}
      </span>
    </div>
  )
}

interface ItemProps extends React.ComponentPropsWithoutRef<"div"> {
  name: string
  phoneNo: string
  bookingDate: string
  timeSlotStart: string
  timeSlotEnd: string
  label: string
  tableNo: string
}

const SelectItem = React.forwardRef<HTMLDivElement, ItemProps>(
  (props: ItemProps, ref) => {
    const {
      name,
      phoneNo,
      bookingDate,
      timeSlotStart,
      timeSlotEnd,
      tableNo,
      ...others
    } = props
    return (
      <div ref={ref} {...others}>
        <Group noWrap>
          <div>
            <Text size="sm">
              {name} ({phoneNo})
            </Text>
            <Text size="xs">Table: {tableNo}</Text>
            <Text size="xs" opacity={0.65}>
              {formatDate(bookingDate)}
            </Text>
            <Text size="xs" opacity={0.65}>
              {formatTime(new Date(timeSlotStart))} -{" "}
              {formatTime(new Date(timeSlotEnd))}
            </Text>
          </div>
        </Group>
      </div>
    )
  }
)
