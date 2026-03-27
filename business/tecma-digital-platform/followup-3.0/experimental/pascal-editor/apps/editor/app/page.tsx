'use client'

import { Editor } from '@pascal-app/editor'

export default function Home() {
  return (
    <div className="h-screen w-screen bg-[radial-gradient(circle_at_top,_#2f5064_0%,_#162836_45%,_#0b121a_100%)] p-3">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/25 shadow-2xl shadow-black/40 backdrop-blur">
        <header className="flex items-center justify-between border-b border-white/15 bg-[#0f1729]/90 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-300">Tecma Followup 3.0</p>
              <h1 className="text-sm font-semibold text-white">Experimental - Pascal 3D Editor</h1>
            </div>
          </div>
          <a
            className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/10"
            href="/experimental"
          >
            Torna a Experimental Hub
          </a>
        </header>
        <div className="min-h-0 flex-1">
          <Editor projectId="local-editor" />
        </div>
      </div>
    </div>
  )
}
