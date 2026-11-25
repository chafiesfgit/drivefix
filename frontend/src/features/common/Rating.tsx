import { Star } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/design/cn'
import { Button, Modal, Textarea } from '@/design/ui'

/** Accessible 1-5 star picker (radio group). */
export function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation()
  const [hover, setHover] = useState(0)
  return (
    <div role="radiogroup" aria-label={t('reviews.rating')} className="flex gap-1" dir="ltr" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t('reviews.stars', { count: n })}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className="pressable rounded-md p-1"
        >
          <Star className={cn('size-8 transition-colors duration-150', (hover || value) >= n ? 'fill-orange text-orange' : 'text-grey-200')} aria-hidden />
        </button>
      ))}
    </div>
  )
}

export function ReviewModal({
  open,
  onClose,
  title,
  onSubmit,
  busy,
  error,
}: {
  open: boolean
  onClose: () => void
  title: string
  onSubmit: (rating: number, comment?: string) => void
  busy?: boolean
  error?: string
}) {
  const { t } = useTranslation()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={t('reviews.help')}
      busy={busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button arrow disabled={!rating} loading={busy} onClick={() => onSubmit(rating, comment.trim() || undefined)}>
            {t('reviews.send')}
          </Button>
        </>
      }
    >
      <StarPicker value={rating} onChange={setRating} />
      <Textarea containerClassName="mt-4" label={t('reviews.comment')} helper={t('common.optional')} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      {error && <p role="alert" className="mt-3 rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger">{error}</p>}
    </Modal>
  )
}
