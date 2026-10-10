"""chakralens evaluate: honest metrics on synthetic (+ optional real) data."""

from __future__ import annotations

from pathlib import Path

import typer

app = typer.Typer(help="Evaluate the gesture MLP.")


@app.command("evaluate")
def evaluate_command(
    classifier: Path = typer.Option(  # noqa: B008
        Path("models-export/classifier.json"), help="Exported classifier JSON."
    ),
    data: Path = typer.Option(Path("data"), help="Optional real samples."),  # noqa: B008
    n_per_class: int = typer.Option(400, "--n-per-class"),
    seed: int = typer.Option(7, "--seed"),
) -> None:
    """Report accuracy + confusion matrix (labelled synthetic baseline)."""
    from chakralens.datasets import io as dataset_io
    from chakralens.datasets.synth import generate_dataset
    from chakralens.training import mlp

    model = mlp.load(classifier)
    xs, ys = generate_dataset(n_per_class=n_per_class, seed=seed + 1)  # fresh seed
    extra = dataset_io.load_dir(data) if data.exists() else ([], [])
    n_real = len(extra[1])
    mat = mlp.confusion_matrix(xs, ys, model)
    correct = sum(mat[i][i] for i in range(len(mat)))
    total = sum(sum(row) for row in mat)
    typer.echo(f"synthetic held-out (fresh seed): accuracy={correct / total:.3f} n={total}")
    if n_real:
        rmat = mlp.confusion_matrix(extra[0], extra[1], model)
        rcorrect = sum(rmat[i][i] for i in range(len(rmat)))
        typer.echo(f"real data/: accuracy={rcorrect / n_real:.3f} n={n_real}")
    else:
        typer.echo("real data/: none found (film signs, run chakralens extract, re-run)")
    typer.echo("rows=true cols=pred, synthetic-trained baseline:")
    typer.echo(mlp.format_matrix(mat))
