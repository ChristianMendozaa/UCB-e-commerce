"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  mode: "make" | "remove";            // make = hacer admin, remove = quitar admin
  careers: string[];                  // catálogo global del backend (para make)
  adminCareers?: string[];            // carreras que YA administra (para remove)
  onClose: () => void;
  onConfirm: (career: string) => Promise<void> | void;
  // NUEVO:
  isFetching?: boolean;               // cargando la lista de carreras (al abrir)
  isSaving?: boolean;                 // guardando acción (hacer/quitar)
};

export default function CareerPickerModal({
  open,
  mode,
  careers,
  adminCareers = [],
  onClose,
  onConfirm,
  isFetching = false,
  isSaving = false,
}: Props) {
  const [roleType, setRoleType] = useState<"career" | "platform">("career");
  const [useNew, setUseNew] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [custom, setCustom] = useState<string>("");

  // según el modo, las opciones provienen del catálogo o de las carreras que ya administra
  const options = mode === "remove" ? adminCareers : careers;

  useEffect(() => {
    if (open) {
      // reset cada vez que abre
      setRoleType("career");
      setUseNew(false);
      setSelected("");
      setCustom("");
    }
  }, [open]);

  const title = mode === "make" ? "Asignar Rol de Administrador" : "Quitar Rol de Administrador";

  // estados de UI bloqueada
  const disabledAll = isSaving || (mode === "make" && isFetching);

  const canSubmit = !disabledAll && (
    roleType === "platform" ||
    (useNew ? custom.trim().length > 0 : selected.trim().length > 0)
  );

  const handleConfirm = async () => {
    if (!canSubmit) return;

    if (roleType === "platform") {
      await onConfirm("__PLATFORM_ADMIN__");
      return;
    }

    const value = (useNew ? custom : selected).trim();
    if (!value) return;
    await onConfirm(value);
  };

  const selectPlaceholder =
    isFetching
      ? "Cargando carreras..."
      : options.length
        ? "Elige..."
        : mode === "remove"
          ? "No administra carreras"
          : "No hay carreras disponibles";

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent aria-busy={disabledAll}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Selector de Tipo de Rol (Solo para MAKE) */}
          {mode === "make" && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tipo de Administrador</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="roleType"
                    checked={roleType === "career"}
                    onChange={() => setRoleType("career")}
                    disabled={disabledAll}
                  />
                  <span className="text-sm">Por Carrera</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="roleType"
                    checked={roleType === "platform"}
                    onChange={() => setRoleType("platform")}
                    disabled={disabledAll}
                  />
                  <span className="text-sm font-bold text-primary">Platform Admin (Global)</span>
                </label>
              </div>
            </div>
          )}

          {/* Inputs de Carrera (Solo si es Career Admin) */}
          {roleType === "career" && (
            <div className="space-y-4 border-l-2 border-muted pl-4">
              <div className="space-y-2">
                <Label className="text-sm">Selecciona una carrera</Label>

                <Select
                  disabled={useNew || options.length === 0 || isFetching || isSaving}
                  value={selected || ""}
                  onValueChange={(v) => setSelected(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {mode === "remove" && !isFetching && options.length === 0 && (
                  <p className="text-xs text-muted-foreground">Este usuario no administra ninguna carrera.</p>
                )}
              </div>

              {/* Opción nueva carrera (sólo útil si falta en catálogo y es MAKE) */}
              {mode === "make" && (
                <div className="space-y-2">
                  <Label className="text-sm">¿No está en la lista?</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={useNew ? "default" : "outline"}
                      onClick={() => setUseNew((v) => !v)}
                      disabled={isFetching || isSaving}
                      size="sm"
                    >
                      {useNew ? "Usar selector" : "Introducir nueva carrera"}
                    </Button>
                  </div>
                  <Input
                    placeholder="Ej: SIS, ADM, ARQ"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    disabled={!useNew || isSaving}
                  />
                </div>
              )}
            </div>
          )}

          {roleType === "platform" && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ <strong>Cuidado:</strong> El Platform Admin tiene acceso total a todas las carreras, pedidos y productos del sistema.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>

          <Button type="button" disabled={!canSubmit} onClick={handleConfirm}>
            {isSaving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </span>
            ) : (
              "Confirmar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
