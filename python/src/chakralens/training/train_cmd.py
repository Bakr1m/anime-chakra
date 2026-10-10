"""chakralens train: synthetic (+ optional real data/) MLP training."""

from __future__ import annotations

from pathlib import Path

import typer

app = typer.Typer(help="Train the gesture MLP.")


@app.command("train")
def train_command(
    data: Path = typer.Option(  # noqa: B008
        Path("data"), help="Optional real samples (schema JSON/JSONL)."
    ),
    out: Path = typer.Option(  # noqa: B008
        Path("models-export/classifier.json"), help="Exported classifier JSON."
    ),
    n_per_class: int = typer.Option(400, "--n-per-class"),
    seed: int = typer.Option(7, "--seed"),
) -> None:
    """Train on synthetic (+ data/) landmarks and export classifier.json."""
    from chakralens.datasets import io as dataset_io
    from chakralens.datasets.synth import generate_dataset
    from chakralens.training import mlp

    xs, ys = generate_dataset(n_per_class=n_per_class, seed=seed)
    extra = dataset_io.load_dir(data) if data.exists() else ([], [])
    xs = list(xs) + list(extra[0])
    ys = list(ys) + list(extra[1])
    model, metrics = mlp.train(xs, ys, seed=seed)
    mlp.save(model, out)
    mat = mlp.confusion_matrix(xs, ys, model)
    typer.echo(f"wrote {out} (accuracy={metrics['accuracy']:.3f} synthetic held-out)")
    typer.echo("rows=true cols=pred, synthetic-trained baseline:")
    typer.echo(mlp.format_matrix(mat))
