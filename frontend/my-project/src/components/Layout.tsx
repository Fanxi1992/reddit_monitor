import {
  Archive,
  BellDot,
  Camera,
  ChartNoAxesCombined,
  FilePlus2,
  LayoutGrid,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const navigationSections = [
  {
    title: '新版后台',
    items: [
      {
        to: '/post-management',
        label: '帖子管理',
        description: '新版主工作台',
        icon: LayoutGrid,
      },
      {
        to: '/post-entry',
        label: '登记帖子',
        description: '新版录入流转',
        icon: Plus,
      },
      {
        to: '/post-archive',
        label: '归档帖子',
        description: '沉淀历史帖子',
        icon: Archive,
      },
      {
        to: '/post-retention',
        label: '帖子留存',
        description: '截图与凭证管理',
        icon: Camera,
      },
    ],
  },
  {
    title: '旧版可用',
    items: [
      {
        to: '/register',
        label: '登记新帖',
        description: '当前仍可继续使用',
        icon: FilePlus2,
      },
      {
        to: '/dashboard',
        label: '监控看板',
        description: '旧版大卡片视图',
        icon: ChartNoAxesCombined,
      },
    ],
  },
] as const

const pageMeta = {
  '/post-management': {
    eyebrow: 'Posts Workspace',
    title: '帖子管理',
    description: '新版后台骨架已经接入。这里会成为帖子检索、状态处理与最新数据巡检的主工作台。',
  },
  '/post-entry': {
    eyebrow: 'Post Intake',
    title: '登记帖子',
    description: '新版录入页将在这里逐步接管现有发帖登记流程。',
  },
  '/post-archive': {
    eyebrow: 'Archive Center',
    title: '归档帖子',
    description: '归档页用于承接完成观察周期的帖子，形成可检索、可回看的历史库。',
  },
  '/post-retention': {
    eyebrow: 'Screenshot Archive',
    title: '帖子留存',
    description: '截图留存页将集中管理所有自动截图结果与交付凭证。',
  },
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
    pageMeta[location.pathname as keyof typeof pageMeta] ?? pageMeta['/post-management']

  const sidebarContent = (
    <>
      <div className="border-b border-white/10 px-6 pb-6 pt-7">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#3b82f6_0%,#2563eb_100%)] shadow-[0_16px_32px_rgba(59,130,246,0.35)]">
            <BellDot className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <h1 className="text-[2rem] font-bold leading-none tracking-tight text-white">
              帖子管理
            </h1>
            <p className="text-sm text-slate-300">营销内容监控平台</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="space-y-6">
          {navigationSections.map((section) => (
            <div key={section.title} className="space-y-3">
              <div className="px-2 text-[11px] uppercase tracking-[0.3em] text-slate-400">
                {section.title}
              </div>

              <nav className="space-y-1.5">
                {section.items.map((item) => {
                  const Icon = item.icon

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end
                      className={({ isActive }) =>
                        [
                          'group flex items-center gap-3 rounded-2xl px-4 py-3 transition-all',
                          isActive
                            ? 'bg-[linear-gradient(135deg,#3b82f6_0%,#2563eb_100%)] shadow-[0_16px_30px_rgba(37,99,235,0.38)]'
                            : 'hover:bg-white/6',
                        ].join(' ')
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div
                            className={[
                              'flex h-8 w-8 items-center justify-center rounded-xl',
                              isActive ? 'bg-white/14 text-white' : 'bg-white/10 text-slate-200',
                            ].join(' ')}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div
                              className={[
                                'truncate text-lg font-medium leading-none',
                                isActive ? 'text-white' : 'text-slate-100',
                              ].join(' ')}
                            >
                              {item.label}
                            </div>
                            <p
                              className={[
                                'mt-1 truncate text-xs',
                                isActive ? 'text-blue-100/90' : 'text-slate-400',
                              ].join(' ')}
                            >
                              {item.description}
                            </p>
                          </div>
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-5 text-sm text-slate-400">
        © 2026 Reddit Manager
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#f8fbff_100%)] text-slate-900">
      <aside className="hidden lg:fixed lg:inset-y-6 lg:left-6 lg:flex lg:w-[300px] lg:flex-col lg:overflow-hidden lg:rounded-[32px] lg:border lg:border-white/8 lg:bg-[linear-gradient(180deg,#111a2f_0%,#1a253d_100%)] lg:shadow-[0_30px_100px_rgba(15,23,42,0.35)]">
        {sidebarContent}
      </aside>

      <div className="px-4 py-4 lg:ml-[330px] lg:px-6 lg:py-6">
        <aside className="mb-4 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#111a2f_0%,#1a253d_100%)] text-white shadow-[0_24px_70px_rgba(15,23,42,0.25)] lg:hidden">
          {sidebarContent}
        </aside>

        <div className="min-h-[calc(100vh-3rem)] rounded-[32px] border border-white/70 bg-[rgba(255,255,255,0.78)] p-4 shadow-[0_24px_90px_rgba(148,163,184,0.16)] backdrop-blur lg:p-6">
          <header className="rounded-[28px] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-blue-600/80">
                  {currentMeta.eyebrow}
                </p>
                <h2 className="mt-3 text-[2rem] font-bold tracking-tight text-slate-950">
                  {currentMeta.title}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  {currentMeta.description}
                </p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                  <ShieldCheck className="h-4 w-4" />
                  新后台结构已接入
                </div>
                <p className="mt-1.5 text-sm leading-6 text-blue-800/80">
                  当前处于迁移阶段，旧功能入口继续保留可用。
                </p>
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
