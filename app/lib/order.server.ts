import type {Bill, Customer, Menu} from '@prisma/client'
import {PaymentMethod, ReservationStatus} from '@prisma/client'
import appConfig from 'app.config'
import {db} from '~/db.server'
import {round} from '~/utils/misc'

export async function addToOrder({
	customerId,
	menuId,
	quantity,
}: {
	customerId: Customer['id']
	menuId: Menu['id']
	quantity: number
}) {
	const menuItem = await db.menu.findUnique({
		where: {
			id: menuId,
		},
	})

	if (!menuItem) {
		throw new Error('Menu item not found')
	}

	const reservation = await db.reservation.findUnique({
		where: {
			customerId,
		},
		include: {
			order: true,
		},
	})

	if (!reservation) {
		throw new Error('Reservation not found')
	}

	if (reservation.order) {
		return db.order.update({
			where: {
				id: reservation.order.id,
			},
			data: {
				items: {
					create: {
						menuId,
						quantity,
						amount: menuItem.price * quantity,
					},
				},
			},
		})
	}

	return db.order.create({
		data: {
			reservationId: reservation.id,
			items: {
				create: {
					menuId,
					quantity,
					amount: menuItem.price * quantity,
				},
			},
		},
	})
}
export async function updateOrder({
	customerId,
	menuId,
	quantity,
}: {
	customerId: Customer['id']
	menuId: Menu['id']
	quantity: number
}) {
	const menuItem = await db.menu.findUnique({
		where: {
			id: menuId,
		},
	})

	if (!menuItem) {
		throw new Error('Menu item not found')
	}

	const reservation = await db.reservation.findUnique({
		where: {
			customerId,
		},
		include: {
			order: {
				include: {
					items: true,
				},
			},
		},
	})

	if (!reservation) {
		throw new Error('Reservation not found')
	}

	if (!reservation.order) {
		throw new Error('Order not found')
	}

	const existingItem = reservation.order.items.find(
		item => item.menuId === menuId
	)

	if (!existingItem) {
		throw new Error('Item not found')
	}

	if (quantity === 0) {
		return db.order.update({
			where: {
				id: reservation.order.id,
			},
			data: {
				items: {
					delete: {
						id: existingItem.id,
					},
				},
			},
		})
	}

	if (existingItem) {
		return db.menuOrder.update({
			where: {
				id: existingItem.id,
			},
			data: {
				quantity,
				amount: menuItem.price * quantity,
				sentToKitchen: false,
			},
		})
	}

	return db.order.update({
		where: {
			id: reservation.order.id,
		},
		data: {
			items: {
				create: {
					menuId,
					quantity,
					amount: menuItem.price * quantity,
				},
			},
		},
	})
}

export async function generateBill({
	customerId,
	tip,
	splitInto,
}: {
	customerId: Customer['id']
	tip: Bill['tip']
	splitInto: Bill['splitInto']
}) {
	return db.$transaction(async tx => {
		const reservation = await tx.reservation.findUnique({
			where: {
				customerId,
			},
			include: {
				table: true,
				order: {
					include: {
						items: true,
					},
				},
			},
		})

		if (!reservation) {
			throw new Error('Reservation not found')
		}

		if (!reservation.order) {
			throw new Error('Order not found')
		}

		const amount = reservation.order.items.reduce(
			(acc, item) => acc + item.amount,
			0
		)
		const tax = (amount * appConfig.taxPercent) / 100
		const netAmount = amount + tax + tip

		return tx.reservation.update({
			where: {
				id: reservation.id,
			},
			data: {
				status: ReservationStatus.COMPLETED,
				bill: {
					create: {
						amount,
						splitInto,
						paymenyMethod: PaymentMethod.CREDIT_CARD,
						orderId: reservation.order.id,
						tip,
						tax,
						netAmount: round(netAmount),
					},
				},
			},
		})
	})
}
