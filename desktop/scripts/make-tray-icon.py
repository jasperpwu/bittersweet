#!/usr/bin/env python3
"""Draw src-tauri/icons/tray.png, the menu bar icon.

The app icon is a seed. This is the same shape as a line drawing, because macOS
scales a menu bar icon to 18 points and re-tints it from the alpha channel, so a
photographic icon turns into a black blob. Run it only to change the shape:

    python3 scripts/make-tray-icon.py     # needs Pillow

The output is committed, so nobody needs Pillow to build the app.
"""

import math
import os

from PIL import Image, ImageDraw

S = 8  # supersample factor, for a smooth curve after the downscale
N = 36  # output size in pixels — macOS draws it at 18 points, so 2x on Retina
PAD = 3.0  # padding inside the image, in output pixels
RADIUS = 12.0  # radius of the seed's round bottom
STROKE = 2.4  # outline width, in output pixels

OUT = os.path.join(os.path.dirname(__file__), '..', 'src-tauri', 'icons', 'tray.png')


def outline() -> list[tuple[float, float]]:
    """The seed: an apex at the top, a circle at the bottom, tangent sides."""
    cx = N / 2.0
    apex_y = PAD
    cy = N - PAD - RADIUS
    d = cy - apex_y
    tangent = math.sqrt(d * d - RADIUS * RADIUS)
    tx = RADIUS * tangent / d
    ty = cy - RADIUS * RADIUS / d

    a_left = math.atan2(ty - cy, -tx)
    a_right = math.atan2(ty - cy, tx)
    # Angles grow clockwise on screen, because y points down. Going up from the
    # right tangent point passes the bottom of the circle; going up from the left
    # one would cut across the top and give a caret.
    end = a_left + 2 * math.pi if a_left < a_right else a_left

    points = [(cx, apex_y)]
    steps = 200
    for i in range(steps + 1):
        t = a_right + (end - a_right) * i / steps
        points.append((cx + RADIUS * math.cos(t), cy + RADIUS * math.sin(t)))
    return points


def render() -> Image.Image:
    image = Image.new('RGBA', (N * S, N * S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    path = [(x * S, y * S) for x, y in outline()]
    draw.line(path + [path[0]], fill=(0, 0, 0, 255), width=int(STROKE * S), joint='curve')

    # The seed inside the shell.
    cx = N / 2.0 * S
    draw.line([(cx, 13.0 * S), (cx, 27.0 * S)], fill=(0, 0, 0, 255), width=int(2.2 * S))

    return image.resize((N, N), Image.LANCZOS)


if __name__ == '__main__':
    render().save(OUT)
    print('wrote', os.path.normpath(OUT))
