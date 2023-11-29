import {createEmotionCache, MantineProvider} from '@mantine/core'
import {ModalsProvider} from '@mantine/modals'
import {StylesPlaceholder} from '@mantine/remix'
import type {
	LinksFunction,
	LoaderArgs,
	MetaFunction,
	SerializeFrom,
} from '@remix-run/node'
import {json} from '@remix-run/node'
import {
	Links,
	LiveReload,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from '@remix-run/react'
import appConfig from 'app.config'
import {Toaster} from 'sonner'
import {getUser} from '~/session.server'
import styles from './styles/app.css'

const appendCache = createEmotionCache({key: 'mantine', prepend: false})

export const links: LinksFunction = () => {
	return [{rel: 'stylesheet', href: styles}]
}

export const meta: MetaFunction = () => ({
	charset: 'utf-8',
	title: appConfig.name,
	viewport: 'width=device-width,initial-scale=1',
})

export function Document({
	title,
	children,
}: {
	title?: string
	children: React.ReactNode
}) {
	return (
		<MantineProvider withNormalizeCSS emotionCache={appendCache}>
			<html lang="en" className="h-full">
				<head>
					{title ? <title>{title}</title> : null}
					<Meta />
					<Links />
					<StylesPlaceholder />
				</head>
				<body className="h-full">
					{children}
					<ScrollRestoration />
					<Scripts />
					<LiveReload />
				</body>
			</html>
		</MantineProvider>
	)
}

export type RootLoaderData = SerializeFrom<typeof loader>
export const loader = async ({request}: LoaderArgs) => {
	const user = await getUser(request)

	return json({user})
}

export default function App() {
	return (
		<Document>
			<ModalsProvider>
				<Toaster position="top-center" richColors />
				<Outlet />
			</ModalsProvider>
		</Document>
	)
}
