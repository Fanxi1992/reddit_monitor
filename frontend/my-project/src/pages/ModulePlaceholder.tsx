interface ModulePlaceholderProps {
  eyebrow: string
  title: string
  description: string
}

export default function ModulePlaceholder({
  eyebrow,
  title,
  description,
}: ModulePlaceholderProps) {
  return (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-blue-600/80">
          {eyebrow}
        </p>
        <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          {title}
        </h3>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          {description}
        </p>
      </div>

      <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
        <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-6">
          <div className="max-w-2xl text-center">
            <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
              第零步骨架已接入
            </div>

            <h4 className="mt-5 text-2xl font-semibold text-slate-900">
              这个页面已经进入新版后台结构
            </h4>

            <p className="mt-4 text-sm leading-7 text-slate-600">
              当前阶段只先落位新的信息架构，不贸然覆盖旧功能。后续会按产品经理设计稿，
              逐步把旧版“登记新帖 / 监控看板”里已经跑通的业务能力，迁移进新的管理页面。
            </p>

            <p className="mt-3 text-sm leading-7 text-slate-500">
              你现在仍然可以通过左侧的“登记新帖”和“监控看板”继续使用旧版功能，保证团队试用不中断。
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
