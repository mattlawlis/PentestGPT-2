import { Button } from "@/components/ui/button"
import { PentestGPTContext } from "@/context/context"
import { getCheckoutUrl } from "@/lib/server/stripe-url"
import * as Sentry from "@sentry/nextjs"
import {
  IconCircleCheckFilled,
  IconLockOpen,
  IconX,
  IconLoader2
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { FC, useContext, useState, useEffect } from "react"
import { toast } from "sonner"
import { TransitionedDialog } from "../ui/transitioned-dialog"
import { DialogPanel } from "@headlessui/react"

interface PlanDialogProps {
  showIcon?: boolean
  open?: boolean
  onOpenChange?: (value: boolean) => void
}

export const PlanDialog: FC<PlanDialogProps> = ({
  showIcon = true,
  open,
  onOpenChange
}) => {
  const router = useRouter()
  const { profile, isMobile } = useContext(PentestGPTContext)
  const [showDialog, setShowDialog] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null) // State to store the fetched URL
  const [isLoading, setIsLoading] = useState(false) // State to track loading status

  useEffect(() => {
    if (!profile || !showDialog) return

    const fetchStripeCheckoutUrl = async () => {
      const result = await getCheckoutUrl()

      if (result.type === "error") {
        Sentry.withScope(scope => {
          scope.setExtras({ userId: profile.user_id })
          scope.captureMessage(result.error.message)
        })
        toast.error(result.error.message)
      } else {
        setCheckoutUrl(result.value)
      }
    }

    fetchStripeCheckoutUrl()
  }, [showDialog, profile?.user_id])

  const handleOpenChange = (value: boolean) => {
    setShowDialog(value)
    if (onOpenChange) onOpenChange(value)
  }

  const handleUpgradeClick = async () => {
    if (checkoutUrl) {
      router.push(checkoutUrl)
    } else if (!isLoading && profile) {
      setIsLoading(true)
      const result = await getCheckoutUrl()
      setIsLoading(false)
      if (result.type === "error") {
        Sentry.withScope(scope => {
          scope.setExtras({ userId: profile.user_id })
          scope.captureMessage(result.error.message)
        })
        toast.error(result.error.message)
      } else {
        router.push(result.value)
      }
    }
  }

  if (!profile) {
    return null
  }

  const show = open ?? showDialog

  return (
    <>
      {showIcon && (
        <IconLockOpen
          className="cursor-pointer hover:opacity-50"
          size={24}
          onClick={() => handleOpenChange(true)}
        />
      )}

      <TransitionedDialog isOpen={show} onClose={() => handleOpenChange(false)}>
        <DialogPanel className="bg-popover w-full max-w-3xl rounded-lg shadow-xl">
          <div className="p-6">
            <div className="br flex items-center justify-between border-gray-300 pb-4">
              <h2 className="text-lg font-semibold">
                {isMobile ? "" : "Upgrade your plan"}
              </h2>
              <IconX
                className="cursor-pointer text-gray-500 hover:opacity-50"
                size={22}
                onClick={() => handleOpenChange(false)}
              />
            </div>

            {isMobile ? (
              <div className="flex flex-col items-center p-4 text-center">
                <div className="mb-1">
                  <IconLockOpen size={42} />
                </div>
                <h3 className="text-2xl font-bold">Get PentestGPT Pro</h3>
                <h4 className="text-primary mb-4 text-base">
                  Unlock our most powerful model and advanced features
                </h4>
                <div className="border-secondary/50 flex w-full max-w-md flex-col items-center rounded-lg border p-4 text-left shadow-md">
                  <div className="w-full max-w-xs">
                    <ProsStatement>
                      <b>Early access to new features</b>
                    </ProsStatement>
                    <ProsStatement>
                      <b>Access to PGPT-4, GPT-4o, PGPT-3.5</b>
                    </ProsStatement>
                    <ProsStatement>
                      <b>Access to advanced features</b>
                    </ProsStatement>
                    <Description>
                      Vision, web browsing and code interpreter
                    </Description>
                    <ProsStatement>
                      <b>Access to advanced tools</b>
                    </ProsStatement>
                    <Description>
                      Nuclei, SQLi Exploiter, PortScanner, and more
                    </Description>
                  </div>
                </div>
                <div className="mt-4 w-full max-w-md">
                  <Button
                    variant="custom_accent1"
                    onClick={handleUpgradeClick}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading && (
                      <IconLoader2 size={22} className="animate-spin" />
                    )}
                    <span className="ml-1 text-white">Upgrade to Pro</span>
                  </Button>
                  <p className="text-primary mt-2 text-xs">
                    Auto-renews for $29/month until canceled
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-1">
                <div className="mb-2 grid grid-cols-1 gap-8 sm:grid-cols-2">
                  <div className="mb-4 flex-1 rounded-lg sm:mb-0">
                    <h3 className="mb-2 text-lg font-bold">Free</h3>
                    <button
                      className="mb-4 w-full rounded bg-[#8e8ea0] px-4 py-2 text-[#28292c]"
                      disabled
                    >
                      Your current plan
                    </button>
                    <FreePlanStatement>Regular model updates</FreePlanStatement>
                    <FreePlanStatement>
                      Limited access to PGPT-3.5
                    </FreePlanStatement>
                    <FreePlanStatement>
                      Limited access to plugins
                    </FreePlanStatement>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="mb-2 text-lg font-bold">Pro</h3>
                      <div className="mb-2 text-lg text-[#8e8ea0]">
                        USD 29/month
                      </div>
                    </div>
                    <div className="mb-4 grid grid-cols-1 gap-1">
                      <Button
                        variant="custom_accent1"
                        onClick={handleUpgradeClick}
                        disabled={isLoading}
                      >
                        {isLoading && (
                          <IconLoader2 size={22} className="animate-spin" />
                        )}
                        <span className="ml-1 text-white">Upgrade to Pro</span>
                      </Button>
                    </div>
                    <ProsStatement>Early access to new features</ProsStatement>
                    <ProsStatement>
                      Access to PGPT-4, GPT-4o, PGPT-3.5
                    </ProsStatement>
                    <ProsStatement>
                      Access to advanced tools like Nuclei, SQLi Exploiter,
                      PortScanner, and more
                    </ProsStatement>
                    <ProsStatement>
                      Access to vision, web browsing, and code interpreter
                    </ProsStatement>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogPanel>
      </TransitionedDialog>
    </>
  )
}

function ProsStatement({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center">
      <div className="icon-container mr-2">
        <IconCircleCheckFilled color={"#43A047"} size={22} strokeWidth={2} />
      </div>
      <div className="text-container flex-1 text-sm font-medium">
        <p>{children}</p>
      </div>
    </div>
  )
}

function Description({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center pl-8">
      <div className="text-container flex-1 text-sm">
        <p>{children}</p>
      </div>
    </div>
  )
}

function FreePlanStatement({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center">
      <div className="icon-container mr-2">
        <IconCircleCheckFilled color={"#8e8ea0"} size={22} strokeWidth={2} />
      </div>
      <div className="text-container flex-1 text-sm">
        <p>{children}</p>
      </div>
    </div>
  )
}
