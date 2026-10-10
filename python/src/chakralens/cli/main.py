"""Chakra Lens CLI entry point."""

from pathlib import Path

import typer

from chakralens.bench.bench import app as bench_app
from chakralens.cli.run import app as run_app
from chakralens.datasets.extract_cmd import app as extract_app
from chakralens.datasets.record_cmd import app as record_app
from chakralens.training.evaluate_cmd import app as evaluate_app
from chakralens.training.train_cmd import app as train_app

app = typer.Typer(help="Chakra Lens lab + desktop tools.")
app.add_typer(run_app)
app.add_typer(bench_app)
app.add_typer(train_app)
app.add_typer(evaluate_app)
app.add_typer(record_app)
app.add_typer(extract_app)


@app.command()
def version() -> None:
    """Print the package version."""
    from chakralens import __version__

    print(__version__)


@app.command()
def fixtures(
    out: Path = typer.Option(  # noqa: B008
        Path("spec/fixtures"), help="Output directory for fixture JSON files."
    ),
) -> None:
    """Generate seeded landmark fixtures for the parity suites."""
    from chakralens.datasets.fixtures import generate

    paths = generate(out)
    for p in paths:
        print(f"wrote {p}")


@app.callback(invoke_without_command=True)
def main(ctx: typer.Context) -> None:
    """Root command."""
    if ctx.invoked_subcommand is None:
        print(ctx.get_help())


if __name__ == "__main__":
    app()
