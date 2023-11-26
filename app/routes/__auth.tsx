import type { LoaderFunction } from "@remix-run/node"
import { redirect } from "@remix-run/node"
import { Outlet } from "@remix-run/react"
import { getUser } from "~/session.server"

export const loader: LoaderFunction = async ({ request }) => {
  const user = await getUser(request)
  if (user) return redirect("/")

  return null
}

export default function AuthLayout() {
  return (
    <>
      <div className="flex min-h-full">
        <div className="flex flex-1 flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20">
          <div className="mx-auto w-full max-w-sm lg:w-96">
            <Outlet />
          </div>
        </div>

        <div className="relative hidden flex-1 lg:block">
          <img
            className="absolute inset-0 h-full w-full object-cover"
            src="https://images.unsplash.com/photo-1521447646709-74b6207f27b0?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8RGluZSUyMGlufGVufDB8fDB8fHww"
            alt=""
          />
        </div>
      </div>
    </>
  )
}
