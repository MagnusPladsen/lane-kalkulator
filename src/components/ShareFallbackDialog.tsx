import { useTranslation } from "react-i18next"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

/** Shown when the clipboard API is unavailable: the link, pre-selected, ready to copy by hand. */
export function ShareFallbackDialog({
  url,
  onOpenChange,
}: {
  url: string | null
  onOpenChange: (o: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={url !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("shareFallback.title")}</DialogTitle>
          <DialogDescription>{t("shareFallback.desc")}</DialogDescription>
        </DialogHeader>
        <Input
          readOnly
          aria-label={t("actions.copyLink")}
          value={url ?? ""}
          onFocus={(e) => e.currentTarget.select()}
          autoFocus
          className="font-mono text-xs"
        />
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
