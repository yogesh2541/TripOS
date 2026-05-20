"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { WhatsappTemplateCategory } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  TEMPLATE_CATEGORY_LABEL,
  extractTemplateVariables,
  interpolateTemplate,
} from "@/lib/whatsapp/templates";
import { upsertTemplateAction } from "@/server/actions/whatsapp";

type Variable = { key: string; label: string; example?: string };

const CATEGORIES: WhatsappTemplateCategory[] = [
  "PROPOSAL",
  "INVOICE",
  "PAYMENT_REMINDER",
  "FOLLOW_UP",
  "TRIP_REMINDER",
  "OPERATIONS",
  "UTILITY",
  "MARKETING",
  "CUSTOM",
];

type Initial = {
  id?: string | null;
  name?: string;
  templateId?: string;
  category?: WhatsappTemplateCategory;
  language?: string;
  bodyPreview?: string;
  variables?: Variable[];
  isActive?: boolean;
};

export function TemplateEditor({
  trigger,
  initial,
}: {
  trigger?: React.ReactNode;
  initial?: Initial;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [templateId, setTemplateId] = useState(initial?.templateId ?? "");
  const [category, setCategory] = useState<WhatsappTemplateCategory>(
    initial?.category ?? "CUSTOM"
  );
  const [language, setLanguage] = useState(initial?.language ?? "en");
  const [bodyPreview, setBodyPreview] = useState(initial?.bodyPreview ?? "");
  const [variables, setVariables] = useState<Variable[]>(initial?.variables ?? []);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});

  // Auto-detect placeholders in the body and merge them into the variable list
  // so editors don't have to keep them in sync by hand.
  useEffect(() => {
    const inBody = extractTemplateVariables(bodyPreview);
    setVariables((vs) => {
      const map = new Map(vs.map((v) => [v.key, v]));
      for (const k of inBody) if (!map.has(k)) map.set(k, { key: k, label: k });
      // drop variables no longer referenced in the body
      return Array.from(map.values()).filter((v) => inBody.includes(v.key));
    });
  }, [bodyPreview]);

  const rendered = useMemo(() => {
    const values: Record<string, string> = {};
    for (const v of variables) values[v.key] = sampleValues[v.key] || v.example || "";
    return interpolateTemplate(bodyPreview, values);
  }, [bodyPreview, sampleValues, variables]);

  function save() {
    if (!name.trim() || !templateId.trim() || !bodyPreview.trim()) {
      toast.error("Name, template id and body are required");
      return;
    }
    startTransition(async () => {
      try {
        await upsertTemplateAction({
          id: initial?.id ?? null,
          name: name.trim(),
          templateId: templateId.trim().toLowerCase(),
          category,
          language,
          bodyPreview,
          variables: variables.map((v) => ({
            key: v.key,
            label: v.label || v.key,
            example: v.example,
          })),
          isActive,
        });
        toast.success("Template saved");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  function setVarField(idx: number, patch: Partial<Variable>) {
    setVariables((vs) => vs.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" />
            New template
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {initial?.id ? "Edit template" : "New WhatsApp template"}
          </DialogTitle>
          <DialogDescription>
            Register the template here for in-app editing. Once Meta approves
            the matching template, sends will go via the template API; until
            then, the rendered body is sent as plain text.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Display name</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Proposal share"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-id">Meta template id</Label>
                <Input
                  id="tpl-id"
                  value={templateId}
                  onChange={(e) =>
                    setTemplateId(e.target.value.replace(/\s+/g, "_").toLowerCase())
                  }
                  placeholder="tc_proposal_share"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-lang">Language</Label>
                <Input
                  id="tpl-lang"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="en"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as WhatsappTemplateCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {TEMPLATE_CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-body">Body</Label>
              <Textarea
                id="tpl-body"
                rows={9}
                value={bodyPreview}
                onChange={(e) => setBodyPreview(e.target.value)}
                placeholder={"Hi {{name}} ✨\nYour proposal for {{destination}} is ready: {{proposal_link}}"}
              />
              <p className="text-[10px] text-muted-foreground">
                Use {"{{name}}"} placeholders — they'll show up in the variables
                list below.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Variables
              </Label>
              {variables.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Add {"{{placeholders}}"} to the body — they appear here.
                </p>
              ) : (
                <div className="space-y-2">
                  {variables.map((v, idx) => (
                    <div
                      key={v.key}
                      className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center"
                    >
                      <Input
                        value={v.key}
                        readOnly
                        className="bg-ivory text-muted-foreground"
                      />
                      <Input
                        value={v.label}
                        onChange={(e) => setVarField(idx, { label: e.target.value })}
                        placeholder="Display label"
                      />
                      <Input
                        value={v.example ?? ""}
                        onChange={(e) =>
                          setVarField(idx, { example: e.target.value })
                        }
                        placeholder="Example"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setVariables((vs) => vs.filter((_, i) => i !== idx))
                        }
                        className="text-muted-foreground hover:text-red-700"
                        aria-label="Remove variable"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="tpl-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <Label htmlFor="tpl-active" className="text-xs">
                Active
              </Label>
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Preview
            </Label>
            <motion.div
              key={rendered}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="mt-1.5 rounded-2xl border border-line bg-[#E5DDD5] p-3 min-h-[12rem]"
            >
              <div className="rounded-2xl bg-white px-3.5 py-2.5 shadow-soft text-[13px] leading-relaxed text-ink whitespace-pre-wrap max-w-[36ch]">
                {rendered || (
                  <span className="italic text-muted-foreground">
                    Body preview
                  </span>
                )}
              </div>
            </motion.div>

            {variables.length > 0 ? (
              <div className="mt-3 space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Sample values
                </Label>
                {variables.map((v) => (
                  <Input
                    key={v.key}
                    value={sampleValues[v.key] ?? ""}
                    onChange={(e) =>
                      setSampleValues((s) => ({ ...s, [v.key]: e.target.value }))
                    }
                    placeholder={v.example || v.key}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
