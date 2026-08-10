"use client";

import { useEffect, useRef, useState } from "react";

import {
  validateNotice,
  type NoticeManifest,
} from "@/features/map-login/scene";

export type NoticeState = {
  message: string;
  returnFocus: HTMLElement | null;
  selectOnClose?: boolean;
} | null;

export function NoticeDialog({
  notice,
  onClose,
}: {
  notice: NoticeState;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [manifest, setManifest] = useState<NoticeManifest | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/map-login/kms-v43/notice.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((value: unknown) => setManifest(validateNotice(value)))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !notice || !manifest || dialog.open) return;
    dialog.showModal();
    requestAnimationFrame(() => confirmRef.current?.focus());
  }, [manifest, notice]);

  function close() {
    const current = notice;
    dialogRef.current?.close();
    onClose();
    requestAnimationFrame(() => {
      current?.returnFocus?.focus({ preventScroll: true });
      if (
        current?.selectOnClose &&
        current.returnFocus instanceof HTMLInputElement
      )
        current.returnFocus.select();
    });
  }

  if (notice && failed) {
    return (
      <div className="notice-fallback" role="alert">
        알림 화면을 불러오지 못했습니다. 페이지를 새로고침해 주세요.
      </div>
    );
  }
  if (!manifest) return null;
  return (
    <dialog
      ref={dialogRef}
      className="notice-dialog"
      role="alertdialog"
      aria-labelledby="notice-title"
      aria-describedby="notice-message"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div
        className="notice-frame"
        style={{ backgroundImage: `url(${manifest.frame.background.asset})` }}
      >
        <span id="notice-title" className="sr-only">
          알림
        </span>
        <p id="notice-message">{notice?.message}</p>
        <button
          ref={confirmRef}
          className="notice-confirm"
          style={
            {
              "--normal": `url(${manifest.confirm.normal.asset})`,
              "--over": `url(${manifest.confirm.mouseOver.asset})`,
              "--pressed": `url(${manifest.confirm.pressed.asset})`,
            } as React.CSSProperties
          }
          type="button"
          aria-label="확인"
          onClick={close}
        />
      </div>
    </dialog>
  );
}
