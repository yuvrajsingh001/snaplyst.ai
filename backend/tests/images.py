from io import BytesIO

from PIL import Image


def png_bytes(color: tuple[int, int, int, int] = (255, 0, 0, 255)) -> bytes:
    image = Image.new("RGBA", (2, 2), color)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
