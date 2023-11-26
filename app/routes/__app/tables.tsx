import { ClockIcon, PlusIcon } from "@heroicons/react/24/solid"
import {
  Button,
  Drawer,
  Indicator,
  Modal,
  NumberInput,
  TextInput,
  clsx,
} from "@mantine/core"
import { DatePicker, TimeRangeInput } from "@mantine/dates"
import { useDisclosure } from "@mantine/hooks"
import type { Table } from "@prisma/client"
import { ReservationStatus } from "@prisma/client"
import type { ActionFunction } from "@remix-run/node"
import { json } from "@remix-run/node"
import { useFetcher } from "@remix-run/react"
import appConfig from "app.config"
import ms from "ms"
import * as React from "react"
import { TailwindContainer } from "~/components/TailwindContainer"
import { createOrUpdateTable } from "~/lib/table.server"
import { dateDiffInDays, timeDiffInMs } from "~/utils/date"
import { useAppData } from "~/utils/hooks"
import { badRequest } from "~/utils/misc.server"
import type { inferErrors } from "~/utils/validation"
import { validateAction } from "~/utils/validation"
import { ManageTableSchema } from "~/utils/zod.schema"

enum MODE {
  edit,
  add,
}

interface ActionData {
  success: boolean
  fieldErrors?: inferErrors<typeof ManageTableSchema>
}

export const action: ActionFunction = async ({ request }) => {
  const { fields, fieldErrors } = await validateAction(
    request,
    ManageTableSchema
  )

  if (fieldErrors) {
    return badRequest<ActionData>({ success: false, fieldErrors })
  }

  await createOrUpdateTable(fields)
  return json({ success: true })
}

export default function ManageTables() {
  const fetcher = useFetcher<ActionData>()
  const { tables, isWaiter } = useAppData()

  const [selectedTableId, setSelectedTableId] = React.useState<
    Table["id"] | null
  >(null)
  const [selectedTable, setSelectedTable] = React.useState<
    typeof tables[number] | null
  >(null)
  const [mode, setMode] = React.useState<MODE>(MODE.edit)
  const [isModalOpen, handleModal] = useDisclosure(false)

  const [date, setDate] = React.useState<Date | null>(new Date())
  const [timeRange, setTimeRange] = React.useState<[Date | null, Date | null]>([
    null,
    null,
  ])
  const [matchingTables, setMatchingTables] = React.useState<
    Array<typeof tables[number]>
  >([])
  const [error, setError] = React.useState<string | null>(null)
  const isSubmitting = fetcher.state !== "idle"

  React.useEffect(() => {
    if (fetcher.state !== "idle" && fetcher.submission === undefined) {
      return
    }

    if (fetcher.data?.success) {
      setSelectedTableId(null)
      handleModal.close()
    }
    // handleModal is not meemoized, so we don't need to add it to the dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data?.success, fetcher.state, fetcher.submission])

  React.useEffect(() => {
    if (!selectedTableId) {
      setSelectedTable(null)
      return
    }

    const table = tables.find((table) => table.id === selectedTableId)
    if (!table) return

    setSelectedTable(table)
    handleModal.open()
    // handleModal is not meemoized, so we don't need to add it to the dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, selectedTableId])

  React.useEffect(() => {
    const [start, end] = timeRange
    setError(null)

    if (!start || !end || !date) {
      setMatchingTables([])
      return
    }

    if (
      start.getHours() < appConfig.workingHours.start ||
      start.getHours() > appConfig.workingHours.end ||
      end.getHours() < appConfig.workingHours.start ||
      end.getHours() > appConfig.workingHours.end
    ) {
      setError("Booking time should be between 10am and 10pm")
      return
    }

    const isLessThanMin =
      timeDiffInMs(end, start) < ms(appConfig.bookingTime.min)
    const isMoreThanMax =
      timeDiffInMs(end, start) > ms(appConfig.bookingTime.max)

    if (isLessThanMin) {
      setError(`Booking time should be at least ${appConfig.bookingTime.min}`)
      return
    }

    if (isMoreThanMax) {
      setError(`Booking time should be at most ${appConfig.bookingTime.max}`)
      return
    }

    const tablesWithConfirmedReservations = tables.filter((table) =>
      table.reservations.some((reservation) => {
        const isConfirmed = reservation.status === ReservationStatus.CONFIRMED
        const isToday =
          dateDiffInDays(new Date(reservation.bookingDate), date) === 0

        const isConflicting =
          (timeDiffInMs(start, reservation.timeSlotStart) >= 0 &&
            timeDiffInMs(start, reservation.timeSlotEnd)) < 0 ||
          (timeDiffInMs(end, reservation.timeSlotStart) > 0 &&
            timeDiffInMs(end, reservation.timeSlotEnd) <= 0)

        return isConfirmed && isToday && isConflicting
      })
    )

    setMatchingTables(tablesWithConfirmedReservations)
  }, [date, tables, timeRange])

  return (
    <>
      <TailwindContainer className="rounded-md bg-white">
        <div className="mt-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-gray-900">
                  Manage Tables
                </h1>
                <p className="mt-2 text-sm text-gray-700">
                  A list of all the tables in the restaurant
                </p>
              </div>
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
                <span className="ml-2">Add table</span>
              </Button>
            </div>

            <div className="flex items-start justify-end gap-4">
              <DatePicker
                icon={<ClockIcon className="h-4 w-4" />}
                label="Filter by date"
                value={date}
                onChange={setDate}
                placeholder="Date"
                hideOutsideDates
                minDate={new Date()}
              />

              <div>
                <TimeRangeInput
                  w={300}
                  icon={<ClockIcon className="h-4 w-4" />}
                  label="Filter by time"
                  format="12"
                  value={timeRange}
                  onChange={setTimeRange}
                  placeholder="Filter by time"
                  error={!!error}
                />
                <p className="mt-1 text-xs text-red-500">{error}</p>
              </div>
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
                        Table No
                      </th>

                      <th
                        scope="col"
                        className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 md:pl-0"
                      >
                        Max Capacity
                      </th>

                      <th
                        scope="col"
                        className="relative py-3.5 pl-3 pr-4 sm:pr-6 md:pr-0"
                      ></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {tables.map((table) => {
                      const isTableAvailable =
                        matchingTables.filter((t) =>
                          t.reservations.some((r) => r.tableId === table.id)
                        ).length === 0
                          ? true
                          : false

                      return (
                        <tr key={table.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
                            <Indicator
                              dot
                              inline
                              offset={-8}
                              processing
                              disabled={!date || !timeRange[0] || !timeRange[1]}
                              color={isTableAvailable ? "green" : "red"}
                              size={7}
                              position="middle-end"
                            >
                              {table.no}
                            </Indicator>
                          </td>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
                            {table.capacity}
                          </td>
                          <td className="relative space-x-4 whitespace-nowrap py-4 pl-3 pr-4 text-left text-sm font-medium sm:pr-6 md:pr-0">
                            <div className="flex items-center gap-6">
                              <Button
                                loading={isSubmitting}
                                variant="subtle"
                                loaderPosition="right"
                                disabled={isWaiter}
                                onClick={() => {
                                  setSelectedTableId(table.id)
                                  setMode(MODE.edit)
                                }}
                              >
                                Edit
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
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
          setSelectedTableId(null)
          handleModal.close()
        }}
        title={clsx({
          "Edit table": mode === MODE.edit,
          "Add table": mode === MODE.add,
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
            <input hidden name="tableId" value={selectedTable?.id} />

            <TextInput
              name="no"
              label="Table No"
              defaultValue={selectedTable?.no}
              error={fetcher.data?.fieldErrors?.no}
              required
            />

            <NumberInput
              name="capacity"
              label="Capacity"
              defaultValue={selectedTable?.capacity}
              error={fetcher.data?.fieldErrors?.capacity}
              required
              min={1}
            />

            <div className="mt-1 flex items-center justify-end gap-4">
              <Button
                variant="subtle"
                disabled={isSubmitting}
                onClick={() => {
                  setSelectedTable(null)
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
                {mode === MODE.edit ? "Save changes" : "Add table"}
              </Button>
            </div>
          </fieldset>
        </fetcher.Form>
      </Drawer>
    </>
  )
}
