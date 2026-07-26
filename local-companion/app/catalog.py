from __future__ import annotations

import json
import sqlite3
import uuid
from pathlib import Path
from typing import Any

from .artifacts import utc_now


ACTIVE_JOB_STATUSES = ("queued", "running")
FINAL_JOB_STATUSES = ("succeeded", "failed", "cancelled")


class LocalCatalog:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("pragma foreign_keys = on")
        connection.execute("pragma journal_mode = wal")
        connection.execute("pragma busy_timeout = 30000")
        return connection

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(
                """
                create table if not exists sessions (
                    recording_id text primary key,
                    title text,
                    played_at text,
                    arc text,
                    notes text,
                    created_at text not null,
                    updated_at text not null
                );

                create table if not exists jobs (
                    id text primary key,
                    recording_id text not null,
                    job_type text not null,
                    status text not null
                        check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
                    payload_json text not null,
                    attempts integer not null default 0,
                    error text,
                    created_at text not null,
                    started_at text,
                    finished_at text
                );

                create index if not exists jobs_created_at_idx
                    on jobs(created_at desc);
                create index if not exists jobs_recording_id_idx
                    on jobs(recording_id, created_at desc);
                create unique index if not exists jobs_one_active_type_idx
                    on jobs(recording_id, job_type)
                    where status in ('queued', 'running');
                """
            )

    @staticmethod
    def _row(row: sqlite3.Row | None) -> dict[str, Any] | None:
        if row is None:
            return None
        value = dict(row)
        if "payload_json" in value:
            value["payload"] = json.loads(value.pop("payload_json"))
        return value

    def ensure_session(
        self,
        recording_id: str,
        *,
        played_at: str | None = None,
    ) -> None:
        now = utc_now()
        with self.connect() as connection:
            connection.execute(
                """
                insert into sessions (
                    recording_id, played_at, created_at, updated_at
                ) values (?, ?, ?, ?)
                on conflict(recording_id) do update set
                    played_at = coalesce(sessions.played_at, excluded.played_at)
                """,
                (recording_id, played_at, now, now),
            )

    def update_session(
        self,
        recording_id: str,
        *,
        title: str | None,
        played_at: str | None,
        arc: str | None,
        notes: str | None,
    ) -> dict[str, Any]:
        self.ensure_session(recording_id, played_at=played_at)
        now = utc_now()
        with self.connect() as connection:
            connection.execute(
                """
                update sessions
                set title = ?, played_at = ?, arc = ?, notes = ?, updated_at = ?
                where recording_id = ?
                """,
                (title, played_at, arc, notes, now, recording_id),
            )
        return self.get_session(recording_id) or {}

    def get_session(self, recording_id: str) -> dict[str, Any] | None:
        with self.connect() as connection:
            row = connection.execute(
                "select * from sessions where recording_id = ?",
                (recording_id,),
            ).fetchone()
        return self._row(row)

    def create_job(
        self,
        recording_id: str,
        job_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        job_id = str(uuid.uuid4())
        with self.connect() as connection:
            try:
                connection.execute(
                    """
                    insert into jobs (
                        id, recording_id, job_type, status, payload_json, created_at
                    ) values (?, ?, ?, 'queued', ?, ?)
                    """,
                    (
                        job_id,
                        recording_id,
                        job_type,
                        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                        utc_now(),
                    ),
                )
            except sqlite3.IntegrityError as error:
                raise ValueError("Já existe um job ativo deste tipo para a sessão") from error
        return self.get_job(job_id) or {}

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        with self.connect() as connection:
            row = connection.execute(
                "select * from jobs where id = ?",
                (job_id,),
            ).fetchone()
        return self._row(row)

    def list_jobs(
        self,
        *,
        recording_id: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        bounded = max(1, min(limit, 100))
        with self.connect() as connection:
            if recording_id:
                rows = connection.execute(
                    """
                    select * from jobs
                    where recording_id = ?
                    order by created_at desc
                    limit ?
                    """,
                    (recording_id, bounded),
                ).fetchall()
            else:
                rows = connection.execute(
                    "select * from jobs order by created_at desc limit ?",
                    (bounded,),
                ).fetchall()
        return [self._row(row) or {} for row in rows]

    def queued_jobs(self) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                "select * from jobs where status = 'queued' order by created_at"
            ).fetchall()
        return [self._row(row) or {} for row in rows]

    def mark_running(self, job_id: str) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                update jobs
                set status = 'running',
                    attempts = attempts + 1,
                    started_at = ?,
                    finished_at = null,
                    error = null
                where id = ? and status = 'queued'
                """,
                (utc_now(), job_id),
            )

    def finish_job(self, job_id: str, *, status: str, error: str | None = None) -> None:
        if status not in FINAL_JOB_STATUSES:
            raise ValueError("Status final inválido")
        with self.connect() as connection:
            connection.execute(
                """
                update jobs
                set status = ?, error = ?, finished_at = ?
                where id = ?
                """,
                (status, error, utc_now(), job_id),
            )

    def fail_interrupted_jobs(self) -> int:
        with self.connect() as connection:
            cursor = connection.execute(
                """
                update jobs
                set status = 'failed',
                    error = 'O aplicativo foi encerrado durante o processamento.',
                    finished_at = ?
                where status = 'running'
                """,
                (utc_now(),),
            )
        return cursor.rowcount

    def retry_job(self, job_id: str) -> dict[str, Any]:
        with self.connect() as connection:
            row = connection.execute(
                "select * from jobs where id = ?",
                (job_id,),
            ).fetchone()
            if row is None:
                raise FileNotFoundError(job_id)
            if row["status"] != "failed":
                raise ValueError("Somente jobs com falha podem ser repetidos")
            try:
                connection.execute(
                    """
                    update jobs
                    set status = 'queued',
                        error = null,
                        started_at = null,
                        finished_at = null
                    where id = ?
                    """,
                    (job_id,),
                )
            except sqlite3.IntegrityError as error:
                raise ValueError("Já existe outro job ativo para a sessão") from error
        return self.get_job(job_id) or {}

    def counts(self) -> dict[str, int]:
        with self.connect() as connection:
            rows = connection.execute(
                "select status, count(*) as total from jobs group by status"
            ).fetchall()
        return {row["status"]: row["total"] for row in rows}
