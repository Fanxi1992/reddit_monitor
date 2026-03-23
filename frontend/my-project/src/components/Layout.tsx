import { useEffect, useState } from 'react'
import {
  Archive,
  BellDot,
  Camera,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Menu,
  Plus,
  X,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const SIDEBAR_STORAGE_KEY = 'reddit-manager-sidebar-collapsed'

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

interface SidebarContentProps {
  collapsed: boolean
  onCloseMobile?: () => void
}

function SidebarContent({ collapsed, onCloseMobile }: SidebarContentProps) {
  return (
    <>
      <div
        className={[
          'border-b border-white/10',
          collapsed ? 'px-4 pb-5 pt-6' : 'px-6 pb-6 pt-7',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-3">
          <div
            className={[
              'min-w-0',
              collapsed ? 'flex w-full items-center justify-center' : 'flex items-start gap-3',
            ].join(' ')}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#3b82f6_0%,#2563eb_100%)] shadow-[0_16px_32px_rgba(59,130,246,0.35)]">
              <BellDot className="h-6 w-6" />
            </div>

            {!collapsed ? (
              <div className="min-w-0 space-y-1">
                <h1 className="truncate text-[2rem] font-bold leading-none tracking-tight text-white">
                  帖子管理
                </h1>
                <p className="text-sm text-slate-300">营销内容监控平台</p>
              </div>
            ) : null}
          </div>

          {onCloseMobile ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
              aria-label="关闭侧边栏"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={[
          'flex-1 overflow-y-auto py-5',
          collapsed ? 'px-3' : 'px-4',
        ].join(' ')}
      >
        <div className="space-y-6">
          {navigationSections.map((section) => (
            <div key={section.title} className="space-y-3">
              {!collapsed ? (
                <div className="px-2 text-[11px] uppercase tracking-[0.3em] text-slate-400">
                  {section.title}
                </div>
              ) : null}

              <nav className="space-y-1.5">
                {section.items.map((item) => {
                  const Icon = item.icon

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end
                      title={collapsed ? item.label : undefined}
                      onClick={onCloseMobile}
                      className={({ isActive }) =>
                        [
                          'group rounded-2xl transition-all',
                          collapsed
                            ? 'flex justify-center px-2 py-3'
                            : 'flex items-center gap-3 px-4 py-3',
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
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                              isActive ? 'bg-white/14 text-white' : 'bg-white/10 text-slate-200',
                            ].join(' ')}
                          >
                            <Icon className="h-4 w-4" />
                          </div>

                          {!collapsed ? (
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
                          ) : null}
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

      <div
        className={[
          'border-t border-white/10 py-5 text-sm text-slate-400',
          collapsed ? 'px-3 text-center' : 'px-6',
        ].join(' ')}
      >
        {collapsed ? '© 2026' : '© 2026 Reddit Manager'}
      </div>
    </>
  )
}

export default function Layout() {
  const location = useLocation()
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  })
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  const currentMeta =
    pageMeta[location.pathname as keyof typeof pageMeta] ?? pageMeta['/post-management']

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      isDesktopSidebarCollapsed ? 'true' : 'false',
    )
  }, [isDesktopSidebarCollapsed])

  const desktopSidebarWidthClassName = isDesktopSidebarCollapsed
    ? 'lg:w-[96px]'
    : 'lg:w-[276px]'
  const desktopContentOffsetClassName = isDesktopSidebarCollapsed
    ? 'lg:ml-[96px]'
    : 'lg:ml-[276px]'
  const DesktopToggleIcon = isDesktopSidebarCollapsed ? ChevronRight : ChevronLeft

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div
        className={[
          'fixed inset-0 z-40 bg-slate-950/45 transition-opacity duration-300 lg:hidden',
          isMobileSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={() => setIsMobileSidebarOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-[284px] max-w-[88vw] flex-col overflow-hidden bg-[linear-gradient(180deg,#111a2f_0%,#1a253d_100%)] text-white shadow-[0_24px_64px_rgba(15,23,42,0.32)] transition-transform duration-300 ease-out lg:hidden',
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <SidebarContent
          collapsed={false}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
      </aside>

      <aside
        className={[
          'hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col lg:overflow-hidden lg:bg-[linear-gradient(180deg,#111a2f_0%,#1a253d_100%)] lg:text-white lg:transition-[width] lg:duration-300 lg:ease-out',
          desktopSidebarWidthClassName,
        ].join(' ')}
      >
        <SidebarContent collapsed={isDesktopSidebarCollapsed} />
      </aside>

      <div
        className={[
          'transition-[margin-left] duration-300 ease-out',
          desktopContentOffsetClassName,
        ].join(' ')}
      >
        <div className="min-h-screen bg-white">
          <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
                  aria-label="打开侧边栏"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <div>
                  <p className="text-[11px] uppercase tracking-[0.32em] text-blue-600/80">
                    {currentMeta.eyebrow}
                  </p>
                  <h2 className="mt-1.5 text-[1.95rem] font-bold tracking-tight text-slate-950">
                    {currentMeta.title}
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                    {currentMeta.description}
                  </p>
                </div>
              </div>

              <div className="hidden lg:flex lg:items-center">
                <button
                  type="button"
                  onClick={() =>
                    setIsDesktopSidebarCollapsed((currentValue) => !currentValue)
                  }
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  aria-label={isDesktopSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
                  title={isDesktopSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
                >
                  <DesktopToggleIcon className="h-4 w-4" />
                  <span>{isDesktopSidebarCollapsed ? '展开导航' : '收起导航'}</span>
                </button>
              </div>
            </div>
          </header>

          <main className="p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
