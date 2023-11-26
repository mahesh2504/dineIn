import {PrismaClient, Role} from '@prisma/client'
import {createPasswordHash} from '~/utils/misc.server'

const db = new PrismaClient()

async function seed() {
	await db.user.deleteMany({})
	await db.customer.deleteMany({})
	await db.order.deleteMany({})
	await db.menu.deleteMany({})
	await db.table.deleteMany({})
	await db.reservation.deleteMany({})
	await db.waiter.deleteMany({})
	await db.admin.deleteMany({})

	await db.user.create({
		data: {
			name: 'Molly',
			email: 'waiter@app.com',
			password: await createPasswordHash('password'),
			role: Role.WAITER,
		},
	})

	await db.waiter.create({
		data: {
			name: 'Molly',
			email: 'waiter@app.com',
			password: await createPasswordHash('password'),
		},
	})

	await db.user.create({
		data: {
			name: 'Max',
			email: 'admin@app.com',
			password: await createPasswordHash('password'),
			role: Role.MANAGER,
		},
	})

	await db.admin.create({
		data: {
			name: 'Max',
			email: 'admin@app.com',
			password: await createPasswordHash('password'),
		},
	})

	await db.table.createMany({
		data: seedTables,
	})

	await db.menu.createMany({
		data: seedMenus,
	})

	const password = await createPasswordHash('password')
	await db.user.createMany({
		data: seedWaiters.map(waiter => ({
			name: waiter.name,
			email: waiter.email,
			password,
			role: Role.WAITER,
		})),
	})

	console.log(`Database has been seeded. 🌱`)
}

seed()
	.catch(e => {
		console.error(e)
		process.exit(1)
	})
	.finally(async () => {
		await db.$disconnect()
	})

const seedTables = [
	{
		no: 'A1',
		capacity: 4,
	},
	{
		no: 'A2',
		capacity: 8,
	},
	{
		no: 'A3',
		capacity: 3,
	},
	{
		no: 'A4',
		capacity: 10,
	},
	{
		no: 'B1',
		capacity: 6,
	},
	{
		no: 'B2',
		capacity: 2,
	},
	{
		no: 'B3',
		capacity: 4,
	},
]

const seedMenus = [
	{
		name: 'Chicken Biryani',
		price: 32.99,
		category: ['Main Course'],
	},
	{
		name: 'Chicken Tikka Masala',
		price: 22.99,
		category: ['Appetizers'],
	},
	{
		name: 'Pizza',
		price: 19.99,
		category: ['Main Course'],
	},
	{
		name: 'Pasta',
		price: 15.99,
		category: ['Main Course'],
	},
	{
		name: 'Burger',
		price: 6.99,
		category: ['Main Course'],
	},
	{
		name: 'Fries',
		price: 3.99,
		category: ['Snacks'],
	},
	{
		name: 'Coke',
		price: 1.99,
		category: ['Beverages'],
	},
	{
		name: 'Sprite',
		price: 1.99,
		category: ['Beverages'],
	},
	{
		name: 'Pepsi',
		price: 1.99,
		category: ['Beverages'],
	},
	{
		name: 'Water',
		price: 1.99,
		category: ['Beverages'],
	},
]

const seedWaiters = [
	{
		name: 'M',
		email: 'm@waiter.app',
		password: 'password',
	},
	{
		name: 'N',
		email: 'n@waiter.app',
		password: 'password',
	},
]
