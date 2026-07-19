"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Home, Plus, Search, UserPlus } from "lucide-react";
import { createCustomer, createEstimate } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

/**
 * Centered setup modal: customer (with New customer), job name, Interior/Exterior.
 * Creates the estimate on Continue, then opens the room picker for that kind.
 */
export function NewEstimateClient({
  customers: initialCustomers,
  customerId: preselectedCustomerId,
  jobId,
}: {
  customers: CustomerOption[];
  customerId?: string;
  jobId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState(preselectedCustomerId ?? "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [title, setTitle] = useState("New Estimate");
  const [kind, setKind] = useState<"interior" | "exterior" | "both">(
    "interior"
  );
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  // Prefill search label when arriving with a customerId
  useEffect(() => {
    if (!preselectedCustomerId) return;
    const c = customers.find((x) => x.id === preselectedCustomerId);
    if (c) {
      setCustomerQuery(c.name);
      setTitle(`${c.name} Estimate`);
    }
  }, [preselectedCustomerId, customers]);

  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;
  const query = customerQuery.trim();
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return [];
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone ?? "").includes(q) ||
          (c.email ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [customers, query]);

  // Only open the dropdown after the user starts typing a search.
  const showCustomerList =
    !showNewCustomer &&
    query.length > 0 &&
    !(selectedCustomer && customerQuery === selectedCustomer.name);

  function pickCustomer(c: CustomerOption) {
    setCustomerId(c.id);
    setCustomerQuery(c.name);
    setShowNewCustomer(false);
    if (!title.trim() || title === "New Estimate" || title.endsWith(" Estimate")) {
      setTitle(`${c.name} Estimate`);
    }
  }

  function createNewCustomer() {
    if (!newCustomer.name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    start(async () => {
      try {
        const created = await createCustomer({
          name: newCustomer.name.trim(),
          phone: newCustomer.phone.trim(),
          email: newCustomer.email.trim(),
          address: newCustomer.address.trim(),
          city: newCustomer.city.trim(),
          state: newCustomer.state.trim(),
          zip: newCustomer.zip.trim(),
        });
        const option: CustomerOption = {
          id: created.id,
          name: created.name,
          phone: created.phone,
          email: created.email,
        };
        setCustomers((prev) =>
          [...prev, option].sort((a, b) => a.name.localeCompare(b.name))
        );
        pickCustomer(option);
        setShowNewCustomer(false);
        setNewCustomer({
          name: "",
          phone: "",
          email: "",
          address: "",
          city: "",
          state: "",
          zip: "",
        });
        toast.success("Customer added");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not add customer");
      }
    });
  }

  function continueSetup() {
    const jobTitle = title.trim() || "New Estimate";
    start(async () => {
      try {
        const estimate = await createEstimate({
          title: jobTitle,
          customerId: customerId || undefined,
          jobId,
        });
        router.replace(`/estimates/${estimate.id}?addRoom=${kind}`);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Failed to create estimate"
        );
      }
    });
  }

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#eef5fa_0%,_transparent_55%)]" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border bg-background shadow-xl">
        <div className="border-b bg-[linear-gradient(145deg,#f7fafc_0%,#eef5fa_48%,#e7f0f7_100%)] px-5 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            New estimate
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Set the customer and job type, then add the first room.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <Label className="text-[12px]">Job name</Label>
            <Input
              ref={titleRef}
              className="mt-1.5 h-10 text-[15px] font-medium"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Job name"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[12px]">Customer</Label>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:text-sky-900"
                onClick={() => {
                  setShowNewCustomer(true);
                  setCustomerId("");
                  setCustomerQuery("");
                  setNewCustomer((prev) => ({
                    ...prev,
                    name: customerQuery.trim(),
                  }));
                }}
              >
                <UserPlus className="h-3.5 w-3.5" />
                New customer
              </button>
            </div>

            {showNewCustomer ? (
              <div className="mt-1.5 space-y-2.5 rounded-xl border border-sky-200 bg-sky-50/40 px-3 py-3">
                <div className="text-[12px] font-semibold text-sky-900">
                  Add a new customer
                </div>
                <div>
                  <Label className="text-[11px]">Name *</Label>
                  <Input
                    className="mt-1 h-8"
                    value={newCustomer.name}
                    onChange={(e) =>
                      setNewCustomer((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Customer name"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Phone</Label>
                    <Input
                      className="mt-1 h-8"
                      value={newCustomer.phone}
                      onChange={(e) =>
                        setNewCustomer((p) => ({ ...p, phone: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Email</Label>
                    <Input
                      className="mt-1 h-8"
                      value={newCustomer.email}
                      onChange={(e) =>
                        setNewCustomer((p) => ({ ...p, email: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px]">Address</Label>
                  <Input
                    className="mt-1 h-8"
                    value={newCustomer.address}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        address: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <Label className="text-[11px]">City</Label>
                    <Input
                      className="mt-1 h-8"
                      value={newCustomer.city}
                      onChange={(e) =>
                        setNewCustomer((p) => ({ ...p, city: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">State</Label>
                    <Input
                      className="mt-1 h-8"
                      value={newCustomer.state}
                      onChange={(e) =>
                        setNewCustomer((p) => ({ ...p, state: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">ZIP</Label>
                    <Input
                      className="mt-1 h-8"
                      value={newCustomer.zip}
                      onChange={(e) =>
                        setNewCustomer((p) => ({ ...p, zip: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNewCustomer(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || !newCustomer.name.trim()}
                    onClick={createNewCustomer}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add & select
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative mt-1.5">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-10 pl-8"
                  value={customerQuery}
                  onChange={(e) => {
                    setCustomerQuery(e.target.value);
                    if (
                      selectedCustomer &&
                      e.target.value !== selectedCustomer.name
                    ) {
                      setCustomerId("");
                    }
                  }}
                  placeholder="Search customers…"
                />
                {showCustomerList ? (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border bg-background shadow-lg">
                    {filtered.length === 0 ? (
                      <div className="px-3 py-3 text-[12px] text-muted-foreground">
                        No matches.{" "}
                        <button
                          type="button"
                          className="font-semibold text-sky-700 hover:underline"
                          onClick={() => {
                            setShowNewCustomer(true);
                            setNewCustomer((prev) => ({
                              ...prev,
                              name: customerQuery.trim(),
                            }));
                          }}
                        >
                          Add new customer
                        </button>
                      </div>
                    ) : (
                      <ul className="py-1">
                        {filtered.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              className={cn(
                                "flex w-full flex-col px-3 py-2 text-left hover:bg-sky-50",
                                c.id === customerId && "bg-sky-50"
                              )}
                              onClick={() => pickCustomer(c)}
                            >
                              <span className="text-[13px] font-semibold text-slate-900">
                                {c.name}
                              </span>
                              {(c.phone || c.email) && (
                                <span className="text-[11px] text-slate-500">
                                  {[c.phone, c.email].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                        <li className="border-t">
                          <button
                            type="button"
                            className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[12px] font-semibold text-sky-700 hover:bg-sky-50"
                            onClick={() => {
                              setShowNewCustomer(true);
                              setNewCustomer((prev) => ({
                                ...prev,
                                name: customerQuery.trim(),
                              }));
                            }}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            New customer
                            {customerQuery.trim()
                              ? ` “${customerQuery.trim()}”`
                              : ""}
                          </button>
                        </li>
                      </ul>
                    )}
                  </div>
                ) : null}
                {selectedCustomer ? (
                  <p className="mt-1.5 text-[11px] text-emerald-700">
                    Selected: {selectedCustomer.name}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Optional — you can assign a customer later.
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <Label className="text-[12px]">Job type</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(
                [
                  {
                    id: "interior" as const,
                    label: "Interior",
                    hint: "Rooms",
                  },
                  {
                    id: "exterior" as const,
                    label: "Exterior",
                    hint: "Outside",
                  },
                  {
                    id: "both" as const,
                    label: "Both",
                    hint: "In & out",
                  },
                ] as const
              ).map((opt) => {
                const selected = kind === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setKind(opt.id)}
                    className={cn(
                      "rounded-xl border px-2.5 py-3 text-left transition-all sm:px-3",
                      selected
                        ? "border-sky-500 bg-sky-50 ring-1 ring-sky-200"
                        : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/50"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <Home
                        className={cn(
                          "h-4 w-4 shrink-0",
                          selected ? "text-sky-700" : "text-slate-400"
                        )}
                      />
                      <span
                        className={cn(
                          "text-[13px] font-semibold",
                          selected ? "text-sky-900" : "text-slate-800"
                        )}
                      >
                        {opt.label}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {opt.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-5 py-3">
          <Link
            href="/estimates"
            className="text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
          <Button
            size="sm"
            disabled={pending || !title.trim()}
            onClick={continueSetup}
          >
            {pending ? "Creating…" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
