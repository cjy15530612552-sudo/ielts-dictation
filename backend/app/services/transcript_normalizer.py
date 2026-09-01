from typing import Any

from app.db.database import split_sentences
from app.models.transcript import TranscriptData


def normalize_transcript_segments(transcript: TranscriptData | dict[str, Any]) -> TranscriptData:
    """Guarantee that every structured segment contains exactly one sentence."""
    source = transcript.model_dump(mode="json") if isinstance(transcript, TranscriptData) else transcript
    normalized_segments: list[dict[str, Any]] = []
    old_to_new: dict[int, list[int]] = {}

    for segment in source.get("segments") or []:
        old_id = segment.get("id")
        for sentence in split_sentences(segment.get("text", "")):
            new_id = len(normalized_segments) + 1
            normalized_segments.append(
                {
                    "id": new_id,
                    "speaker": segment.get("speaker", ""),
                    "text": sentence,
                    "confidence": segment.get("confidence", 1),
                    "uncertain": segment.get("uncertain", False),
                }
            )
            if isinstance(old_id, int):
                old_to_new.setdefault(old_id, []).append(new_id)

    if not normalized_segments:
        for sentence in split_sentences(source.get("full_text", "")):
            normalized_segments.append(
                {"id": len(normalized_segments) + 1, "speaker": "", "text": sentence, "confidence": 1, "uncertain": False}
            )

    normalized_uncertain = []
    for item in source.get("uncertain_tokens") or []:
        candidates = old_to_new.get(item.get("segment_id"), [])
        token = item.get("token", "").casefold()
        matching_id = next(
            (
                segment_id for segment_id in candidates
                if token and token in normalized_segments[segment_id - 1]["text"].casefold()
            ),
            candidates[0] if candidates else None,
        )
        normalized_uncertain.append({**item, "segment_id": matching_id})

    return TranscriptData.model_validate(
        {
            **source,
            "segments": normalized_segments,
            "uncertain_tokens": normalized_uncertain,
        }
    )
