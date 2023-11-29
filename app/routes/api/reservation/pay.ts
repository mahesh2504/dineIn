import {
	ReservationStatus,
	type PaymentMethod,
	PaymentStatus,
} from '@prisma/client'
import type {ActionArgs} from '@remix-run/node'
import {json} from '@remix-run/node'
import invariant from 'tiny-invariant'
import {db} from '~/db.server'

export const action = async ({request}: ActionArgs) => {
	const formData = await request.formData()

	const reservationId = formData.get('reservationId')?.toString()
	const amount = formData.get('amount')?.toString()
	const paymentMethod = formData.get('paymentMethod')?.toString()

	invariant(reservationId, 'Reservation ID is required')
	invariant(amount, 'Amount is required')
	invariant(paymentMethod, 'Payment method is required')
	const bill = await db.bill.findUnique({
		where: {
			reservationId,
		},
		include: {
			reservation: true,
		},
	})

	if (!bill) {
		throw new Error('Bill not found')
	}

	if (bill.netAmount > bill.amountPaid + Number(amount)) {
		await db.bill.update({
			where: {
				reservationId,
			},
			data: {
				paymenyMethod: paymentMethod as PaymentMethod,
				amountPaid: {
					increment: parseFloat(amount),
				},
			},
		})

		return json({success: true, message: 'Payment successfully made'})
	}

	if (bill.netAmount <= bill.amountPaid + Number(amount)) {
		await db.bill.update({
			where: {
				reservationId,
			},
			data: {
				paymenyMethod: paymentMethod as PaymentMethod,
				amountPaid: bill.netAmount,
				paymentStatus: PaymentStatus.PAID,
				reservation: {
					update: {
						status: ReservationStatus.COMPLETED,
					},
				},
			},
		})

		return json({success: true, message: 'Payment successfully made'})
	}

	return json({success: true, message: 'Reservation successfully cancelled'})
}
