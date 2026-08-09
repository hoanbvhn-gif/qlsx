import { Inbox } from 'lucide-react'
export default function EmptyState({ title = 'Chưa có dữ liệu', desc, icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-14 text-center">
      <Icon className="mb-3 size-9 text-muted-foreground/60" />
      <p className="font-medium">{title}</p>
      {desc && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
