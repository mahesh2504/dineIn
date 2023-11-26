import {Button, Group, PasswordInput, Switch, TextInput} from '@mantine/core'
import type {ActionFunction} from '@remix-run/node'
import {useFetcher, useSearchParams} from '@remix-run/react'
import {verifyLogin} from '~/lib/user.server'
import {LoginSchema} from '~/utils/zod.schema'
import {createUserSession} from '~/session.server'
import {badRequest, safeRedirect} from '~/utils/misc.server'
import type {inferErrors} from '~/utils/validation'
import {validateAction} from '~/utils/validation'
import appConfig from 'app.config'

interface ActionData {
	fieldErrors?: inferErrors<typeof LoginSchema>
}

export const action: ActionFunction = async ({request}) => {
	const {fieldErrors, fields} = await validateAction(request, LoginSchema)

	if (fieldErrors) {
		return badRequest<ActionData>({fieldErrors})
	}

	const {email, password, redirectTo, remember} = fields

	const user = await verifyLogin({email, password})

	if (!user) {
		return badRequest<ActionData>({
			fieldErrors: {
				password: 'Invalid username or password',
			},
		})
	}

	return createUserSession({
		request,
		userId: user.id,
		role: user.role,
		remember: remember === 'on' ? true : false,
		redirectTo: safeRedirect(redirectTo),
	})
}

export default function Login() {
	const [searchParams] = useSearchParams()

	const fetcher = useFetcher<ActionData>()
	const actionData = fetcher.data

	const redirectTo = searchParams.get('redirectTo') || '/'
	const isSubmitting = fetcher.state !== 'idle'

	return (
		<>
			<h1 className="mt-6 text-4xl font-extrabold text-gray-900">
				{appConfig.name}
			</h1>
			<h2 className="mt-6 text-2xl font-extrabold text-gray-900">Sign in</h2>

			<fetcher.Form method="post" replace className="mt-8">
				<input type="hidden" name="redirectTo" value={redirectTo} />

				<fieldset disabled={isSubmitting} className="flex flex-col gap-4">
					<TextInput
						name="email"
						type="email"
						autoComplete="email"
						label="Email address"
						error={actionData?.fieldErrors?.email}
						required
					/>

					<PasswordInput
						name="password"
						label="Password"
						error={actionData?.fieldErrors?.password}
						autoComplete="current-password"
						required
					/>

					<Group position="apart" mt="1rem">
						<Switch id="remember-me" name="rememberMe" label="Remember me" />
					</Group>

					<Button
						type="submit"
						loading={isSubmitting}
						fullWidth
						loaderPosition="right"
						mt="1rem"
					>
						Sign in
					</Button>
				</fieldset>
			</fetcher.Form>
		</>
	)
}
