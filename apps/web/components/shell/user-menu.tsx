'use client'

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from 'react'

import type { CampaignAccessPayload } from '@/lib/api/contracts/auth'
import type { AuthIdentity } from '@/lib/auth/state'
import { getLegacyEditUrl } from '@/lib/config'

const CLOSE_ANIMATION_MS = 160

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'M'
}

function accessLabel(access: CampaignAccessPayload | null) {
  if (!access) return 'Acesso interno pendente'
  if (access.campaignRole === 'master') return 'Mestre'
  if (access.campaignRole === 'player') return 'Jogador'
  return 'Membro da campanha'
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path d="M4 20h4l10.4-10.4a2.8 2.8 0 0 0-4-4L4 16v4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="m13.2 6.8 4 4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path d="M10 5H6.5A2.5 2.5 0 0 0 4 7.5v9A2.5 2.5 0 0 0 6.5 19H10M14 8l4 4-4 4M18 12H9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  )
}

type UserMenuProps = Readonly<{
  identity: AuthIdentity
  access?: CampaignAccessPayload | null
}>

export function UserMenu({ access = null, identity }: UserMenuProps) {
  const editUrl = access?.capabilities?.canOpenEdit ? getLegacyEditUrl() : null
  const role = accessLabel(access)
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCloseTimer = useCallback(() => {
    if (!closeTimerRef.current) return
    clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }, [])

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false)
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => setMounted(false), CLOSE_ANIMATION_MS)
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }, [clearCloseTimer])

  function openMenu() {
    clearCloseTimer()
    setMounted(true)
    window.requestAnimationFrame(() => setOpen(true))
  }

  function toggleMenu() {
    if (open) closeMenu()
    else openMenu()
  }

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      closeMenu()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeMenu(true)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeMenu, open])

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  return (
    <div className="relative">
      <button
        aria-controls="account-popover"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Abrir menu de ${identity.displayName}`}
        className={`grid size-11 shrink-0 place-items-center rounded-full border bg-canvas-subtle p-[3px] transition-[border-color,box-shadow,transform] duration-200 hover:scale-[1.03] hover:border-accent/70 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent-strong ${open ? 'border-accent-strong shadow-[0_0_0_3px_var(--ds-accent-muted)]' : 'border-border'}`}
        onClick={toggleMenu}
        ref={triggerRef}
        type="button"
      >
        <span className="grid size-full place-items-center overflow-hidden rounded-full bg-accent-muted text-xs font-bold text-accent-strong">
          {identity.avatarUrl ? (
            // biome-ignore lint/performance/noImgElement: Provider avatar is fetched by the browser, not proxied through the app image server.
            <img
              alt=""
              className="size-full object-cover"
              decoding="async"
              referrerPolicy="no-referrer"
              src={identity.avatarUrl}
            />
          ) : initials(identity.displayName)}
        </span>
      </button>

      {mounted ? (
        <div
          aria-label={`Conta de ${identity.displayName}`}
          className={`absolute right-0 z-40 mt-3 w-[min(352px,calc(100vw-1.5rem))] origin-top-right rounded-[28px] border border-border-subtle bg-surface-elevated p-3 shadow-elevated transition-[opacity,transform] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${open ? 'translate-y-0 scale-100 opacity-100 duration-200' : 'pointer-events-none -translate-y-2 scale-[0.96] opacity-0 duration-150'}`}
          id="account-popover"
          ref={panelRef}
          role="dialog"
          tabIndex={-1}
        >
          <div className="relative rounded-[22px] bg-canvas-subtle p-4 pr-12">
            <button
              aria-label="Fechar menu da conta"
              className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-foreground-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
              onClick={() => closeMenu(true)}
              type="button"
            >
              <CloseIcon />
            </button>

            <div className="flex items-center gap-3.5">
              <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border border-accent/40 bg-accent-muted text-base font-bold text-accent-strong">
                {identity.avatarUrl ? (
                  // biome-ignore lint/performance/noImgElement: Provider avatar is fetched by the browser, not proxied through the app image server.
                  <img
                    alt=""
                    className="size-full object-cover"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    src={identity.avatarUrl}
                  />
                ) : initials(identity.displayName)}
              </span>
              <div className="min-w-0">
                <strong className="block truncate text-base font-semibold text-foreground">{identity.displayName}</strong>
                {identity.email ? <span className="mt-0.5 block truncate text-xs text-foreground-muted">{identity.email}</span> : null}
                <span className="mt-2 inline-flex rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground-soft">{role}</span>
              </div>
            </div>
          </div>

          <div className="mt-2 grid gap-1">
            {editUrl ? (
              <a
                className="flex min-h-12 items-center gap-3 rounded-[16px] px-3.5 text-sm font-medium text-foreground-soft no-underline transition-colors hover:bg-surface hover:text-foreground"
                href={editUrl}
                onClick={() => closeMenu()}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-foreground-muted"><EditIcon /></span>
                <span>Editar campanha <span className="sr-only">no app legado</span></span>
              </a>
            ) : null}

            <form action="/auth/logout" method="post" className="border-t border-border-subtle pt-1">
              <button className="flex min-h-12 w-full items-center gap-3 rounded-[16px] px-3.5 text-left text-sm font-medium text-foreground-soft transition-colors hover:bg-surface hover:text-danger" type="submit">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-foreground-muted"><LogoutIcon /></span>
                <span>Sair</span>
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
