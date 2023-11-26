const MS_PER_DAY = 1000 * 60 * 60 * 24

// a and b are javascript Date objects
export function dateDiffInDays(a: Date, b: Date) {
	// Discard the time and time-zone information.
	const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
	const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())

	return Math.abs(Math.floor((utc2 - utc1) / MS_PER_DAY))
}

export function timeDiffInMs(a: Date | string, b: Date | string) {
	const date1 = new Date(a)
	const date2 = new Date(b)

	date1.setFullYear(2099, 0, 0)
	date2.setFullYear(2099, 0, 0)

	return date1.getTime() - date2.getTime()
}

export function timeDiffBetweenDate(a: Date | string, b: Date | string) {
	const date1 = new Date(a)
	const date2 = new Date(b)

	return date1.getTime() - date2.getTime()
}
