import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SaveDialog({
  open,
  onOpenChange,
  initialName,
  exists,
  onSave,
  onSaveCopy,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initialName: string
  exists: boolean
  onSave: (name: string) => void
  onSaveCopy: (name: string) => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("save.title")}</DialogTitle>
          <DialogDescription>{t("save.desc")}</DialogDescription>
        </DialogHeader>
        <SaveForm initialName={initialName} exists={exists} onSave={onSave} onSaveCopy={onSaveCopy} />
      </DialogContent>
    </Dialog>
  )
}

/** Mounted fresh each time the dialog opens, so the name resets without an effect. */
function SaveForm({
  initialName,
  exists,
  onSave,
  onSaveCopy,
}: {
  initialName: string
  exists: boolean
  onSave: (name: string) => void
  onSaveCopy: (name: string) => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(initialName || t("loan.namePlaceholder"))
  const valid = name.trim().length > 0
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave(name.trim())
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="save-name">{t("save.name")}</Label>
        <Input id="save-name" value={name} maxLength={80} autoComplete="off" onChange={(e) => setName(e.target.value)} />
      </div>
      <DialogFooter>
        {exists && (
          <Button type="button" variant="outline" disabled={!valid} onClick={() => onSaveCopy(name.trim())}>
            {t("save.copy")}
          </Button>
        )}
        <Button type="submit" disabled={!valid}>
          {exists ? t("save.update") : t("save.save")}
        </Button>
      </DialogFooter>
    </form>
  )
}
