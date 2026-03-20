import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  title?: string
  onClose: () => void
  children: ReactNode
}

export default function Modal({ open, title, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? '弹窗'}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,252,0.98)_100%)] shadow-[0_28px_100px_rgba(15,23,42,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-6 py-5">
          <div>
            {title ? (
              <h3 className="text-xl font-bold text-slate-900">{title}</h3>
            ) : null}
            <p className="mt-1 text-sm text-slate-500">
              这里展示系统已经成功留存到本地服务器的截图凭证。
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
            aria-label="关闭弹窗"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
