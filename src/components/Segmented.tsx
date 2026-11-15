interface Props<T extends string> {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
  label: string
}

/** Переключатель-«таблетка» как в iOS. */
export function Segmented<T extends string>({ value, options, onChange, label }: Props<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-2xl bg-surface-2 p-1">
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={`min-h-10 flex-1 rounded-xl text-[14px] font-semibold transition ${
              active ? 'bg-surface text-ink shadow-soft' : 'text-muted'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Маленькая кнопка-«чип» для выбора варианта. */
export function Chip({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  color?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-medium transition ${
        active ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink'
      }`}
      style={active && color ? { background: color } : undefined}
    >
      {children}
    </button>
  )
}
