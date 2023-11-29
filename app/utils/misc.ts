import {PaymentMethod, ReservationStatus} from '@prisma/client'

export function round(number: number, precision: number = 2) {
	const d = Math.pow(10, precision)
	return Math.round((number + Number.EPSILON) * d) / d
}

export function titleCase(string: string) {
	string = string.toLowerCase()
	const wordsArray = string.split(' ')

	for (var i = 0; i < wordsArray.length; i++) {
		wordsArray[i] =
			wordsArray[i].charAt(0).toUpperCase() + wordsArray[i].slice(1)
	}

	return wordsArray.join(' ')
}

export function formatDate(date: Date | string) {
	return new Intl.DateTimeFormat('en', {
		month: 'short',
		day: '2-digit',
		year: 'numeric',
		weekday: 'short',
	}).format(new Date(date))
}

export function formatTime(date: Date | string) {
	return new Intl.DateTimeFormat('en', {
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(date))
}

export function formatList(list: Array<string>) {
	return new Intl.ListFormat('en').format(list)
}

export function formatCurrency(amount: number) {
	return new Intl.NumberFormat('en', {
		style: 'currency',
		currency: 'USD',
	}).format(amount)
}

export function paymentMethodLookup(method: PaymentMethod) {
	return {
		[PaymentMethod.CREDIT_CARD]: 'Credit Card',
		[PaymentMethod.DEBIT_CARD]: 'Debit Card',
	}[method]
}

// use intl phone number input to format phone number

export function formatPhoneNo(phoneNo: number) {
	return new Intl.NumberFormat('en', {
		style: 'phone',
	}).format(phoneNo)
}

export const categories = [
	'Appetizers',
	'Main Course',
	'Beverages',
	'Desserts',
	'Snacks',
]

export const splitBillOptions = [
	{
		label: 'No',
		value: '1',
	},
	{
		label: 'Two way',
		value: '2',
	},
	{
		label: 'Three way',
		value: '3',
	},
	{
		label: 'Four way',
		value: '4',
	},
	{
		label: 'Five way',
		value: '5',
	},
	{
		label: 'Six way',
		value: '6',
	},
]

export const reservationStatusLabelLookup = {
	[ReservationStatus.CANCELLED]: 'Cancelled',
	[ReservationStatus.CONFIRMED]: 'Confirmed',
	[ReservationStatus.COMPLETED]: 'Completed',
	[ReservationStatus.PENDING_PAYMENT]: 'Pending Payment',
} satisfies Record<ReservationStatus, string>

export const reservationStatusColorLookup = {
	[ReservationStatus.CANCELLED]: 'red',
	[ReservationStatus.CONFIRMED]: 'green',
	[ReservationStatus.COMPLETED]: 'blue',
	[ReservationStatus.PENDING_PAYMENT]: 'yellow',
} satisfies Record<ReservationStatus, string>
