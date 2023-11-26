import type {Menu} from '@prisma/client'
import {ObjectId} from 'bson'
import {db} from '~/db.server'

export function getAllMenuItems() {
	return db.menu.findMany({
		include: {
			orders: true,
		},
	})
}

export function createOrUpdateMenu(data: {
	itemId?: Menu['id']
	name: Menu['name']
	price: Menu['price']
}) {
	const {itemId, ...rest} = data
	const id = new ObjectId()

	return db.menu.upsert({
		where: {
			id: itemId || id.toString(),
		},
		update: {...rest},
		create: {...rest},
	})
}
