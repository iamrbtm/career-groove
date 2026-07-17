import { Sparkles } from "lucide-react";
export function EmptyState({children}:{children:React.ReactNode}){return <div className="grid min-h-40 place-items-center rounded-3xl border-2 border-dashed border-ink/20 bg-white/40 p-6 text-center"><div><Sparkles className="mx-auto text-coral"/><p className="mt-2 text-sm font-bold text-ink/50">{children}</p></div></div>}
