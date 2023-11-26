import type {User} from '@prisma/client'
import type {Role} from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import {db} from '~/db.server'
import {createPasswordHash} from '~/utils/misc.server'

export async function getUserById(id: string) {
	return db.user.findUnique({
		where: {id},
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
			hasResetPassword: true,
		},
	})
}

export async function getUserByEmail(email: string) {
	return db.user.findUnique({
		where: {email},
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
		},
	})
}

export async function verifyLogin({
	email,
	password,
}: {
	email: string
	password: string
	role?: Role
}) {
	const userWithPassword = await db.user.findUnique({
		where: {email},
	})

	if (!userWithPassword || !userWithPassword.password) {
		return null
	}

	const isValid = await bcrypt.compare(password, userWithPassword.password)
	if (!isValid) {
		return null
	}

	const {password: _password, ...userWithoutPassword} = userWithPassword
	return userWithoutPassword
}

export async function createUser({
	email,
	password,
	name,
}: {
	email: User['email']
	password: string
	name: User['name']
}) {
	return db.user.create({
		data: {
			name,
			email,
			password: await createPasswordHash(password),
		},
	})
}

export function getUserDetails(id: User['id']) {
	return db.user.findUnique({
		where: {id},
	})
}
