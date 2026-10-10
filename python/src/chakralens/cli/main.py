"""Chakra Lens CLI entry point."""

import typer

app = typer.Typer(help="Chakra Lens lab + desktop tools.")


@app.command()
def version() -> None:
    """Print the package version."""
    from chakralens import __version__

    print(__version__)


@app.callback(invoke_without_command=True)
def main(ctx: typer.Context) -> None:
    """Root command."""
    if ctx.invoked_subcommand is None:
        print(ctx.get_help())


if __name__ == "__main__":
    app()
