import { Brand } from "@/components/ui/brand"
import { SubmitButton } from "@/components/ui/submit-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/server"
import { Database } from "@/supabase/types"
import { createServerClient } from "@supabase/ssr"
import { get } from "@vercel/edge-config"
import { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { IconBrandGoogle, IconAlertCircle } from "@tabler/icons-react"

export const metadata: Metadata = {
  title: "Login"
}

const errorMessages: Record<string, string> = {
  "1": "Email is not allowed to sign up.",
  "2": "Check your email to continue the sign-in process.",
  "3": "Check email to reset password.",
  "4": "Invalid credentials provided.",
  "5": "Signup requires a valid password.",
  "6": "Your password must be at least 8 characters long.",
  "7": "Your password must include both uppercase and lowercase letters.",
  "8": "Your password must include at least one number.",
  "9": "Your password must include at least one special character (e.g., !@#$%^&*()).",
  "10": "Password reset email sent. Check your email to continue.",
  "11": "The email address is not in a valid format.",
  auth: "Authentication failed. Please try again or contact support if the issue persists.",
  default: "An unexpected error occurred."
}

export default async function Login({
  searchParams
}: {
  searchParams: { message: string }
}) {
  let errorKey = "default"

  try {
    errorKey = decodeURIComponent(searchParams.message)
  } catch (e) {
    console.error("Failed to decode message:", e)
  }

  const errorMessage = errorMessages[errorKey] || errorMessages["default"]

  const cookieStore = cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        }
      }
    }
  )

  const { data: { user } = {} } = await supabase.auth.getUser()

  if (user) {
    const { data: homeWorkspace, error } = await supabase
      .from("workspaces")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_home", true)
      .single()

    if (!homeWorkspace) {
      throw new Error(error.message)
    }

    return redirect(`/${homeWorkspace.id}/chat`)
  }

  const signIn = async (formData: FormData) => {
    "use server"

    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const supabase = createClient(cookies())

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return redirect(`/login?message=11`)
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return redirect(`/login?message=4`)
    }

    const { data: homeWorkspace, error: homeWorkspaceError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("user_id", data.user.id)
      .eq("is_home", true)
      .single()

    if (!homeWorkspace) {
      throw new Error(
        homeWorkspaceError?.message || "An unexpected error occurred"
      )
    }

    return redirect(`/${homeWorkspace.id}/chat`)
  }

  const signUp = async (formData: FormData) => {
    "use server"

    const origin = headers().get("origin")
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return redirect(`/login?message=11`)
    }

    if (!password) {
      return redirect(`/login?message=5`)
    }

    const passwordChecks = [
      { test: password.length >= 8, message: "6" },
      { test: /[A-Z]/.test(password) && /[a-z]/.test(password), message: "7" },
      { test: /[0-9]/.test(password), message: "8" },
      {
        test: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(password),
        message: "9"
      }
    ]

    for (const check of passwordChecks) {
      if (!check.test) {
        return redirect(`/login?message=${check.message}`)
      }
    }

    let emailDomainWhitelist: string[] = []
    let emailWhitelist: string[] = []

    if (process.env.EMAIL_DOMAIN_WHITELIST || process.env.EDGE_CONFIG) {
      const patternsString =
        process.env.EMAIL_DOMAIN_WHITELIST ||
        (await get<string>("EMAIL_DOMAIN_WHITELIST"))
      emailDomainWhitelist = patternsString?.split(",") ?? []
    }

    if (process.env.EMAIL_WHITELIST || process.env.EDGE_CONFIG) {
      const patternsString =
        process.env.EMAIL_WHITELIST || (await get<string>("EMAIL_WHITELIST"))
      emailWhitelist = patternsString?.split(",") ?? []
    }

    if (
      (emailDomainWhitelist.length > 0 &&
        !emailDomainWhitelist.includes(email.split("@")[1])) ||
      (emailWhitelist.length > 0 && !emailWhitelist.includes(email))
    ) {
      return redirect(`/login?message=1`)
    }

    const supabase = createClient(cookies())

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // USE IF YOU WANT TO SEND EMAIL VERIFICATION, ALSO CHANGE TOML FILE
        emailRedirectTo: `${origin}/auth/callback`
      }
    })

    if (error) {
      return redirect(`/login?message=${error.message}`)
    }

    // return redirect("/setup")

    // USE IF YOU WANT TO SEND EMAIL VERIFICATION, ALSO CHANGE TOML FILE
    return redirect("/login?message=2")
  }

  const handleResetPassword = async (formData: FormData) => {
    "use server"

    const origin = headers().get("origin")
    const email = formData.get("email") as string
    const supabase = createClient(cookies())

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/login/password`
    })

    if (error) {
      return redirect(`/login?message=${error.message}`)
    }

    return redirect("/login?message=10")
  }

  const handleSignInWithGoogle = async () => {
    "use server"
    const supabase = createClient(cookies())
    const origin = headers().get("origin")

    const { error, data } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/login`
      }
    })

    if (error) {
      return redirect(`/login?message=${error.message}`)
    }

    return redirect(data.url)
  }

  return (
    <div className="flex w-full flex-1 flex-col justify-center gap-2 px-8 sm:max-w-md">
      <div>
        <form className="animate-in text-foreground flex w-full flex-1 flex-col justify-center gap-2">
          <Brand />

          <SubmitButton
            className="mt-4 rounded-md border border-gray-600 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            variant="secondary"
            role="button"
            formAction={handleSignInWithGoogle}
          >
            <IconBrandGoogle className="mr-1" size={20} />
            Continue with Google
          </SubmitButton>
        </form>
        <div className="mt-4 flex items-center">
          <div className="grow border-t border-gray-300"></div>
          <span className="mx-4 text-sm text-black dark:text-white">OR</span>
          <div className="grow border-t border-gray-300"></div>
        </div>
        <form
          action={signIn}
          className="animate-in text-foreground mt-4 flex w-full flex-1 flex-col justify-center gap-2"
        >
          <Label className="text-md" htmlFor="email">
            Email
          </Label>
          <Input
            className="mb-3 rounded-md border bg-inherit px-4 py-2"
            name="email"
            placeholder="you@example.com"
            required
          />
          <div className="text-muted-foreground mb-3 flex items-center text-sm">
            <IconAlertCircle className="mr-2" size={16} />
            Temporary or non-TLS emails will not work
          </div>

          <Label className="text-md" htmlFor="password">
            Password
          </Label>
          <Input
            className="mb-6 rounded-md border bg-inherit px-4 py-2"
            type="password"
            name="password"
            placeholder="••••••••"
          />

          <SubmitButton className="mb-2 rounded-md bg-blue-700 px-4 py-2 text-white hover:bg-blue-800">
            Login
          </SubmitButton>

          <SubmitButton
            formAction={signUp}
            className="border-foreground/20 mb-2 rounded-md border px-4 py-2 hover:border-gray-400"
          >
            Sign Up
          </SubmitButton>

          {searchParams?.message && (
            <p className="bg-foreground/10 text-foreground mt-2 p-4 text-center">
              {errorMessage}
            </p>
          )}

          <div className="text-muted-foreground mt-1 flex flex-col items-center text-sm sm:flex-row">
            <span>By using PentestGPT, you agree to our&nbsp;</span>
            <a
              href="/terms"
              target="_blank"
              className="text-primary underline hover:opacity-80"
            >
              Terms of Use
            </a>
          </div>

          <div className="text-muted-foreground mt-1 flex justify-center text-sm">
            <span className="mr-1">Forgot your password?</span>
            <button
              formAction={handleResetPassword}
              className="text-primary ml-1 underline hover:opacity-80"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
