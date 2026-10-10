"""chakralens qr: print a terminal QR code (for phone URLs)."""

from __future__ import annotations

import typer

app = typer.Typer(help="QR code utilities.")


@app.command("qr")
def qr_command(url: str = typer.Argument(..., help="URL to encode.")) -> None:
    """Render URL as an ASCII QR code for phone scanning."""
    import qrcode  # type: ignore[import-untyped]

    qr = qrcode.QRCode(border=1)
    qr.add_data(url)
    qr.make(fit=True)
    qr.print_ascii()
    typer.echo(url)
