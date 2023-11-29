import type {Reservation} from '@prisma/client'
import {ReservationStatus} from '@prisma/client'
import appConfig from 'app.config'
import ms from 'ms'
import type {z} from 'zod'
import {db} from '~/db.server'
import {dateDiffInDays, timeDiffInMs} from '~/utils/date'
import type {CreateReservationSchema} from '../utils/zod.schema'
import {getAllTables} from './table.server'

export function getAllReservations() {
	return db.reservation.findMany({
		orderBy: [
			{
				status: 'desc',
			},
			{
				bookingDate: 'asc',
			},
		],
		include: {
			bill: true,
			order: {
				include: {
					items: {
						include: {
							menu: true,
						},
					},
				},
			},
			table: true,
			customer: true,
			waiter: true,
		},
	})
}

export async function createReservation(
	data: z.infer<typeof CreateReservationSchema>
) {
	if (appConfig.allotTableDirectly) {
		const tables = await getAllTables()

		// this is also happening in the client side
		// but we are doing it again here to make sure
		// that the table is not booked by someone else
		const freeTables = tables
			.filter(
				table =>
					!table.reservations.some(r => {
						const isConfirmed = r.status === ReservationStatus.CONFIRMED
						const isOnSameDay =
							dateDiffInDays(new Date(r.bookingDate), data.bookingDate) === 0
							const isConflicting =
							(timeDiffInMs(data.timeSlotStart, r.timeSlotStart) >= 0 &&
							timeDiffInMs(data.timeSlotStart, r.timeSlotEnd) < 0) ||
							(timeDiffInMs(data.timeSlotEnd, r.timeSlotStart) > 0 &&
							timeDiffInMs(data.timeSlotEnd, r.timeSlotEnd) <= 0);
						return isConfirmed && isOnSameDay && isConflicting
					}) && data.noOfPeople <= table.capacity
			)
			.sort((a, b) => a.capacity - b.capacity)

		if (freeTables.length === 0) {
			throw new Error('No free tables available')
		}

		return db.reservation.create({
			data: {
				bookingDate: data.bookingDate,
				noOfPeople: data.noOfPeople,
				customer: {
					create: {
						name: data.name,
						phoneNo: data.phoneNo,
					},
				},
				status: ReservationStatus.CONFIRMED,
				timeSlotStart: data.timeSlotStart,
				timeSlotEnd: data.timeSlotEnd,
				table: {
					connect: {
						id: freeTables[0].id,
					},
				},
			},
		})
	}

	return db.reservation.create({
		data: {
			bookingDate: data.bookingDate,
			noOfPeople: data.noOfPeople,
			customer: {
				create: {
					name: data.name,
					phoneNo: data.phoneNo,
				},
			},
			status: ReservationStatus.CONFIRMED,
			timeSlotStart: data.timeSlotStart,
			timeSlotEnd: data.timeSlotEnd,
		},
	})
}

export async function cancelReservation(reservationId: Reservation['id']) {
	const reservation = await db.reservation.findUniqueOrThrow({
		where: {id: reservationId},
		include: {
			table: true,
		},
	})

	if (reservation.table) {
		return db.reservation.update({
			where: {id: reservationId},
			data: {
				status: ReservationStatus.CANCELLED,
				table: {
					disconnect: true,
				},
				waiter: {
					disconnect: true,
				},
			},
		})
	}

	return db.reservation.update({
		where: {id: reservationId},
		data: {
			status: ReservationStatus.CANCELLED,
		},
	})
}

export async function cancelReservationCron() {
	const reservations = await db.reservation.findMany({
		where: {
			AND: [
				{
					bookingDate: {
						lte: new Date(),
					},
				},
				{
					status: ReservationStatus.CONFIRMED,
				},
				{
					table: {
						is: null,
					},
				},
				{
					bill: {
						is: null,
					},
				},
			],
		},
	})

	const previousReservations = reservations.filter(r => {
		return dateDiffInDays(r.bookingDate, new Date()) < 0
	})

	for (const reservation of previousReservations) {
		console.log('Cancelling reservation automatically for ', reservation.id)
		await cancelReservation(reservation.id)
	}

	const reservationToday = reservations.filter(r => {
		return dateDiffInDays(r.bookingDate, new Date()) === 0
	})

	for (const reservation of reservationToday) {
		if (
			timeDiffInMs(new Date(), reservation.timeSlotEnd) >
			ms(appConfig.bookingBuffer)
		) {
			console.log('Cancelling reservation automatically for ', reservation.id)
			await cancelReservation(reservation.id)
		}
	}
}
