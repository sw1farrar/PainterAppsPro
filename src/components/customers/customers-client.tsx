"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { createCustomer, deleteCustomer, updateCustomer } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from "next/link";

type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  _count: { estimates: number; jobs: number };
};

const empty = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  notes: "",
};

export function CustomersClient({
  initial,
}: {
  initial: CustomerRow[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const filtered = initial.filter((c) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.city ?? "").toLowerCase().includes(q)
    );
  });

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(c: CustomerRow & { address?: string | null; zip?: string | null; notes?: string | null }) {
    setEditing(c.id);
    setForm({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      address: (c as { address?: string }).address ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
      zip: (c as { zip?: string }).zip ?? "",
      notes: (c as { notes?: string }).notes ?? "",
    });
    setOpen(true);
  }

  function save() {
    start(async () => {
      try {
        if (editing) {
          await updateCustomer(editing, form);
          toast.success("Customer updated");
        } else {
          const c = await createCustomer(form);
          toast.success("Customer created");
          setOpen(false);
          router.push(`/customers/${c.id}`);
          return;
        }
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  function confirmDelete() {
    if (!deleteId) return;
    start(async () => {
      await deleteCustomer(deleteId);
      toast.success("Customer deleted");
      setDeleteId(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
        <div>
          <h1 className="text-base font-semibold">Customers</h1>
          <p className="text-[11px] text-muted-foreground">
            {filtered.length} of {initial.length} customers
          </p>
        </div>
        <Button size="sm" className="h-8" onClick={openCreate}>
          <Plus className="size-3.5" />
          New Customer
        </Button>
      </header>

      <div className="border-b border-border bg-card px-4 py-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-7"
            placeholder="Search name, email, phone, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="p-4">
        <div className="panel overflow-hidden">
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th className="text-left">Name</th>
                <th className="text-left">Phone</th>
                <th className="text-left">Email</th>
                <th className="text-left">Location</th>
                <th className="text-right">Estimates</th>
                <th className="text-right">Jobs</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No customers match. Create one to get started.
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link
                      href={`/customers/${c.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td>{c.phone ?? "—"}</td>
                  <td className="text-muted-foreground">{c.email ?? "—"}</td>
                  <td className="text-muted-foreground">
                    {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="num">{c._count.estimates}</td>
                  <td className="num">{c._count.jobs}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => openEdit(c)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => setDeleteId(c.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editing ? "Edit Customer" : "New Customer"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-2.5">
            <Field label="Name *">
              <Input
                className="h-8"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Phone">
                <Input
                  className="h-8"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <Input
                  className="h-8"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Address">
              <Input
                className="h-8"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="City">
                <Input
                  className="h-8"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </Field>
              <Field label="State">
                <Input
                  className="h-8"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                />
              </Field>
              <Field label="ZIP">
                <Input
                  className="h-8"
                  value={form.zip}
                  onChange={(e) => setForm({ ...form, zip: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                className="min-h-[60px] text-[13px]"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={pending || !form.name}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the customer and cascaded jobs/estimates. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
