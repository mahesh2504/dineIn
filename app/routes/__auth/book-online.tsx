import {ClockIcon} from '@heroicons/react/24/solid'
import {Button, NumberInput, TextInput} from '@mantine/core'
import {DatePicker, TimeInput} from '@mantine/dates'
import type {Reservation} from '@prisma/client'
import {ReservationStatus} from '@prisma/client'
import type {ActionFunction} from '@remix-run/node'
import {json} from '@remix-run/node'
import {useFetcher, useLoaderData, useNavigate} from '@remix-run/react'
import appConfig from 'app.config'
import ms from 'ms'
import * as React from 'react'
import {toast} from 'sonner'
import {createReservation} from '~/lib/reservation.server'
import {getAllTables} from '~/lib/table.server'
import {dateDiffInDays, timeDiffInMs} from '~/utils/date'
import {badRequest} from '~/utils/misc.server'
import type {inferErrors} from '~/utils/validation'
import {validateAction} from '~/utils/validation'
import {CreateReservationSchema} from '~/utils/zod.schema'

export const loader = async () => {
	const tables = await getAllTables()

	return json({
		tables,
	})
}

interface ActionData {
	success: boolean
	fieldErrors?: inferErrors<typeof CreateReservationSchema>
}

export const action: ActionFunction = async ({request}) => {
	const {fields, fieldErrors} = await validateAction(
		request,
		CreateReservationSchema
	)

	if (fieldErrors) {
		return badRequest<ActionData>({success: false, fieldErrors})
	}

	return createReservation(fields)
		.then(() => json({success: true}))
		.catch(e => {
			console.error(e)
			return badRequest<ActionData>({
				success: false,
				fieldErrors: {
					bookingDate: e.message,
				},
			})
		})
}

export default function BookOnline() {
	const navigate = useNavigate()
	const createFetcher = useFetcher<ActionData>()
	const {tables} = useLoaderData<typeof loader>()

	const [bookingDate, setBookingDate] = React.useState<Date | null>(new Date())
	const [noOfPeople, setNoOfPeople] = React.useState<
		Reservation['noOfPeople'] | undefined
	>(1)
	const [startTime, setStartTime] = React.useState<Date | null>(null)
	const [endTime, setEndTime] = React.useState<Date | null>(null)
	const [error, setError] = React.useState<string | null>(null)
	const [enableSubmit, setEnableSubmit] = React.useState(false)

	const isCreating = createFetcher.state !== 'idle'

	React.useEffect(() => {
		if (isCreating || !createFetcher.data) {
			return
		}

		if (createFetcher.data.success) {
			toast.success("Booking created successfully! We'll contact you soon.")

			setBookingDate(new Date())
			setStartTime(null)
			setEndTime(null)

			navigate('..')
		}
	}, [createFetcher.data, isCreating, navigate])

	React.useEffect(() => {
		setEnableSubmit(false)
		setError(null)

		if (!bookingDate || !startTime || !endTime || !noOfPeople) return

		const combinedStartTime = new Date(bookingDate)
		combinedStartTime.setHours(startTime.getHours())
		combinedStartTime.setMinutes(startTime.getMinutes())

		const currentTime = new Date()
		if (combinedStartTime <= currentTime) {
			setError('Booking date and start time should be in the future')
			return
		}

		if (timeDiffInMs(startTime, endTime) >= 0) {
			setError('Start time must be before end time')
			return
		}

		// booking time should be between 10am and 10pm
		if (
			startTime.getHours() < appConfig.workingHours.start ||
			startTime.getHours() > appConfig.workingHours.end ||
			endTime.getHours() < appConfig.workingHours.start ||
			endTime.getHours() > appConfig.workingHours.end
		) {
			setError('Booking time should be between 10am and 10pm')
			return
		}

		const isLessThanMin =
			timeDiffInMs(endTime, startTime) < ms(appConfig.bookingTime.min)
		const isMoreThanMax =
			timeDiffInMs(endTime, startTime) > ms(appConfig.bookingTime.max)

		if (isLessThanMin) {
			setError(`Booking time should be at least ${appConfig.bookingTime.min}`)
			return
		}

		if (isMoreThanMax) {
			setError(`Booking time should be at most ${appConfig.bookingTime.max}`)
			return
		}

		const freeTables = tables.filter(
			table =>
				!table.reservations.some(r => {
					const isConfirmed = r.status === ReservationStatus.CONFIRMED
					const isOnSameDay =
						dateDiffInDays(new Date(r.bookingDate), bookingDate) === 0
					const isConflicting =
						(timeDiffInMs(startTime, r.timeSlotStart) >= 0 &&
							timeDiffInMs(startTime, r.timeSlotEnd) < 0) ||
						(timeDiffInMs(endTime, r.timeSlotStart) > 0 &&
							timeDiffInMs(endTime, r.timeSlotEnd) <= 0)

					return isConfirmed && isOnSameDay && isConflicting
				}) && noOfPeople <= table.capacity
		)

		if (freeTables.length === 0) {
			setError('No table available for the selected time')
			return
		}

		setEnableSubmit(true)
	}, [bookingDate, endTime, noOfPeople, startTime, tables])

	return (
		<>
			<h1 className="mt-6 text-4xl font-extrabold text-gray-900">
				Book Online!
			</h1>

			<createFetcher.Form method="post" replace className="mt-8">
				<fieldset disabled={isCreating} className="flex flex-col gap-4">
					<TextInput
						name="name"
						label="Name"
						error={createFetcher.data?.fieldErrors?.name}
						required
					/>

					<NumberInput
						name="phoneNo"
						label="Phone No"
						error={createFetcher.data?.fieldErrors?.phoneNo}
						required
						hideControls
						min={1}
					/>

					<NumberInput
						name="noOfPeople"
						label="No of People"
						value={noOfPeople}
						onChange={setNoOfPeople}
						error={createFetcher.data?.fieldErrors?.noOfPeople}
						required
						min={1}
					/>

					<DatePicker
						name="bookingDate"
						label="Booking Date"
						hideOutsideDates
						value={bookingDate}
						onChange={setBookingDate}
						minDate={new Date()}
						required
					/>

					<div className="grid grid-cols-2 gap-4">
						<TimeInput
							icon={<ClockIcon className="h-4 w-4" />}
							label="Start Time"
							format="12"
							withAsterisk
							value={startTime}
							onChange={setStartTime}
							placeholder="Select start time"
						/>
						<input
							hidden
							name="timeSlotStart"
							value={startTime?.toISOString()}
						/>

						<TimeInput
							icon={<ClockIcon className="h-4 w-4" />}
							label="End Time"
							format="12"
							value={endTime}
							onChange={setEndTime}
							placeholder="Select end time"
							withAsterisk
						/>
						<input hidden name="timeSlotEnd" value={endTime?.toISOString()} />
					</div>

					<p className="text-sm text-red-500">{error}</p>

					<div className="mt-1 flex items-center justify-between gap-4">
						<Button
							variant="outline"
							disabled={isCreating}
							onClick={() => navigate('..')}
						>
							Back
						</Button>
						<Button
							type="submit"
							loading={isCreating}
							loaderPosition="right"
							disabled={!enableSubmit}
						>
							Confirm reservation
						</Button>
					</div>
				</fieldset>
			</createFetcher.Form>
		</>
	)
}
