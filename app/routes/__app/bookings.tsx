/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import {ClockIcon, PlusIcon} from '@heroicons/react/24/solid'
import {
	Badge,
	Button,
	Drawer,
	Modal,
	NumberInput,
	Select,
	TextInput,
} from '@mantine/core'
import {DatePicker, TimeInput} from '@mantine/dates'
import {useDisclosure} from '@mantine/hooks'
import type {Reservation, User} from '@prisma/client'
import {PaymentMethod, ReservationStatus, Role} from '@prisma/client'
import type {ActionFunction, DataFunctionArgs} from '@remix-run/node'
import {json, redirect} from '@remix-run/node'
import {useFetcher} from '@remix-run/react'
import appConfig from 'app.config'
import ms from 'ms'
import * as React from 'react'
import {TailwindContainer} from '~/components/TailwindContainer'
import {createReservation} from '~/lib/reservation.server'
import {getUser} from '~/session.server'
import {dateDiffInDays, timeDiffInMs} from '~/utils/date'
import {useAppData} from '~/utils/hooks'
import {
	formatCurrency,
	formatDate,
	formatTime,
	reservationStatusColorLookup,
	reservationStatusLabelLookup,
	round,
	splitBillOptions,
} from '~/utils/misc'
import {badRequest} from '~/utils/misc.server'
import type {inferErrors} from '~/utils/validation'
import {validateAction} from '~/utils/validation'
import {CreateReservationSchema} from '~/utils/zod.schema'

export const loader = async ({request}: DataFunctionArgs) => {
	const user = await getUser(request)

	if (!user) {
		return redirect('/login')
	}

	if (user.role !== Role.MANAGER) {
		return redirect('/orders')
	}

	return json({})
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

export default function ManageCustomers() {
	const createFetcher = useFetcher<ActionData>()
	const {reservations, tables} = useAppData()

	const [isModalOpen, handleModal] = useDisclosure(false)
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
		if (
			createFetcher.state !== 'idle' &&
			createFetcher.submission === undefined
		) {
			return
		}

		if (createFetcher.data?.success) {
			handleModal.close()
			setBookingDate(new Date())
			setStartTime(null)
			setEndTime(null)
		}
		// handleModal is not meemoized, so we don't need to add it to the dependency array
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		createFetcher.data?.success,
		createFetcher.state,
		createFetcher.submission,
	])

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
			<TailwindContainer className="rounded-md bg-white">
				<div className="mt-8 sm:px-6 lg:px-8">
					<div className="sm:flex sm:flex-auto sm:items-center sm:justify-between">
						<div>
							<h1 className="text-3xl font-semibold text-gray-900">
								Manage Bookings
							</h1>
							<p className="mt-2 text-sm text-gray-700">
								A list of all the bookings
							</p>
						</div>
						<div>
							<Button
								loading={isCreating}
								loaderPosition="left"
								onClick={() => handleModal.open()}
							>
								<PlusIcon className="h-4 w-4" />
								<span className="ml-2">Add booking</span>
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
												Customer
											</th>

											<th
												scope="col"
												className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 md:pl-0"
											>
												Date/Time
											</th>

											<th
												scope="col"
												className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 md:pl-0"
											>
												No of people
											</th>

											<th
												scope="col"
												className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 md:pl-0"
											>
												Table
											</th>

											<th
												scope="col"
												className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 md:pl-0"
											>
												Waiter
											</th>

											<th
												scope="col"
												className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 md:pl-0"
											>
												Bill
											</th>

											<th
												scope="col"
												className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 md:pl-0"
											>
												Amount Paid
											</th>

											<th
												scope="col"
												className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 md:pl-0"
											>
												Status
											</th>

											<th
												scope="col"
												className="relative py-3.5 pl-3 pr-4 sm:pr-6 md:pr-0"
											></th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-200">
										{reservations.map(reservation => (
											<ReservationRow
												reservation={reservation}
												key={reservation.id}
											/>
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
				onClose={() => handleModal.close()}
				title="Create new reservation"
				position="right"
				padding="lg"
				overlayBlur={1.2}
				overlayOpacity={0.6}
				closeOnEscape={false}
				closeOnClickOutside={false}
			>
				<createFetcher.Form method="post" replace>
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

						<div className="mt-1 flex items-center justify-end gap-4">
							<Button
								variant="subtle"
								disabled={isCreating}
								onClick={() => handleModal.close()}
								color="red"
							>
								Cancel
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
			</Drawer>
		</>
	)
}

function ReservationRow({
	reservation,
}: {
	reservation: ReturnType<typeof useAppData>['reservations'][number]
}) {
	const {tables, waiters} = useAppData()
	const fetcher = useFetcher()
	const [isUpdateModalOpen, handleUpdateModal] = useDisclosure(false)
	const [isInvoiceModalOpen, handleInvoiceModal] = useDisclosure(false)
	const [isPaymentModalOpen, handlePaymentModal] = useDisclosure(false)

	const isCancelled = reservation.status === ReservationStatus.CANCELLED
	const isTableAlloted = reservation.tableId !== null
	const isBillGenerated = reservation.bill !== null
	const isPaymentDone = reservation.status === ReservationStatus.COMPLETED
	const hasOrderedItems = reservation.order?.items
		? reservation.order?.items.length > 0
		: false

	const isSubmitting = fetcher.state !== 'idle'

	const [tableId, setTableId] = React.useState<string | null>(
		reservation.tableId ? reservation.tableId : null
	)
	const [waiterId, setWaiterId] = React.useState<User['id'] | null>(
		waiters[0].id
	)
	const freeTables = React.useMemo(
		() =>
			tables.filter(
				table =>
					!table.reservations.some(r => {
						const isConfirmed = r.status === ReservationStatus.CONFIRMED
						const isOnSameDay =
							dateDiffInDays(
								new Date(r.bookingDate),
								new Date(reservation.bookingDate)
							) === 0
						const isConflicting =
							(timeDiffInMs(reservation.timeSlotStart, r.timeSlotStart) >= 0 &&
								timeDiffInMs(reservation.timeSlotStart, r.timeSlotEnd) < 0) ||
							(timeDiffInMs(reservation.timeSlotEnd, r.timeSlotStart) > 0 &&
								timeDiffInMs(reservation.timeSlotEnd, r.timeSlotEnd) <= 0)

						return isConfirmed && isOnSameDay && isConflicting
					}) && reservation.noOfPeople <= table.capacity
			),
		[
			reservation.bookingDate,
			reservation.noOfPeople,
			reservation.timeSlotEnd,
			reservation.timeSlotStart,
			tables,
		]
	)

	React.useEffect(() => {
		if (fetcher.state !== 'idle' && fetcher.submission === undefined) {
			return
		}

		if (fetcher.data?.success) {
			handleUpdateModal.close()
			handlePaymentModal.close()
			setTableId(null)
			setWaiterId(null)
		}
		// handleModal is not meemoized, so we don't need to add it to the dependency array
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fetcher.data?.success, fetcher.state, fetcher.submission])

	return (
		<>
			<tr key={reservation.id}>
				<td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
					<div className="flex flex-col">
						<div className="font-medium text-gray-900">
							{reservation.customer.name}
						</div>
						<div className="font-medium text-gray-500">
							{reservation.customer.phoneNo}
						</div>
					</div>
				</td>
				<td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
					<div className="flex flex-col">
						<div className="font-medium text-gray-900">
							{formatDate(reservation.bookingDate)}
						</div>
						<div className="font-medium text-gray-500">
							{formatTime(reservation.timeSlotStart)} -{' '}
							{formatTime(reservation.timeSlotEnd)}
						</div>
					</div>
				</td>
				<td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
					{reservation.noOfPeople}
				</td>
				<td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
					{reservation.table ? reservation.table.no : '-'}
				</td>
				<td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
					{reservation.waiter ? reservation.waiter.name : '-'}
				</td>
				<td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
					{reservation.bill ? formatCurrency(reservation.bill.netAmount) : '-'}
				</td>
				<td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
					{reservation.bill ? formatCurrency(reservation.bill.amountPaid) : '-'}
				</td>
				<td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 md:pl-0">
					<Badge
						className="max-w-min"
						variant="dot"
						fullWidth={false}
						color={reservationStatusColorLookup[reservation.status]}
					>
						{reservationStatusLabelLookup[reservation.status]}
					</Badge>
				</td>
				<td className="relative space-x-4 whitespace-nowrap py-4 pl-3 pr-4 text-left text-sm font-medium sm:pr-6 md:pr-0">
					<div className="flex items-center gap-6">
						{isCancelled ||
						reservation.status === ReservationStatus.COMPLETED ||
						reservation.status === ReservationStatus.PENDING_PAYMENT ||
						isTableAlloted ? null : (
							<Button
								variant="white"
								compact
								loaderPosition="right"
								disabled={isSubmitting || freeTables.length === 0}
								onClick={() => handleUpdateModal.open()}
							>
								{freeTables.length > 0 ? 'Allot table' : 'No table available'}
							</Button>
						)}

						{isBillGenerated && !isPaymentDone ? (
							<Button
								variant="white"
								loaderPosition="right"
								compact
								color="red"
								onClick={() => {
									handlePaymentModal.open()
									setTableId(reservation.tableId)
									setWaiterId(reservation.waiterId)
								}}
							>
								Make Payment
							</Button>
						) : null}

						{isBillGenerated && isPaymentDone ? (
							<Button
								variant="white"
								loaderPosition="right"
								compact
								onClick={() => handleInvoiceModal.open()}
							>
								View Invoice
							</Button>
						) : null}

						{isCancelled || (isTableAlloted && hasOrderedItems) ? null : (
							<Button
								variant="white"
								compact
								color="red"
								loaderPosition="right"
								disabled={isSubmitting}
								onClick={() =>
									fetcher.submit(
										{
											reservationId: reservation.id,
										},
										{
											method: 'post',
											action: '/api/reservation/cancel',
											replace: true,
										}
									)
								}
							>
								Cancel
							</Button>
						)}
					</div>
				</td>
			</tr>

			{/* Allot table modal */}
			<Drawer
				opened={isUpdateModalOpen}
				onClose={() => handleUpdateModal.close()}
				title="Manage table"
				position="right"
				padding="lg"
				overlayBlur={1.2}
				overlayOpacity={0.6}
				closeOnEscape={false}
				closeOnClickOutside={false}
			>
				<fetcher.Form method="post" replace action="/api/table/update">
					<fieldset disabled={isSubmitting} className="flex flex-col gap-4">
						<input hidden name="reservationId" defaultValue={reservation.id} />
						<Select
							name="tableId"
							label="Table"
							value={tableId}
							onChange={setTableId}
							data={freeTables.map(table => ({
								label: `Table ${table.no} - (Capacity: ${table.capacity})`,
								value: table.id,
							}))}
							error={
								freeTables.length === 0
									? `No free tables available for ${reservation.noOfPeople} people`
									: null
							}
						/>
						<Select
							name="waiterId"
							label="Waiter"
							value={waiterId}
							onChange={setWaiterId}
							data={waiters.map(waiter => ({
								label: waiter.name,
								value: waiter.id,
							}))}
						/>

						<div className="mt-1 flex items-center justify-end gap-4">
							<Button
								variant="subtle"
								disabled={isSubmitting}
								onClick={() => handleUpdateModal.close()}
								color="red"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								loading={isSubmitting}
								loaderPosition="right"
								disabled={!tableId || !waiterId}
							>
								Confirm table
							</Button>
						</div>
					</fieldset>
				</fetcher.Form>
			</Drawer>

			{/* Payment modal */}
			<Modal
				padding="lg"
				size="xl"
				opened={isPaymentModalOpen}
				onClose={() => handlePaymentModal.close()}
				title="Make Payment"
				overlayBlur={1.2}
				overlayOpacity={0.6}
			>
				<hr />
				<div className="flex items-center justify-between gap-4 py-2">
					<div className="flex items-center gap-4">
						<div className="flex flex-col">
							<span className="text-sm font-medium">Table No</span>
						</div>
					</div>
					<span className="text-sm font-medium">
						{reservation.table?.no || 'Not assigned'}
					</span>
				</div>

				<div className="flex items-center justify-between gap-4 py-2">
					<div className="flex items-center gap-4">
						<div className="flex flex-col">
							<span className="text-sm font-medium">Waiter</span>
						</div>
					</div>
					<span className="text-sm font-medium">
						{reservation.waiter?.name || 'Not assigned'}
					</span>
				</div>

				<hr className="pb-2" />
				{reservation.order?.items.map(item => (
					<div
						key={item.id}
						className="mt-2 flex items-center justify-between gap-4"
					>
						<div className="flex items-center gap-4">
							<div className="flex flex-col">
								<span className="text-sm font-medium">{item.menu.name}</span>
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

				<hr className="my-2" />
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<div className="flex flex-col">
							<span className="text-sm font-medium">Amount</span>
							<span className="text-xs text-gray-500">Total amount</span>
						</div>
					</div>
					<span className="text-sm font-medium">
						{formatCurrency(reservation.bill?.amount!)}
					</span>
				</div>

				<div className="mt-2 flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<div className="flex flex-col">
							<span className="text-sm font-medium">Tax</span>
							<span className="text-xs text-gray-500">Tax amount</span>
						</div>
					</div>
					<span className="text-sm font-medium">
						{formatCurrency(reservation.bill?.tax!)}
					</span>
				</div>

				<div className="mt-2 flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<div className="flex flex-col">
							<span className="text-sm font-medium">Tip</span>
							<span className="text-xs text-gray-500">Tip amount</span>
						</div>
					</div>
					<span className="text-sm font-medium">
						{formatCurrency(reservation.bill?.tip!)}
					</span>
				</div>

				<hr className="my-4" />
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<div className="flex flex-col">
							<span className="text-sm font-medium">Net Amount</span>
							<span className="text-xs text-gray-500">Net amount</span>
						</div>
					</div>
					<span className="text-sm font-medium">
						{formatCurrency(reservation.bill?.netAmount!)}
					</span>
				</div>

				<hr className="my-4" />
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<div className="flex flex-col">
							<span className="text-sm font-medium">Amount Paid</span>
							<span className="text-xs text-gray-500">Amount Paid</span>
						</div>
					</div>
					<span className="text-sm font-medium">
						{formatCurrency(reservation.bill?.amountPaid!)}
					</span>
				</div>

				{reservation.bill?.splitInto! > 1 ? (
					<>
						<hr className="my-4" />

						<div className="flex items-center justify-between gap-4">
							<div className="flex items-center gap-4">
								<div className="flex flex-col">
									<span className="text-sm font-medium">Total Split</span>
									<span className="text-xs text-gray-500">Total Split</span>
								</div>
							</div>
							<span className="text-sm font-medium">
								{reservation.bill?.splitInto!}
							</span>
						</div>

						<div className="flex items-center justify-between gap-4">
							<div className="flex items-center gap-4">
								<div className="flex flex-col">
									<span className="text-sm font-medium">Amount / split</span>
									<span className="text-xs text-gray-500">Amount / split</span>
								</div>
							</div>
							<span className="text-sm font-medium">
								{formatCurrency(
									round(
										reservation.bill?.netAmount! / reservation.bill?.splitInto!
									)
								)}
							</span>
						</div>
					</>
				) : null}

				<hr className="my-4" />
				<fetcher.Form
					id="paymentForm"
					className="mt-1 grid grid-cols-2 gap-4"
					onSubmit={e => {
						e.preventDefault()

						const formData = new FormData(e.currentTarget)

						const paymentMethod = formData.get('paymentMethod') as PaymentMethod
						const amount = formData.get('amount') as string

						fetcher.submit(
							{
								paymentMethod,
								reservationId: reservation.id,
								amount,
							},
							{
								method: 'post',
								action: '/api/reservation/pay',
								replace: true,
							}
						)
					}}
				>
					<Select
						data={Object.values(PaymentMethod).map(method => ({
							label: method.replace('_', ' '),
							value: method,
						}))}
						label="Payment Method"
						name="paymentMethod"
						defaultValue={PaymentMethod.CREDIT_CARD}
						required
					/>

					<TextInput
						pattern="^[0-9]{16}$"
						title="Card number should be 16 digits long"
						label="Card Number"
						name="cardNumber"
						placeholder="XXXX XXXX XXXX XXXX"
						defaultValue={1234567812341234}
						required
					/>

					<NumberInput
						pattern="^[0-9]{3}$"
						title="CVV should be 3 digits long"
						label="CVV"
						name="cvv"
						placeholder="XXX"
						defaultValue={123}
						required
					/>

					<DatePicker
						name="expiryDate"
						label="Expiry Date"
						hideOutsideDates
						inputFormat="MM/YYYY"
						labelFormat="MM/YYYY"
						defaultValue={new Date(1893456000000)}
						required
					/>

					<NumberInput
						min={round(
							reservation.bill?.netAmount! / reservation.bill?.splitInto!
						)}
						max={reservation.bill?.netAmount! - reservation.bill?.amountPaid!}
						label="Amount"
						name="amount"
						left="$"
						placeholder="Enter amount"
						required
						precision={2}
						defaultValue={round(
							reservation.bill?.netAmount! / reservation.bill?.splitInto!
						)}
						className="!col-start-2"
					/>
				</fetcher.Form>

				<hr className="my-4" />

				<div className="mt-1 flex items-center justify-end gap-4">
					<Button
						variant="subtle"
						disabled={isSubmitting}
						onClick={() => handlePaymentModal.close()}
						color="red"
					>
						Cancel
					</Button>
					<Button
						type="submit"
						loading={isSubmitting}
						loaderPosition="right"
						form="paymentForm"
						disabled={!tableId || !waiterId}
					>
						Pay
					</Button>
				</div>
			</Modal>

			{/* Invoice modal */}
			<Drawer
				padding="lg"
				size="xl"
				opened={isInvoiceModalOpen}
				onClose={() => handleInvoiceModal.close()}
				title="Billed Items"
				position="right"
				overlayBlur={1.2}
				overlayOpacity={0.6}
			>
				<hr />
				<div className="flex items-center justify-between gap-4 py-2">
					<div className="flex items-center gap-4">
						<div className="flex flex-col">
							<span className="text-sm font-medium">Table No</span>
						</div>
					</div>
					<span className="text-sm font-medium">
						{reservation.table?.no || 'Not assigned'}
					</span>
				</div>

				<div className="flex items-center justify-between gap-4 py-2">
					<div className="flex items-center gap-4">
						<div className="flex flex-col">
							<span className="text-sm font-medium">Waiter</span>
						</div>
					</div>
					<span className="text-sm font-medium">
						{reservation.waiter?.name || 'Not assigned'}
					</span>
				</div>

				{reservation.bill?.splitInto! > 1 ? (
					<div className="flex items-center justify-between gap-4 py-2">
						<div className="flex items-center gap-4">
							<div className="flex flex-col">
								<span className="text-sm font-medium">Split Into</span>
							</div>
						</div>
						<span className="text-sm font-medium">
							{
								splitBillOptions.find(
									option =>
										option.value === reservation.bill?.splitInto.toString()
								)?.label
							}
						</span>
					</div>
				) : null}

				<hr className="pb-2" />
				{reservation.order?.items.map(item => (
					<div
						key={item.id}
						className="mt-2 flex items-center justify-between gap-4"
					>
						<div className="flex items-center gap-4">
							<div className="flex flex-col">
								<span className="text-sm font-medium">{item.menu.name}</span>
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

				<hr className="my-2" />
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<div className="flex flex-col">
							<span className="text-sm font-medium">Amount</span>
							<span className="text-xs text-gray-500">Total amount</span>
						</div>
					</div>
					<span className="text-sm font-medium">
						{formatCurrency(reservation.bill?.amount!)}
					</span>
				</div>

				<div className="mt-2 flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<div className="flex flex-col">
							<span className="text-sm font-medium">Tax</span>
							<span className="text-xs text-gray-500">Tax amount</span>
						</div>
					</div>
					<span className="text-sm font-medium">
						{formatCurrency(reservation.bill?.tax!)}
					</span>
				</div>

				<div className="mt-2 flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<div className="flex flex-col">
							<span className="text-sm font-medium">Tip</span>
							<span className="text-xs text-gray-500">Tip amount</span>
						</div>
					</div>
					<span className="text-sm font-medium">
						{formatCurrency(reservation.bill?.tip!)}
					</span>
				</div>

				<hr className="my-4" />
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<div className="flex flex-col">
							<span className="text-sm font-medium">Net Amount</span>
							<span className="text-xs text-gray-500">Net amount</span>
						</div>
					</div>
					<span className="text-sm font-medium">
						{formatCurrency(reservation.bill?.netAmount!)}
					</span>
				</div>

				{reservation.bill?.splitInto! > 1 ? (
					<>
						<hr className="my-4" />
						{/* map an array with length of splitInto */}
						{Array.from(Array(reservation.bill?.splitInto!).keys()).map(
							(_, index) => {
								return (
									<div
										className="mt-2 flex items-center justify-between gap-4 first:mt-0"
										key={index}
									>
										<div className="flex items-center gap-4">
											<div className="flex flex-col">
												<span className="text-sm font-medium">
													Invoice {index + 1}
												</span>
												<span className="text-xs text-gray-500">Amount</span>
											</div>
										</div>
										<span className="text-sm font-medium">
											{formatCurrency(
												round(
													reservation.bill?.netAmount! /
														reservation.bill?.splitInto!
												)
											)}
										</span>
									</div>
								)
							}
						)}
					</>
				) : null}
			</Drawer>
		</>
	)
}
