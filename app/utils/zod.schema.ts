import {z} from 'zod'

const name = z.string().min(1, 'Name is required')
const email = z.string().email('Invalid email')
const password = z.string().min(8, 'Password must be at least 8 characters')

export const LoginSchema = z.object({
	email,
	password,
	remember: z.enum(['on']).optional(),
	redirectTo: z.string().default('/'),
})

export const RegisterUserSchema = z
	.object({
		name,
		email,
		password,
		confirmPassword: password,
	})
	.refine(data => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['password', 'confirmPassword'],
	})

export const ManageTableSchema = z.object({
	tableId: z.string().optional(),
	no: z.string().min(1, 'Table no is required'),
	capacity: z.preprocess(
		Number,
		z.number().min(0, 'Capacity must be greater than 0')
	),
})

export const ManageMenuItemSchema = z.object({
	itemId: z.string().optional(),
	name: z.string().min(1, 'Name is required'),
	price: z.preprocess(
		Number,
		z.number().min(0, 'Price must be greater than 0')
	),
	category: z
		.string()
		.min(1, 'Category is required')
		.transform(value => value.split(',')),
})

export const CreateReservationSchema = z.object({
	name: z.string().trim().min(1, 'Name is required'),
	phoneNo: z.string().trim().min(1, 'Phone no is required'),
	noOfPeople: z.preprocess(
		Number,
		z.number().min(0, 'No of people must be greater than 0')
	),
	bookingDate: z.preprocess(arg => {
		if (typeof arg == 'string' || arg instanceof Date) {
			return new Date(arg)
		}
	}, z.date()),
	timeSlotStart: z.preprocess(arg => {
		if (typeof arg == 'string' || arg instanceof Date) {
			return new Date(arg)
		}
	}, z.date()),
	timeSlotEnd: z.preprocess(arg => {
		if (typeof arg == 'string' || arg instanceof Date) {
			return new Date(arg)
		}
	}, z.date()),
})

export const ManageWaiterSchema = z.object({
	userId: z.string().optional(),
	name: z.string().min(1, 'Name is required'),
	email: z.string().email('Invalid email'),
	password: z.string().optional(),
})
