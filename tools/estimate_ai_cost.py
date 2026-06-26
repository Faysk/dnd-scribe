#!/usr/bin/env python3
"""Estimate AI work for a Craig session manifest before paid OpenAI calls."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_POLICY = ROOT / "config" / "ai_cost_policy.json"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def minutes(seconds: float) -> float:
    return round(seconds / 60, 2)


def money(value: float | None) -> float | None:
    return round(value, 4) if value is not None else None


def unit_cost(policy: dict[str, Any], key: str) -> float | None:
    value = ((policy.get("estimation") or {}).get("unitCostsUsd") or {}).get(key)
    return float(value) if value is not None else None


def estimate(manifest: dict[str, Any], policy: dict[str, Any]) -> dict[str, Any]:
    tracks = manifest.get("tracks") or []
    chunk_count = 0
    total_seconds = 0.0
    total_chunk_seconds = 0.0

    for track in tracks:
        total_seconds += float(track.get("duration_seconds") or 0)
        chunks = track.get("chunks") or []
        chunk_count += len(chunks)
        for chunk in chunks:
            total_chunk_seconds += float(chunk.get("duration_seconds") or 0)

    audio_seconds = total_chunk_seconds or total_seconds
    estimation = policy.get("estimation") or {}
    guards = policy.get("guards") or {}
    speech_ratio = float(estimation.get("assumedSpeechRatio") or 0.7)
    transcript_tokens_per_minute = float(estimation.get("assumedTranscriptTokensPerMinute") or 180)
    classification_output_per_segment = float(estimation.get("assumedClassificationOutputTokensPerSegment") or 80)
    summary_output_tokens = float(estimation.get("assumedSummaryOutputTokensPerSession") or 1800)

    audio_minutes = minutes(audio_seconds)
    estimated_speech_minutes = round(audio_minutes * speech_ratio, 2)
    estimated_transcript_tokens = round(estimated_speech_minutes * transcript_tokens_per_minute)
    estimated_classification_output_tokens = round(chunk_count * classification_output_per_segment)

    transcription_minute_cost = unit_cost(policy, "transcriptionAudioMinute")
    classification_input_cost = unit_cost(policy, "classificationInputMillionTokens")
    classification_output_cost = unit_cost(policy, "classificationOutputMillionTokens")
    summary_input_cost = unit_cost(policy, "summaryInputMillionTokens")
    summary_output_cost = unit_cost(policy, "summaryOutputMillionTokens")

    transcription_usd = None
    if transcription_minute_cost is not None:
        transcription_usd = estimated_speech_minutes * transcription_minute_cost

    classification_usd = None
    if classification_input_cost is not None and classification_output_cost is not None:
        classification_usd = (
            estimated_transcript_tokens / 1_000_000 * classification_input_cost
            + estimated_classification_output_tokens / 1_000_000 * classification_output_cost
        )

    summary_usd = None
    if summary_input_cost is not None and summary_output_cost is not None:
        summary_usd = (
            estimated_transcript_tokens / 1_000_000 * summary_input_cost
            + summary_output_tokens / 1_000_000 * summary_output_cost
        )

    known_parts = [item for item in [transcription_usd, classification_usd, summary_usd] if item is not None]
    total_known_usd = sum(known_parts) if known_parts else None

    warnings: list[str] = []
    max_minutes = float(guards.get("defaultMaxAudioMinutesPerRun") or 0)
    max_chunks = int(guards.get("defaultMaxChunksPerRun") or 0)
    approval_above = guards.get("requireExplicitApprovalAboveUsd")
    if max_minutes and audio_minutes > max_minutes:
        warnings.append(f"Audio acima do limite padrao por run: {audio_minutes} min > {max_minutes} min")
    if max_chunks and chunk_count > max_chunks:
        warnings.append(f"Chunks acima do limite padrao por run: {chunk_count} > {max_chunks}")
    if total_known_usd is not None and approval_above is not None and total_known_usd > float(approval_above):
        warnings.append(f"Estimativa acima do limite de aprovacao explicita: US$ {total_known_usd:.4f}")
    if transcription_minute_cost is None:
        warnings.append("Preco de transcricao nao configurado; confira a pagina oficial da OpenAI antes de executar job pago.")

    return {
        "sessionId": manifest.get("session_id"),
        "tracks": len(tracks),
        "chunks": chunk_count,
        "audioMinutes": audio_minutes,
        "estimatedSpeechMinutes": estimated_speech_minutes,
        "estimatedTranscriptTokens": estimated_transcript_tokens,
        "estimatedClassificationOutputTokens": estimated_classification_output_tokens,
        "estimatedSummaryOutputTokens": round(summary_output_tokens),
        "models": policy.get("modelRouting") or {},
        "guards": guards,
        "estimatedUsd": {
            "transcription": money(transcription_usd),
            "classification": money(classification_usd),
            "summary": money(summary_usd),
            "knownTotal": money(total_known_usd),
        },
        "batchRecommended": bool(guards.get("preferBatchForAsyncJobs", True)),
        "warnings": warnings,
    }


def print_text(result: dict[str, Any]) -> None:
    print(f"Sessao: {result.get('sessionId') or 'desconhecida'}")
    print(f"Faixas: {result['tracks']}")
    print(f"Chunks: {result['chunks']}")
    print(f"Audio: {result['audioMinutes']} min")
    print(f"Fala estimada: {result['estimatedSpeechMinutes']} min")
    print(f"Tokens transcript estimados: {result['estimatedTranscriptTokens']}")
    print(f"Batch recomendado: {'sim' if result['batchRecommended'] else 'nao'}")
    costs = result.get("estimatedUsd") or {}
    if costs.get("knownTotal") is None:
        print("Custo em USD: pendente de tabela local de precos")
    else:
        print(f"Custo estimado conhecido: US$ {costs['knownTotal']:.4f}")
    for warning in result.get("warnings") or []:
        print(f"AVISO: {warning}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="Path to tmp/sessions/<id>/manifest.json")
    parser.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    args = parser.parse_args()

    manifest = load_json(args.manifest)
    policy = load_json(args.policy)
    result = estimate(manifest, policy)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print_text(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
