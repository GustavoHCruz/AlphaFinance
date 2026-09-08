"use client";
import type { Dictionary } from "@/lib/i18n";
import type { Tag } from "@/lib/types";
import { GripVertical, Tag as TagIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function TagSorter({
  tags,
  busy,
  t,
  reorder,
  actions,
}: {
  tags: Tag[];
  busy: boolean;
  t: Dictionary;
  reorder: (ids: string[]) => void;
  actions: (tag: Tag) => ReactNode;
}) {
  const [items, setItems] = useState(tags);
  const [active, setActive] = useState<string | null>(null);
  const order = useRef(tags);
  const origin = useRef(tags);
  const list = useRef<HTMLDivElement>(null);
  const draggingId = useRef<string | null>(null);
  useEffect(() => {
    setItems(tags);
    order.current = tags;
  }, [tags]);
  function move(id: string, target: string) {
    const next = [...order.current];
    const from = next.findIndex((t) => t.id === id),
      to = next.findIndex((t) => t.id === target);
    if (from < 0 || to < 0 || from === to) return;
    next.splice(to, 0, next.splice(from, 1)[0]);
    order.current = next;
    setItems(next);
  }
  function finish(cancel = false) {
    draggingId.current = null;
    setActive(null);
    if (cancel) {
      order.current = origin.current;
      setItems(origin.current);
      return;
    }
    if (
      order.current.some((tag, index) => tag.id !== origin.current[index]?.id)
    )
      reorder(order.current.map((tag) => tag.id));
  }
  return (
    <div
      className="tag-list"
      ref={list}
      onPointerMove={(e) => {
        if (
          !draggingId.current ||
          !e.currentTarget.hasPointerCapture(e.pointerId)
        )
          return;
        const target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>("[data-sort-id]");
        if (target && list.current?.contains(target))
          move(draggingId.current, target.dataset.sortId!);
      }}
      onPointerUp={(e) => {
        if (!draggingId.current) return;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
        finish();
      }}
      onPointerCancel={() => finish(true)}
    >
      {items.map((tag) => (
        <div
          key={tag.id}
          data-sort-id={tag.id}
          className={`tag-row ${active === tag.id ? "dragging" : ""}`}
        >
          <button
            type="button"
            className="icon-button drag-handle"
            disabled={busy}
            aria-label={`${t.reorder}: ${tag.name}`}
            title={t.orderHint}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              origin.current = [...order.current];
              draggingId.current = tag.id;
              setActive(tag.id);
              list.current?.setPointerCapture(e.pointerId);
            }}
            onKeyDown={(e) => {
              if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
              e.preventDefault();
              origin.current = [...order.current];
              const index = order.current.findIndex(
                (item) => item.id === tag.id,
              );
              const target =
                order.current[index + (e.key === "ArrowUp" ? -1 : 1)];
              if (target) {
                move(tag.id, target.id);
                finish();
              }
            }}
          >
            <GripVertical size={19} />
          </button>
          <span
            className="tag-swatch"
            style={{ background: `${tag.color}1a`, color: tag.color }}
          >
            <TagIcon size={18} />
          </span>
          <strong>{tag.name}</strong>
          <div className="row-actions">{actions(tag)}</div>
        </div>
      ))}
      {!items.length && (
        <div className="empty-table">
          <TagIcon size={28} />
          <p>{t.noTags}</p>
        </div>
      )}
    </div>
  );
}
