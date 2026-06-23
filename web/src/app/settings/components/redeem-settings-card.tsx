"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Save, TicketPercent, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createRedeemCodes, deleteRedeemCode, fetchRedeemCodes, type RedeemCode } from "@/lib/api";

export function RedeemSettingsCard() {
  const [codes, setCodes] = useState<RedeemCode[]>([]);
  const [amount, setAmount] = useState("10");
  const [count, setCount] = useState("1");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const load = async () => {
    const data = await fetchRedeemCodes(200);
    setCodes(Array.isArray(data.items) ? data.items : []);
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        await load();
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "加载卡密失败");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TicketPercent className="size-4" />
          卡密功能
        </CardTitle>
        <Button
          className="h-9 rounded-xl bg-stone-950 px-4 text-white hover:bg-stone-800"
          disabled={isCreating}
          onClick={async () => {
            setIsCreating(true);
            try {
              await createRedeemCodes({ amount, count: Number(count || 1), note });
              setAmount("10");
              setCount("1");
              setNote("");
              await load();
              toast.success("卡密已生成");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "生成卡密失败");
            } finally {
              setIsCreating(false);
            }
          }}
        >
          {isCreating ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          生成
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr,120px,1fr]">
          <Input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="面额，单位元" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Input value={count} onChange={(event) => setCount(event.target.value)} placeholder="数量" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="备注" className="h-10 rounded-xl border-stone-200 bg-white" />
        </div>

        {isLoading ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <LoaderCircle className="size-5 animate-spin text-stone-400" />
          </div>
        ) : codes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-sm text-stone-500">暂无卡密</div>
        ) : (
          <div className="space-y-3">
            {codes.map((item) => (
              <div key={item.code} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
                <div className="font-medium text-stone-900">{item.code}</div>
                <div className="mt-1 text-stone-500">面额：￥{item.amount_yuan}</div>
                <div className="text-stone-500">状态：{item.enabled ? "启用" : "禁用"} / {item.used_by ? "已使用" : "未使用"}</div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    className="h-9 rounded-xl"
                    onClick={async () => {
                      try {
                        await deleteRedeemCode(item.code);
                        await load();
                        toast.success("卡密已删除");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "删除卡密失败");
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
