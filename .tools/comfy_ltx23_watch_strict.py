#!/usr/bin/env python3
"""Strict Funk Quack ComfyUI watcher.

This wrapper keeps the approved project watcher intact, but tightens the
per-line prompt and negative prompt so image-to-video stays closer to the
source still and does not invent extra characters.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any
from urllib import error, parse


PROJECT = Path(r"D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha")
SCRIPTS = PROJECT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import comfy_ltx23_batch as batch  # noqa: E402
import comfy_ltx23_watch as watch  # noqa: E402


STRICT_NEGATIVE = (
    "new characters, extra characters, extra creatures, extra people, extra animals, "
    "lamb, sheep, mascot, random child, adult woman, talking head, interview scene, "
    "doll, toy doll, princess, fashion doll, human portrait, human face, human body, "
    "realistic human girl, boy, girl, two girls, species morph, table, coffee, cafe, "
    "restaurant, office, typography, words, letters, lyric text, "
    "on-screen text, written text, subtitles, captions, title card, sign, banner, "
    "random letters, random text, dialogue bubbles, logo, watermark, fur, furry, "
    "plush, puppet, mascot texture, animal nose, species change, costume change, "
    "face deformation, scary tone, weapons"
)

LINE_VISUAL_OVERRIDES = {
    2: (
        "The only character shape is Dandi's original duckling bard silhouette inside "
        "the glowing portal, backlit and mostly dark, with the magenta beret feather "
        "and lute outline visible. Preserve the fantasy castle, circular musical "
        "portal, glowing notes, stars, cobblestone path, and sunset sky exactly. Do "
        "not introduce any human girls, dolls, princesses, portrait faces, or new "
        "characters."
    ),
    5: (
        "Only the original baby dragon is the foreground subject. The dragon glides "
        "gently in place above the same glowing portal while the existing stars, "
        "sparkles, and musical-note shapes shimmer softly in the background."
    ),
    23: (
        "Three smooth translucent purple ghost singers remain in the same choir "
        "formation behind the same ornate music stands. Their rounded ghost bodies, "
        "tiny arms, floating tails, glossy glow, open singing mouths, and blue music "
        "notes animate gently in place."
    ),
    31: (
        "Cropped rhythm detail shot from the original image: clapping hands around the "
        "edges, Dandi's duck feet and magenta bard robe in the center, the baby "
        "dragon shown only as cropped scaly legs, paws, belly, wing edge, and blue "
        "gem on the right, with glowing beat circles under the feet."
    ),
    51: (
        "Cropped clapping rhythm detail from the original image: only Dandi's feathered "
        "hands on the left edge, the baby dragon's scaly paws and blue gem at the top, "
        "the purple ghost hand on the right edge, Screaky's red feathers on the lower "
        "right, and the yellow ghost hands at the bottom around the glowing rhythm "
        "circle. Keep it as hands, paws, wings, feathers, glow, and musical notes."
    ),
    73: (
        "Locked cropped rhythm detail from the original image. Show only Dandi's white "
        "feathered clapping hands, magenta bard trousers, and orange duck feet in the "
        "upper center; Astel and Screaky remain cropped at the side edges; the baby "
        "dragon's blue-gray paws and the rounded purple and green ghosts remain cropped "
        "along the bottom around the glowing rhythm circle. Preserve the crop for the "
        "entire clip. Do not reveal or generate any face, head, human child, or full body."
    ),
    97: (
        "Preserve the exact original group around the single glowing golden tambourine "
        "in the foreground: Dandi the white duckling bard, Astel, Screaky, the baby "
        "dragon, and the existing rounded ghosts remain in their original positions. "
        "Animate only the drum glow, confetti, music notes, smiles, and a tiny rhythmic "
        "bounce. Do not turn the drum into a character or add a drummer."
    ),
    117: (
        "Preserve the exact close group and every existing clapping hand from the source "
        "image. Dandi remains a white duckling, Astel remains the red-haired fantasy "
        "child, Screaky remains the red bird, the baby dragon remains blue-gray, and the "
        "rounded colored ghosts remain unchanged. Animate a small synchronized clap and "
        "gold confetti only; do not add hands, faces, people, or characters."
    ),
    129: (
        "Preserve Dandi as the only centered hero, holding the same ornate lute in the "
        "same pose. Keep every existing cropped foreground hand, the baby dragon wing "
        "and paw, the two background children, purple ghost, castle, notes, confetti, "
        "and glowing rhythm circle exactly. Animate a small clap and lute sparkle only."
    ),
    131: (
        "Preserve the exact close mosaic from the source: one Dandi white duckling at "
        "center, one blue-gray baby dragon behind him, Astel only as the cropped "
        "red-haired child at the left edge, Screaky only as red-and-black feathers at "
        "the right edge, and the same blue and purple ghosts in front. Do not duplicate "
        "Dandi, do not create another duck face, and do not morph Screaky into a duck."
    ),
    136: (
        "Preserve exactly one Dandi white duckling bard in the center with his open "
        "left hand and ornate lute, one blue-gray baby dragon cropped at the upper "
        "right, Astel as the dark-feathered fantasy child cropped at the left, and the "
        "same small child behind Dandi. Keep every species and face unchanged. Do not "
        "create extra ducks and do not turn any background child or bird into Dandi."
    ),
    138: (
        "Preserve only Dandi walking with the ornate lute on the left, the blue-gray "
        "baby dragon floating above, and the original cropped dark-feathered Astel "
        "body seated at the extreme right edge. Astel's face is outside the source "
        "frame and must never be revealed or invented. Do not add any human face, "
        "woman, girl, child, or new character at the right edge."
    ),
    143: (
        "Preserve Dandi as the only visible character in this close portrait. Keep "
        "the same white duckling face, raised eyebrow, magenta bard costume, beret, "
        "and ornate lute exactly. Animate only a tiny knowing expression, blink, "
        "feather motion, and gentle camera drift. Do not reveal, add, or transform "
        "Dandi into any human, girl, child, doll, singer, dancer, or new character."
    ),
    144: (
        "Preserve the exact source composition: one Dandi white duckling bard cropped "
        "at lower left, one blue-gray baby dragon cropped at lower right, one red-haired "
        "fantasy child holding a cushion at the upper left, and one small blue ghost at "
        "the upper right. Animate only confetti, sparkle, and tiny existing-character "
        "motion. Do not duplicate, replace, add, or transform any child, ghost, or face."
    ),
}


def clean_visual_direction(value: str) -> str:
    cleaned = value.strip()
    removals = [
        "sem texto",
        "sem legenda",
        "sem legendas",
        "sem palavras",
        "no text",
        "no captions",
        "no subtitles",
        "no words",
    ]
    for phrase in removals:
        cleaned = cleaned.replace(phrase, "")
        cleaned = cleaned.replace(phrase.capitalize(), "")
    return " ".join(cleaned.replace(" ,", ",").split())


def strict_positive_prompt(row: dict[str, str], orientation: str) -> str:
    line_id = int(row["id"])
    visual = LINE_VISUAL_OVERRIDES.get(
        line_id,
        clean_visual_direction(row["visual_direction"]),
    )
    camera = row["camera"].strip()
    motion = row["motion_hint"].strip()
    framing = (
        "horizontal 16:9 music-video framing"
        if orientation == "horizontal"
        else "vertical 9:16 shorts framing, phone-readable characters"
    )
    return (
        "Exact image-to-video animation from the provided still. Preserve the same "
        "subject count, character identities, costumes, colors, lighting, props, "
        "background, and family-friendly high-end 3D storybook style. Keep the first "
        "frame composition nearly locked and use subtle motion only. "
        f"Scene action: {visual} Camera style: {camera}. Motion cue: {motion}. "
        f"Keep {framing}. Animate existing sparkles, glow, fabric, feathers, wings, "
        "eyes, smiles, and gentle camera drift while keeping the scene clean and "
        "cinematic for later editing."
    )


def strict_configure_prompt(
    workflow: dict[str, Any],
    row: dict[str, str],
    uploaded_image: str,
    output_prefix: str,
    orientation: str,
) -> dict[str, Any]:
    prompt = batch.configure_prompt(workflow, row, uploaded_image, output_prefix, orientation)
    if "320:313" in prompt:
        prompt["320:313"]["inputs"]["text"] = STRICT_NEGATIVE
    if "320:328" in prompt:
        prompt["320:328"]["inputs"]["value"] = False
    return prompt


def tolerant_wait_for_output(
    server: str,
    prompt_id: str,
    poll_interval: float,
    timeout: float,
) -> dict[str, Any]:
    start = time.monotonic()
    history_url = server.rstrip("/") + "/history/" + parse.quote(prompt_id)
    transient_errors = 0
    while True:
        if time.monotonic() - start > timeout:
            raise TimeoutError(f"Timed out waiting for ComfyUI prompt {prompt_id}")

        try:
            result = batch.http_json("GET", history_url)
        except (error.URLError, TimeoutError, OSError) as exc:
            transient_errors += 1
            print(
                f"WAIT history retry {transient_errors} for {prompt_id}: {exc}",
                flush=True,
            )
            time.sleep(poll_interval)
            continue

        item = result.get(prompt_id) if isinstance(result, dict) else None
        if item:
            status = item.get("status", {})
            if status.get("status_str") in {"error", "failed"}:
                raise RuntimeError(json.dumps(status, ensure_ascii=False, indent=2))
            outputs = batch.collect_outputs(item.get("outputs", {}))
            video_outputs = [
                output
                for output in outputs
                if str(output.get("filename", "")).lower().endswith(
                    (".mp4", ".webm", ".mov", ".mkv")
                )
            ]
            if video_outputs:
                return video_outputs[-1]
        time.sleep(poll_interval)


batch.positive_prompt = strict_positive_prompt
batch.wait_for_output = tolerant_wait_for_output
watch.positive_prompt = strict_positive_prompt
watch.configure_prompt = strict_configure_prompt
watch.wait_for_output = tolerant_wait_for_output


if __name__ == "__main__":
    raise SystemExit(watch.main())
