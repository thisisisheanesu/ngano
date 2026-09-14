#!/usr/bin/env python3
"""Fine-tune Whisper small on Shona speech drawn from the ngano catalogue.

    python finetune_whisper_shona.py --epochs 1 --max-rows 2000

This is a real, runnable training script, and it is deliberately small. It
exists to show how a ngano stream feeds a standard Hugging Face trainer, not to
produce a competitive model. On a single consumer GPU a run over a couple of
thousand utterances takes minutes and will give you a model that is clearly
learning and clearly not finished.

Swap `--language` for any language in the catalogue. Shona is the default
because ngano is a Shona word.

What it does:

1. asks the catalogue for open, transcribed Shona datasets that are on the Hub
2. streams their rows through ngano, so every corpus arrives in the same shape
3. decodes and resamples audio to the 16 kHz Whisper expects
4. fine-tunes and saves to ./whisper-small-shona

Requirements:

    pip install "ngano[hf]" transformers datasets torch torchaudio accelerate evaluate jiwer

Gated repos need a Hugging Face token:

    export HF_TOKEN="hf_..."

Without one, gated datasets in the selection fail with a message naming the repo
and its page. The script continues with whatever else it can reach.
"""

from __future__ import annotations

import argparse
import os
import sys

LANGUAGE_TOKENS = {
    # Whisper's own language inventory is small and does not include most
    # African languages. Where a language has no token, training against the
    # closest available token still works and is what the community does.
    "Shona": "sn",
    "Swahili": "sw",
    "Yoruba": "yo",
    "Hausa": "ha",
    "Amharic": "am",
    "Somali": "so",
    "Afrikaans": "af",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--language", default="Shona")
    parser.add_argument("--model", default="openai/whisper-small")
    parser.add_argument("--output-dir", default="./whisper-small-shona")
    parser.add_argument("--max-rows", type=int, default=2000,
                        help="rows to pull from the stream (default: 2000)")
    parser.add_argument("--eval-rows", type=int, default=200)
    parser.add_argument("--epochs", type=float, default=1.0)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=1e-5)
    parser.add_argument("--dry-run", action="store_true",
                        help="report what would be trained on, then stop")
    return parser.parse_args()


def select_datasets(language: str):
    from ngano import Catalogue

    catalogue = Catalogue.load()
    picks = catalogue.search(
        language=language,
        access="Open",
        labelled="Transcribed",
        hf_only=True,
        sort="-hours",
    )
    if not picks:
        raise SystemExit(
            f"no open transcribed {language} datasets are on the Hub.\n"
            f"Browse https://ngano.dev to see what exists for {language}, "
            f"including records that need a request form."
        )
    return picks


def describe(picks) -> None:
    print(f"{len(picks)} dataset(s) selected:", file=sys.stderr)
    for d in picks:
        hours = f"{d.hours_num:,.0f} h" if d.hours_num else "size unstated"
        flag = " (unverified size, not counted)" if d.unverified_size else ""
        print(f"  {d.id:<50} {hours:>16}{flag}  {d.licence}", file=sys.stderr)
    counted = [d for d in picks if d.hours_num and not d.unverified_size]
    print(f"verified hours across these: {sum(d.hours_num for d in counted):,.0f}", file=sys.stderr)
    print("Check each licence before you publish a model trained on this.", file=sys.stderr)


def collect_rows(picks, max_rows: int, sampling_rate: int):
    """Stream rows and decode audio, keeping only what the trainer needs."""
    import io

    import numpy as np
    import soundfile as sf
    from ngano import load

    examples = []
    for row in load(picks, split="train"):
        if not row.transcript or not row.transcript.strip():
            continue
        # ngano keeps audio lazy, so fetch the bytes only for rows we keep.
        handle = row.audio
        raw = handle.get("bytes") if isinstance(handle, dict) else getattr(handle, "bytes", None)
        if raw is None:
            raw = row.audio_bytes()
        audio, source_rate = sf.read(io.BytesIO(raw), dtype="float32", always_2d=False)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        if source_rate != sampling_rate:
            import torch
            import torchaudio

            audio = torchaudio.functional.resample(
                torch.from_numpy(audio), source_rate, sampling_rate
            ).numpy()
        examples.append({"audio": np.asarray(audio), "text": row.transcript.strip()})
        if len(examples) % 200 == 0:
            print(f"  collected {len(examples)} utterances", file=sys.stderr)
        if len(examples) >= max_rows:
            break
    return examples


def main() -> int:
    args = parse_args()
    picks = select_datasets(args.language)
    describe(picks)

    if args.dry_run:
        print("dry run, stopping before training", file=sys.stderr)
        return 0

    if not os.environ.get("HF_TOKEN"):
        print("HF_TOKEN is not set. Gated repos in this selection will fail.", file=sys.stderr)

    import evaluate
    import torch
    from transformers import (
        Seq2SeqTrainer,
        Seq2SeqTrainingArguments,
        WhisperForConditionalGeneration,
        WhisperProcessor,
    )

    processor = WhisperProcessor.from_pretrained(
        args.model,
        language=LANGUAGE_TOKENS.get(args.language),
        task="transcribe",
    )
    model = WhisperForConditionalGeneration.from_pretrained(args.model)
    model.config.forced_decoder_ids = None
    model.generation_config.forced_decoder_ids = None

    sampling_rate = processor.feature_extractor.sampling_rate
    examples = collect_rows(picks, args.max_rows + args.eval_rows, sampling_rate)
    if len(examples) < 10:
        raise SystemExit("fewer than 10 usable utterances came back, nothing to train on")
    print(f"{len(examples)} utterances collected", file=sys.stderr)

    def encode(batch: dict) -> dict:
        features = processor.feature_extractor(
            batch["audio"], sampling_rate=sampling_rate
        ).input_features[0]
        labels = processor.tokenizer(batch["text"]).input_ids
        return {"input_features": features, "labels": labels}

    encoded = [encode(example) for example in examples]
    eval_set = encoded[: args.eval_rows]
    train_set = encoded[args.eval_rows :]

    def collate(features: list[dict]) -> dict:
        inputs = processor.feature_extractor.pad(
            [{"input_features": f["input_features"]} for f in features],
            return_tensors="pt",
        )
        labels = processor.tokenizer.pad(
            [{"input_ids": f["labels"]} for f in features], return_tensors="pt"
        )
        label_ids = labels["input_ids"].masked_fill(labels.attention_mask.ne(1), -100)
        if (label_ids[:, 0] == processor.tokenizer.bos_token_id).all().cpu().item():
            label_ids = label_ids[:, 1:]
        inputs["labels"] = label_ids
        return inputs

    wer_metric = evaluate.load("wer")

    def compute_metrics(prediction) -> dict:
        label_ids = prediction.label_ids
        label_ids[label_ids == -100] = processor.tokenizer.pad_token_id
        predicted = processor.batch_decode(prediction.predictions, skip_special_tokens=True)
        reference = processor.batch_decode(label_ids, skip_special_tokens=True)
        return {"wer": 100 * wer_metric.compute(predictions=predicted, references=reference)}

    training_args = Seq2SeqTrainingArguments(
        output_dir=args.output_dir,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        num_train_epochs=args.epochs,
        warmup_steps=50,
        gradient_checkpointing=True,
        fp16=torch.cuda.is_available(),
        eval_strategy="epoch",
        save_strategy="epoch",
        predict_with_generate=True,
        generation_max_length=225,
        logging_steps=25,
        report_to=[],
        load_best_model_at_end=True,
        metric_for_best_model="wer",
        greater_is_better=False,
    )

    trainer = Seq2SeqTrainer(
        args=training_args,
        model=model,
        train_dataset=train_set,
        eval_dataset=eval_set,
        data_collator=collate,
        compute_metrics=compute_metrics,
        tokenizer=processor.feature_extractor,
    )

    trainer.train()
    trainer.save_model(args.output_dir)
    processor.save_pretrained(args.output_dir)
    print(f"saved to {args.output_dir}", file=sys.stderr)
    print("Word error rate from a run this size is a sanity check, not a result.",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
