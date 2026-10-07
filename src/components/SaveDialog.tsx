import { useState } from "react"
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save this loan</DialogTitle>
          <DialogDescription>Kept in this browser only. Nothing leaves your machine.</DialogDescription>
        </DialogHeader>
        <SaveForm initialName={initialName} exists={exists} onSave={onSave} onSaveCopy={onSaveCopy} />
      </DialogContent>
    </Dialog>
  )
}

/** Mounted fresh every time the dialog opens, so the name resets without an effect. */
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
  const [name, setName] = useState(initialName)
  const valid = name.trim().length > 0
  return (
    <>
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) onSave(name.trim())
          }}
        >
          <Label htmlFor="save-name">Name</Label>
          <Input id="save-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </form>
        <DialogFooter>
          {exists && (
            <Button variant="outline" disabled={!valid} onClick={() => onSaveCopy(name.trim())}>
              Save as copy
            </Button>
          )}
          <Button disabled={!valid} onClick={() => onSave(name.trim())}>
            {exists ? "Update" : "Save"}
          </Button>
        </DialogFooter>
    </>
  )
}
