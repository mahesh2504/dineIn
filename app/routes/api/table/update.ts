import type {ActionArgs} from '@remix-run/node'
import {json} from '@remix-run/node'
import invariant from 'tiny-invariant'
import {updateTable} from '~/lib/table.server'

export const action = async ({request}: ActionArgs) => {
	const formData = await request.formData()

	const reservationId = formData.get('reservationId')?.toString()
	invariant(reservationId, 'Reservation ID is required')

	const tableId = formData.get('tableId')?.toString()
	invariant(tableId, 'Table ID is required')

	const waiterId = formData.get('waiterId')?.toString()
	invariant(waiterId, 'Waiter ID is required')

	await updateTable({
		reservationId,
		tableId,
		waiterId,
	})

	return json({success: true, message: 'Reservation successfully cancelled'})
}
