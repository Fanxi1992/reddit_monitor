import {
  BellDot,
  ChartNoAxesCombined,
  FilePlus2,
  PanelLeft,
  ShieldCheck,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const navigationItems = [
  {
    to: '/register',
    label: '登记新帖',
    description: '录入新的 Reddit 帖子链接',
    icon: FilePlus2,
  },
  {
    to: '/dashboard',
    label: '监控看板',
    description: '集中查看帖子状态与备注',
    icon: ChartNoAxesCombined,
  },
]

const pageMeta = {
  '/register': {
    eyebrow: 'Operations Intake',
    title: '登记新帖',
    description: '把运营刚发布的链接快速收进系统，为后续 7 天自动追踪打底。',
  },
  '/dashboard': {
    eyebrow: 'Monitoring Board',
    title: '监控看板',
    description: '按客户维度查看帖子状态、被删告警和备注编辑进度。',
  },
}

export default function Layout() {
  const location = useLocation()
  const currentMeta =
    pageMeta[location.pathname as keyof typeof pageMeta] ?? pageMeta['/register']

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 px-4 py-4 lg:flex-row lg:gap-6 lg:px-6 lg:py-6">
        <aside className="w-full rounded-[30px] border border-white/60 bg-[rgba(24,30,43,0.92)] p-5 text-white shadow-[0_30px_100px_rgba(15,23,42,0.32)] backdrop-blur xl:w-[320px]">
          <div className="flex items-start gap-3 border-b border-white/10 pb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f97316_0%,#ef4444_100%)] shadow-[0_14px_30px_rgba(249,115,22,0.28)]">
              <BellDot className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.32em] text-orange-200/80">
                Reddit Ops Console
              </p>
              <h1 className="text-lg font-bold leading-tight">
                Redditting帖子监控系统
              </h1>
              <p className="text-sm text-slate-300">
                发帖登记、自动巡检、异常告警一屏串联。
              </p>
            </div>
          </div>

          <nav className="mt-5 space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'group flex items-start gap-3 rounded-2xl border px-4 py-3 transition-all',
                      isActive
                        ? 'border-orange-300/40 bg-white/12 shadow-[0_16px_40px_rgba(15,23,42,0.18)]'
                        : 'border-white/6 bg-white/4 hover:border-white/14 hover:bg-white/8',
                    ].join(' ')
                  }
                >
                  <div className="mt-0.5 rounded-xl bg-white/10 p-2 text-orange-200 transition group-hover:bg-white/15">
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="space-y-1">
                    <div className="font-medium">{item.label}</div>
                    <p className="text-sm text-slate-300">{item.description}</p>
                  </div>
                </NavLink>
              )
            })}
          </nav>

          <div className="mt-8 rounded-[26px] border border-orange-200/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-orange-100">
              <ShieldCheck className="h-4 w-4" />
              自动巡检已接入
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              后端会按照 48 小时高频、7 天全面巡检策略持续抓取并更新帖子状态。
            </p>
          </div>
        </aside>

        <div className="flex min-h-[calc(100vh-2rem)] flex-1 flex-col rounded-[32px] border border-white/70 bg-[rgba(255,255,255,0.72)] p-4 shadow-[0_24px_90px_rgba(148,163,184,0.18)] backdrop-blur lg:p-6">
          <header className="rounded-[28px] border border-[rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.82)] px-5 py-4 shadow-[0_18px_60px_rgba(148,163,184,0.12)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.32em] text-orange-700/80">
                  {currentMeta.eyebrow}
                </p>
                <div>
                  <h2 className="text-[2rem] font-bold tracking-tight text-slate-900">
                    {currentMeta.title}
                  </h2>
                  <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
                    {currentMeta.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/80 px-4 py-2.5 text-sm text-orange-900">
                <PanelLeft className="h-4 w-4" />
                <span>内部运营控制台</span>
              </div>
            </div>
          </header>

          <main className="mt-5 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
