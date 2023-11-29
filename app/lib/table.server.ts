import {
	ReservationStatus,
	type Reservation,
	type Table,
	type User,
} from '@prisma/client'
import {ObjectId} from 'bson'
import {db} from '~/db.server'

export function getAllTables() {
	return db.table.findMany({
		include: {
			reservations: {
				include: {
					bill: true,
					order: true,
					customer: true,
				},
			},
		},
	})
}

export function createOrUpdateTable(data: {
	tableId?: Table['id']
	no: Table['no']
	capacity: Table['capacity']
}) {
	const {tableId, ...rest} = data
	const id = new ObjectId()

	return db.table.upsert({
		where: {
			id: tableId || id.toString(),
		},
		update: {...rest},
		create: {...rest},
	})
}

export function updateTable({
	reservationId,
	tableId,
	waiterId,
}: {
	reservationId: Reservation['id']
	tableId: Table['id']
	waiterId: User['id']
}) {
	return db.$transaction(async tx => {
		const reservation = await tx.reservation.findUnique({
			where: {
				id: reservationId,
			},
			include: {
				table: true,
			},
		})

		if (!reservation) {
			throw new Error('Reservation not found')
		}

		return tx.reservation.update({
			where: {
				id: reservationId,
			},
			data: {
				status: ReservationStatus.CONFIRMED,
				waiter: {
					connect: {
						id: waiterId,
					},
				},
				table: {
					connect: {
						id: tableId,
					},
				},
			},
		})
	})
}
