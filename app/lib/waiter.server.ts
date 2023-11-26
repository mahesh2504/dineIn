import type {User} from '@prisma/client'
import {Role} from '@prisma/client'
import {db} from '~/db.server'
import {createPasswordHash} from '~/utils/misc.server'

export function getAllWaiters() {
	return db.user.findMany({
		where: {
			role: Role.WAITER,
		},
		select: {
			id: true,
			email: true,
			name: true,
		},
	})
}

export async function createOrUpdateWaiter(data: {
	userId?: User['id']
	name: User['email']
	email: User['email']
	password?: User['password']
}) {
	const {userId, email, password, name} = data

	if (userId) {
		await db.waiter.update({
			where: {id: userId},
			data: {
				email,
				name,
			},
		})

		return db.user.update({
			where: {id: userId},
			data: {
				email,
				name,
			},
		})
	}

	if (!password) {
		throw new Error('Password is required for new waiter')
	}

	await db.waiter.create({
		data: {
			email,
			name,
			password: await createPasswordHash(password!),
		},
	})

	return db.user.create({
		data: {
			email,
			name,
			password: await createPasswordHash(password!),
		},
	})
}
