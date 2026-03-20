import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import toast from 'react-hot-toast'
import {
  Camera,
  ExternalLink,
  LoaderCircle,
  Save,
  ShieldAlert,
  StickyNote,
  Undo2,
} from 'lucide-react'

import {
  apiClient,
  getApiErrorMessage,
  type PostResponse,
  type ScreenshotResponse,
} from '../api/client'
import Modal from './Modal'
import ScreenshotGallery from './ScreenshotGallery'

interface TrackingLogResponse {
  id: number
  post_id: number
  upvotes: number
  comments: number
  scraped_at: string
}

interface PostCardProps {
  post: PostResponse
  onUpdateNote: (postId: number, operatorNote: string) => Promise<PostResponse>
  screenshotRefreshVersion: number
}

function toUtcTimestamp(dateString: string) {
  const normalizedDateString =
    dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)
      ? dateString
      : `${dateString}Z`

  return new Date(normalizedDateString).getTime()
}

function formatDateTime(dateString: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(toUtcTimestamp(dateString)))
}

export default function PostCard({
  post,
  onUpdateNote,
  screenshotRefreshVersion,
}: PostCardProps) {
  const [trackingLogs, setTrackingLogs] = useState<TrackingLogResponse[]>([])
  const [isTrackingLoading, setIsTrackingLoading] = useState(true)
  const [trackingError, setTrackingError] = useState('')
  const [screenshots, setScreenshots] = useState<ScreenshotResponse[]>([])
  const [isScreenshotsLoading, setIsScreenshotsLoading] = useState(false)
  const [screenshotsError, setScreenshotsError] = useState('')
  const [showGalleryModal, setShowGalleryModal] = useState(false)
  const [noteDraft, setNoteDraft] = useState(post.operator_note ?? '')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const clientLabel = post.client_name ?? '未分配客户'

  useEffect(() => {
    setNoteDraft(post.operator_note ?? '')
  }, [post.id, post.operator_note])

  useEffect(() => {
    let isActive = true

    async function fetchTrackingLogs() {
      setIsTrackingLoading(true)
      setTrackingError('')

      try {
        const response = await apiClient.get<TrackingLogResponse[]>(
          `/posts/${post.id}/tracking`,
        )

        if (!isActive) {
          return
        }

        setTrackingLogs(response.data)
      } catch (error) {
        if (!isActive) {
          return
        }

        setTrackingError(getApiErrorMessage(error, '追踪数据加载失败。'))
      } finally {
        if (isActive) {
          setIsTrackingLoading(false)
        }
      }
    }

    void fetchTrackingLogs()

    return () => {
      isActive = false
    }
  }, [post.id])

  useEffect(() => {
    let isActive = true

    async function fetchScreenshotCount() {
      setIsScreenshotsLoading(true)
      setScreenshotsError('')

      try {
        const response = await apiClient.get<ScreenshotResponse[]>(
          `/posts/${post.id}/screenshots`,
        )

        if (!isActive) {
          return
        }

        setScreenshots(response.data)
      } catch (error) {
        if (!isActive) {
          return
        }

        setScreenshotsError(getApiErrorMessage(error, '截图列表加载失败。'))
      } finally {
        if (isActive) {
          setIsScreenshotsLoading(false)
        }
      }
    }

    void fetchScreenshotCount()

    return () => {
      isActive = false
    }
  }, [post.id, screenshotRefreshVersion])

  const isRemoved = post.status === 'Removed'
  const isDirty = noteDraft !== (post.operator_note ?? '')
  const screenshotCount = screenshots.length
  const hasScreenshots = screenshotCount > 0

  async function handleSaveNote() {
    setIsSavingNote(true)

    try {
      await onUpdateNote(post.id, noteDraft)
      toast.success('备注已更新')
    } catch (error) {
      toast.error(getApiErrorMessage(error, '备注更新失败，请稍后重试。'))
    } finally {
      setIsSavingNote(false)
    }
  }

  async function fetchLatestScreenshots() {
    setIsScreenshotsLoading(true)
    setScreenshotsError('')

    try {
      const response = await apiClient.get<ScreenshotResponse[]>(
        `/posts/${post.id}/screenshots`,
      )
      setScreenshots(response.data)
      return response.data
    } catch (error) {
      const message = getApiErrorMessage(error, '截图列表加载失败，请稍后重试。')
      setScreenshotsError(message)
      throw new Error(message)
    } finally {
      setIsScreenshotsLoading(false)
    }
  }

  async function handleOpenGallery() {
    setShowGalleryModal(true)

    try {
      await fetchLatestScreenshots()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '截图列表加载失败，请稍后重试。'
      toast.error(message)
    }
  }

  const upvotesSeries = trackingLogs.map((item) => [
    toUtcTimestamp(item.scraped_at),
    item.upvotes,
  ])
  const commentsSeries = trackingLogs.map((item) => [
    toUtcTimestamp(item.scraped_at),
    item.comments,
  ])

  const chartOption: EChartsOption = {
    backgroundColor: 'transparent',
    animationDuration: 650,
    color: ['#c84f2f', '#2563eb'],
    legend: {
      top: 0,
      textStyle: {
        color: '#475569',
        fontSize: 12,
      },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.94)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      textStyle: {
        color: '#f8fafc',
      },
      formatter: (params: unknown) => {
        const list = Array.isArray(params)
          ? (params as Array<{
              axisValue: number | string
              seriesName: string
              value: [number, number]
              color: string
            }>)
          : []

        if (list.length === 0) {
          return ''
        }

        const axisValue = Number(list[0].value?.[0] ?? list[0].axisValue)
        const header = new Intl.DateTimeFormat('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date(axisValue))

        const rows = list
          .map(
            (item) =>
              `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:6px;">
                <span style="display:flex;align-items:center;gap:8px;">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${item.color};"></span>
                  ${item.seriesName}
                </span>
                <strong>${item.value?.[1] ?? '-'}</strong>
              </div>`,
          )
          .join('')

        return `<div style="min-width:180px;">
          <div style="font-weight:700;margin-bottom:8px;">${header}</div>
          ${rows}
        </div>`
      },
    },
    grid: {
      top: 48,
      left: 48,
      right: 48,
      bottom: 76,
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        color: '#64748b',
        fontSize: 11,
        rotate: 45,
        margin: 18,
        formatter: (value: number) =>
          new Intl.DateTimeFormat('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(value)),
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(148, 163, 184, 0.55)',
        },
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(226, 232, 240, 0.7)',
        },
      },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Upvotes',
        position: 'left',
        nameTextStyle: {
          color: '#c84f2f',
          fontWeight: 700,
          padding: [0, 0, 10, 0],
        },
        axisLabel: {
          color: '#c84f2f',
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(226, 232, 240, 0.75)',
          },
        },
      },
      {
        type: 'value',
        name: 'Comments',
        position: 'right',
        nameTextStyle: {
          color: '#2563eb',
          fontWeight: 700,
          padding: [0, 0, 10, 0],
        },
        axisLabel: {
          color: '#2563eb',
        },
        splitLine: {
          show: false,
        },
      },
    ],
    series: [
      {
        name: 'Upvotes',
        type: 'line',
        yAxisIndex: 0,
        data: upvotesSeries,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: true,
        lineStyle: {
          width: 3,
        },
        itemStyle: {
          color: '#c84f2f',
        },
        emphasis: {
          focus: 'series',
        },
      },
      {
        name: 'Comments',
        type: 'line',
        yAxisIndex: 1,
        data: commentsSeries,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: true,
        lineStyle: {
          width: 3,
        },
        itemStyle: {
          color: '#2563eb',
        },
        emphasis: {
          focus: 'series',
        },
      },
    ],
  }

  return (
    <article
      className={[
        'overflow-hidden rounded-[30px] border shadow-[0_18px_70px_rgba(148,163,184,0.14)]',
        isRemoved
          ? 'border-red-200 bg-[linear-gradient(180deg,rgba(254,242,242,0.96)_0%,rgba(255,255,255,0.96)_100%)]'
          : 'border-white/80 bg-[rgba(255,255,255,0.92)]',
      ].join(' ')}
    >
      <div className="border-b border-slate-200/80 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between lg:gap-3">
            <div className="space-y-2 lg:min-w-0 lg:flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                  {post.reddit_id}
                </span>
                <span
                  className={[
                    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold',
                    isRemoved
                      ? 'bg-red-100 text-red-700'
                      : 'bg-emerald-100 text-emerald-700',
                  ].join(' ')}
                >
                  {isRemoved ? (
                    <>
                      <ShieldAlert className="h-3.5 w-3.5" />
                      [帖子已被移除]
                    </>
                  ) : (
                    'Active'
                  )}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold leading-7 text-slate-900">
                  {post.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  客户：{clientLabel} · 录入时间：{formatDateTime(post.created_at)}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3 self-start">
              <button
                type="button"
                onClick={() => void handleOpenGallery()}
                className={[
                  'relative inline-flex items-center gap-2 whitespace-nowrap rounded-2xl border px-4 py-2 text-sm font-medium transition',
                  hasScreenshots
                    ? 'border-orange-200 bg-orange-50 text-orange-700 hover:border-orange-300 hover:bg-orange-100'
                    : 'border-slate-200 bg-slate-100/80 text-slate-500 hover:border-slate-300 hover:bg-slate-100',
                ].join(' ')}
              >
                <Camera className="h-4 w-4" />
                {isScreenshotsLoading ? '同步截图中...' : '截图留存'}
                {hasScreenshots ? (
                  <span className="absolute -right-2 -top-2 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-1.5 text-xs font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.2)]">
                    {screenshotCount}
                  </span>
                ) : null}
              </button>

              <a
                href={post.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
              >
                <ExternalLink className="h-4 w-4" />
                原帖
              </a>
            </div>
          </div>

          <div
            className={[
              'rounded-2xl border px-4 py-2.5 text-sm leading-6',
              isRemoved
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-slate-200 bg-slate-50/80 text-slate-600',
            ].join(' ')}
          >
            {isRemoved
              ? '该帖子已被[removed]，请立即评估补发、补量或替换素材方案。'
              : '当前帖子正常追踪中，折线图已按真实抓取时间展示互动变化。'}
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white/72 p-2.5">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-slate-700">
              <StickyNote className="h-4 w-4 text-orange-700" />
              运营备注
            </div>

            <textarea
              rows={2}
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="填写补赞、补评、处理策略或异常说明"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/85 px-4 py-2 text-sm leading-6 text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />

            <div className="mt-2 flex flex-wrap gap-2.5">
              <button
                type="button"
                disabled={isSavingNote || !isDirty}
                onClick={() => void handleSaveNote()}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingNote ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    保存备注
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isSavingNote || !isDirty}
                onClick={() => setNoteDraft(post.operator_note ?? '')}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Undo2 className="h-4 w-4" />
                恢复原文
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
              Time Axis Tracking
            </p>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              按真实抓取时间绘制，不压平前 48 小时高频巡检与后续低频巡检的跨度差异。
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-sm text-slate-600">
            采样点：{trackingLogs.length}
          </div>
        </div>

        <div className="h-[296px] rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(255,255,255,0.98)_100%)] p-3">
          {isTrackingLoading ? (
            <div className="flex h-full items-center justify-center gap-3 text-slate-500">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              正在加载追踪曲线...
            </div>
          ) : trackingError ? (
            <div className="flex h-full items-center justify-center text-center text-sm leading-6 text-red-600">
              {trackingError}
            </div>
          ) : trackingLogs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm leading-6 text-slate-500">
              当前还没有追踪数据点，等待调度器执行后这里会出现真实时间轴折线图。
            </div>
          ) : (
            <ReactECharts
              option={chartOption}
              style={{ height: '100%', width: '100%' }}
              notMerge
              lazyUpdate
            />
          )}
        </div>
      </div>

      <Modal
        open={showGalleryModal}
        title={`${post.reddit_id} 截图留存相册`}
        onClose={() => setShowGalleryModal(false)}
      >
        {isScreenshotsLoading ? (
          <div className="flex min-h-[360px] items-center justify-center gap-3 text-slate-500">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            正在拉取最新截图列表...
          </div>
        ) : screenshotsError ? (
          <div className="flex min-h-[320px] items-center justify-center text-center text-sm leading-7 text-red-600">
            {screenshotsError}
          </div>
        ) : (
          <ScreenshotGallery screenshots={screenshots} />
        )}
      </Modal>
    </article>
  )
}
