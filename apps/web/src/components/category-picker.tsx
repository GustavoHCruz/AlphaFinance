'use client';
import type { Tag } from '@/lib/types';

export function CategoryPicker({
  title,
  noneLabel,
  tags,
  value,
  onChange,
}: {
  title: string;
  noneLabel: string;
  tags: Tag[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset className="category-picker">
      <legend>{title}</legend>
      <div className="label-picker" role="group" aria-label={title}>
        <button
          type="button"
          className={`chip ${!value ? 'chosen' : ''}`}
          aria-pressed={!value}
          onClick={() => onChange('')}
        >
          {noneLabel}
        </button>
        {tags.map((tag) => (
          <button
            type="button"
            key={tag.id}
            className={`chip ${value === tag.id ? 'chosen' : ''}`}
            aria-pressed={value === tag.id}
            style={{ borderColor: value === tag.id ? tag.color : undefined }}
            onClick={() => onChange(value === tag.id ? '' : tag.id)}
          >
            <i className="dot" style={{ background: tag.color }} />
            {tag.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
