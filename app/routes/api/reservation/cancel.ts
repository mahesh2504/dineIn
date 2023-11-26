import type {ActionArgs} from '@remix-run/node'
import {json} from '@remix-run/node'
import invariant from 'tiny-invariant'
import {cancelReservation} from '~/lib/reservation.server'

export const action = async ({request}: ActionArgs) => {
	const formData = await request.formData()

	const reservationId = formData.get('reservationId')?.toString()
	invariant(reservationId, 'Reservation ID is required')

	await cancelReservation(reservationId)
	return json({success: true, message: 'Reservation successfully cancelled'})
}
